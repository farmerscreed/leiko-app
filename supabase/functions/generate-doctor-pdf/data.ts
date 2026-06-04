// Data fetcher for generate-doctor-pdf — Sprint 9 + Sprint 19 PDF v2.
//
// Pulls everything the report needs in one round of queries, then
// shapes it into the ReportData type the template consumes.
//
// Sprint 19 PDF v2 additions on top of the original Sprint 9 shape:
//   - Activity bug fix: shapeActivity now takes MAX per day instead
//     of FIRST. steps_day rows on the U16 watch are cumulative — the
//     first sample of a day is a partial tally written early, the
//     last is the full day. Pre-fix the doctor PDF showed
//     "Average daily steps: 52" because we were averaging the early-
//     morning cumulative snapshots.
//   - Per-vital sufficiency state (sufficient / insufficient / none)
//     so a sleep section with one night observed says so instead of
//     reporting a misleading "average".
//   - Per-vital deterministic clinicalContext paragraphs — rules-
//     engine interpretation, no AI dependency. The Tier-B/C AI
//     observations on the cross-vital page remain an addition on top.
//   - Executive summary on the cover — 5-vital headlines + bulleted
//     key findings. Renders even when AI is down (Anthropic credits
//     exhausted) so the PDF always opens with a usable digest.
//   - New aggregates: pulse pressure avg, % stage 1+/2+, HR min/max,
//     SpO2 nadir + events <93%, activity days-at-target.
//   - Reading flags column on the BP abnormal table — surfaces
//     bradycardia / tachycardia / elevated pulse pressure / narrow
//     pulse pressure so the clinician doesn't have to spot them in
//     a raw table.
//
// Voice rules (per docs/05-voice-and-claims.md) apply to every string
// this file produces. Specifically:
//   - No "patient" → use the user's display name OR "you"
//   - No "diagnose", "treat", "predict", "dangerous", "critical"
//   - Factual, calm; "averaged 137/85 over 16 readings" not
//     "shows poorly controlled hypertension"
//   - Audience is a clinician — clinical terms (systolic, pulse
//     pressure, Stage 2) are permitted

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type {
  AbnormalReading,
  BPClassDistribution,
  BPDayPoint,
  ClinicalContext,
  CorrelationRow,
  ExecutiveSummary,
  PdfRequest,
  Range,
  ReadingFlag,
  ReportData,
  AccountType,
  VitalSufficiency,
} from './types.ts';

const RANGE_DAYS: Record<Range, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const RANGE_LABEL: Record<Range, string> = {
  '7d': 'Past 7 days',
  '30d': 'Past 30 days',
  '90d': 'Past 90 days',
  '1y': 'Past 12 months',
};

// ── Sufficiency thresholds ──────────────────────────────────────────
//
// Below these counts we replace the per-vital averages/charts with
// an "insufficient data" callout. The numbers are intentionally low
// — the goal is to flag obviously thin data (1 night, 2 BP readings)
// not to gatekeep what counts as a "real" report. A doctor can still
// reason about 5 BP readings; they cannot reason about an "average"
// computed from a single one.

const BP_SUFFICIENT_MIN_READINGS = 5;
const DAYS_SUFFICIENT_MIN = 3;
const NIGHTS_SUFFICIENT_MIN = 3;

// ── BP thresholds (ACC/AHA 2017) ────────────────────────────────────
const BP_STAGE1_SYS = 130;
const BP_STAGE1_DIA = 80;
const BP_STAGE2_SYS = 140;
const BP_STAGE2_DIA = 90;
const BP_CRISIS_SYS = 180;
const BP_CRISIS_DIA = 120;

// ── Pulse / pulse-pressure flag thresholds ─────────────────────────
const BRADYCARDIA_BPM = 60;
const TACHYCARDIA_BPM = 100;
const PULSE_PRESSURE_HIGH = 60;
const PULSE_PRESSURE_LOW = 30;

// ── SpO2 thresholds ────────────────────────────────────────────────
// (SpO2 desaturation threshold <93 lives in migration 0034's RPC now.)

// ── Activity target ────────────────────────────────────────────────
const ACTIVITY_DAILY_TARGET = 6_000;

interface ReadingRow {
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  hidden: boolean;
}

interface VitalsOtherRow {
  measured_at: string;
  vital_type: string;
  value_int: number | null;
  value_int_2: number | null;
  value_int_3: number | null;
  hidden: boolean;
}

interface UserRow {
  display_name: string;
  year_of_birth: number | null;
  account_type: AccountType;
  timezone: string | null;
}

// Aggregates from the doctor_report_vitals_summary RPC (migration 0034).
// Dense vitals (hr, spo2) are aggregated in SQL over the FULL window —
// the raw-row pulls they replace were silently capped by PostgREST's
// max_rows = 1000 (HR crosses that in ~3.5 days at the 5-min cadence),
// so every report's HR/SpO2 section was computed from an arbitrary,
// UNORDERED subset. Day bucketing happens in the wearer's tz.
interface HrSummary {
  count: number;
  min: number | null;
  max: number | null;
  per_day: { day: string; median: number; n: number }[];
}

interface Spo2Summary {
  count: number;
  min_observed: number | null;
  events_below_93: number;
  per_day: { day: string; avg: number; min: number | null; n: number }[];
}

interface VitalsSummary {
  hr: HrSummary;
  spo2: Spo2Summary;
}

interface NoteRow {
  body: string;
  readings: { measured_at: string };
}

// One PostgREST page. Matches the project's max_rows so a full page
// signals "there may be more" and a short page signals "done".
const FETCH_PAGE_SIZE = 1000;

/**
 * Drain a range-windowed query to completeness, FETCH_PAGE_SIZE rows at a
 * time. Every query routed through here MUST have a deterministic ORDER BY
 * — paging an unordered query can skip/duplicate rows between pages.
 */
async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await page(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < FETCH_PAGE_SIZE) return out;
  }
}

/** Validate an IANA timezone; null/invalid → 'UTC'. */
function resolveTz(tz: string | null | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export async function fetchReportData(
  supabase: SupabaseClient,
  req: PdfRequest,
): Promise<ReportData> {
  const days = RANGE_DAYS[req.range];
  const startIso = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();

  // The wearer's tz drives every day boundary in the report, so fetch the
  // user first (it also feeds the cover identity block).
  const userRes = await supabase
    .from('users')
    .select('display_name, year_of_birth, account_type, timezone')
    .eq('id', req.userId)
    .single();
  if (userRes.error) throw userRes.error;
  const user = userRes.data as UserRow;
  const tz = resolveTz(user.timezone);

  const [readings, smallVitals, vitalsSummaryRes, correlationsRes, notesRaw] =
    await Promise.all([
      // BP readings — paginated to completeness (a year of 3/day crosses
      // PostgREST's silent 1000-row cap).
      fetchAll<ReadingRow>((from, to) =>
        supabase
          .from('readings')
          .select('measured_at, systolic, diastolic, pulse, hidden')
          .eq('family_id', req.familyId)
          .eq('hidden', false)
          .gte('measured_at', startIso)
          .order('measured_at', { ascending: true })
          .range(from, to),
      ),
      // Sleep + activity only — at most a few rows per day, but paginated
      // anyway so a 1y range can never truncate. The dense vitals (hr,
      // spo2) come from the SQL aggregate below instead of raw rows.
      fetchAll<VitalsOtherRow>((from, to) =>
        supabase
          .from('vitals_other')
          .select(
            'measured_at, vital_type, value_int, value_int_2, value_int_3, hidden',
          )
          .eq('family_id', req.familyId)
          .eq('hidden', false)
          .in('vital_type', ['sleep_session', 'steps_day'])
          .gte('measured_at', startIso)
          .order('measured_at', { ascending: true })
          .range(from, to),
      ),
      supabase.rpc('doctor_report_vitals_summary', {
        _family_id: req.familyId,
        _tz: tz,
        _from: startIso,
      }),
      supabase
        .from('correlations')
        .select(
          'correlation_type, pearson_r, effect_size, effect_unit, sample_n, is_meaningful, narrative_long, computed_at',
        )
        .eq('family_id', req.familyId)
        .eq('user_id', req.userId)
        .eq('is_meaningful', true)
        .order('computed_at', { ascending: false })
        .limit(12),
      // Notes are fetched only when the caller opted in.
      req.includeNotes !== false
        ? fetchAll<NoteRow>((from, to) =>
            supabase
              .from('reading_notes')
              .select('id, body, readings:readings!inner(measured_at)')
              .eq('family_id', req.familyId)
              .gte('readings.measured_at', startIso)
              .order('id', { ascending: true })
              .range(from, to),
          )
        : Promise.resolve([] as NoteRow[]),
    ]);

  if (vitalsSummaryRes.error) throw vitalsSummaryRes.error;
  if (correlationsRes.error) throw correlationsRes.error;

  const vitalsSummary = vitalsSummaryRes.data as VitalsSummary;
  const correlations = (correlationsRes.data ?? []) as (CorrelationRow & {
    computed_at: string;
  })[];

  return shape(req, user, tz, readings, smallVitals, vitalsSummary, correlations, notesRaw);
}

function shape(
  req: PdfRequest,
  user: UserRow,
  tz: string,
  readings: ReadingRow[],
  vitals: VitalsOtherRow[],
  vitalsSummary: VitalsSummary,
  correlations: (CorrelationRow & { computed_at: string })[],
  notesRaw: NoteRow[],
): ReportData {
  const bp = shapeBP(readings, tz);
  const hr = shapeHR(vitalsSummary.hr);
  const spo2 = shapeSpO2(vitalsSummary.spo2);
  const sleep = shapeSleep(vitals, tz);
  const activity = shapeActivity(vitals, tz);
  // Pick latest meaningful per type, capped at 3.
  const latestPerType = new Map<
    string,
    CorrelationRow & { computed_at: string }
  >();
  for (const c of correlations) {
    const prev = latestPerType.get(c.correlation_type);
    if (!prev || c.computed_at > prev.computed_at) {
      latestPerType.set(c.correlation_type, c);
    }
  }
  const topCorrelations = Array.from(latestPerType.values())
    .filter((c) => c.pearson_r !== null)
    .sort(
      (a, b) => Math.abs(b.pearson_r ?? 0) - Math.abs(a.pearson_r ?? 0),
    )
    .slice(0, 3)
    .map((c): CorrelationRow => ({
      correlation_type: c.correlation_type,
      pearson_r: c.pearson_r,
      effect_size: c.effect_size,
      effect_unit: c.effect_unit,
      sample_n: c.sample_n,
      is_meaningful: c.is_meaningful,
      narrative_long: c.narrative_long,
    }));

  const notes = notesRaw
    .map((n) => ({
      day: dayOf(n.readings.measured_at, tz),
      body: n.body,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  const clinicalFields = buildClinicalFields(req);

  const executiveSummary = buildExecutiveSummary({
    bp,
    hr,
    spo2,
    sleep,
    activity,
  });

  return {
    user: {
      displayName: user.display_name,
      yearOfBirth: user.year_of_birth,
      accountType: user.account_type,
    },
    range: req.range,
    rangeLabel: RANGE_LABEL[req.range],
    generatedAtIso: new Date().toISOString(),
    executiveSummary,
    bp,
    hr,
    spo2,
    sleep,
    activity,
    correlations: topCorrelations,
    notes,
    ...(clinicalFields ? { clinicalFields } : {}),
  };
}

/** Calendar-day key (YYYY-MM-DD) of `iso` in the wearer's timezone.
 *  Was `iso.slice(0, 10)` — the UTC day — which mis-bucketed evening
 *  readings for any non-UTC wearer (e.g. a 23:30 Lagos reading landed on
 *  the previous "day" in the report). 'en-CA' yields ISO date order. */
function dayOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function classifyBP(
  sys: number,
  dia: number,
): 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis' {
  // ACC/AHA 2017 thresholds. Aligned with the on-device classifier.
  if (sys >= BP_CRISIS_SYS || dia >= BP_CRISIS_DIA) return 'crisis';
  if (sys >= BP_STAGE2_SYS || dia >= BP_STAGE2_DIA) return 'stage2';
  if (sys >= BP_STAGE1_SYS || dia >= BP_STAGE1_DIA) return 'stage1';
  if (sys >= 120 && dia < 80) return 'elevated';
  return 'normal';
}

/** Sprint 19 PDF v2 — derive zero or more clinical flags from a
 *  single BP/pulse row. Pure function. The renderer joins them into
 *  the table's Flag cell. */
function readingFlags(sys: number, dia: number, pulse: number | null): ReadingFlag[] {
  const flags: ReadingFlag[] = [];
  if (pulse !== null) {
    if (pulse < BRADYCARDIA_BPM) {
      flags.push({ reason: 'bradycardia', label: `Bradycardia · ${pulse} bpm` });
    } else if (pulse > TACHYCARDIA_BPM) {
      flags.push({ reason: 'tachycardia', label: `Tachycardia · ${pulse} bpm` });
    }
  }
  const pp = sys - dia;
  if (pp > PULSE_PRESSURE_HIGH) {
    flags.push({ reason: 'elevated_pp', label: `Wide PP · ${pp}` });
  } else if (pp < PULSE_PRESSURE_LOW) {
    flags.push({ reason: 'narrow_pp', label: `Narrow PP · ${pp}` });
  }
  return flags;
}

function sufficiency(level: 'sufficient' | 'insufficient' | 'none', label: string): VitalSufficiency {
  return { level, label };
}

function shapeBP(readings: ReadingRow[], tz: string): ReportData['bp'] {
  if (readings.length === 0) {
    return {
      avgSys: null, avgDia: null, pctInRange: null,
      avgPulsePressure: null, pctStage1Plus: null, pctStage2Plus: null,
      points: [],
      distribution: { normal: 0, elevated: 0, stage1: 0, stage2: 0, crisis: 0 },
      topAbnormal: [],
      count: 0,
      sufficiency: sufficiency('none', 'No readings in this range.'),
      clinicalContext: { paragraphs: [] },
    };
  }
  const buckets = new Map<string, ReadingRow[]>();
  for (const r of readings) {
    const day = dayOf(r.measured_at, tz);
    const list = buckets.get(day);
    if (list) list.push(r);
    else buckets.set(day, [r]);
  }
  const points: BPDayPoint[] = [];
  for (const [day, rows] of buckets) {
    points.push({
      day,
      sys: mean(rows.map((r) => r.systolic)) ?? 0,
      dia: mean(rows.map((r) => r.diastolic)) ?? 0,
      pulse: mean(
        rows.map((r) => r.pulse).filter((p): p is number => p !== null),
      ),
      count: rows.length,
    });
  }
  points.sort((a, b) => a.day.localeCompare(b.day));

  const distribution: BPClassDistribution = {
    normal: 0, elevated: 0, stage1: 0, stage2: 0, crisis: 0,
  };
  for (const r of readings) {
    distribution[classifyBP(r.systolic, r.diastolic)] += 1;
  }

  // Top 5 abnormal: anything not in 'normal', sorted by severity then recency.
  const severityRank: Record<AbnormalReading['classification'], number> = {
    crisis: 4, stage2: 3, stage1: 2, elevated: 1, normal: 0,
  };
  const abnormal = readings
    .map((r): AbnormalReading => ({
      day: dayOf(r.measured_at, tz),
      sys: r.systolic,
      dia: r.diastolic,
      pulse: r.pulse,
      classification: classifyBP(r.systolic, r.diastolic),
      flags: readingFlags(r.systolic, r.diastolic, r.pulse),
    }))
    .filter((r) => r.classification !== 'normal' || r.flags.length > 0)
    .sort((a, b) => {
      const sd = severityRank[b.classification] - severityRank[a.classification];
      if (sd !== 0) return sd;
      return a.day < b.day ? 1 : -1;
    })
    .slice(0, 5);

  const inRangeDays = points.filter(
    (p) => p.sys >= 90 && p.sys <= 135 && p.dia >= 60 && p.dia <= 85,
  ).length;

  const avgSys = mean(readings.map((r) => r.systolic));
  const avgDia = mean(readings.map((r) => r.diastolic));
  const avgPP = (avgSys !== null && avgDia !== null)
    ? Math.round(avgSys - avgDia)
    : null;
  const stage1Plus = distribution.stage1 + distribution.stage2 + distribution.crisis;
  const stage2Plus = distribution.stage2 + distribution.crisis;
  const pctStage1Plus = readings.length > 0 ? stage1Plus / readings.length : null;
  const pctStage2Plus = readings.length > 0 ? stage2Plus / readings.length : null;

  const suff: VitalSufficiency = readings.length < BP_SUFFICIENT_MIN_READINGS
    ? sufficiency('insufficient', `${readings.length} of ≥${BP_SUFFICIENT_MIN_READINGS} readings needed.`)
    : sufficiency('sufficient', `${readings.length} readings over ${buckets.size} day${buckets.size === 1 ? '' : 's'}.`);

  const clinicalContext = buildBpContext({
    count: readings.length, days: buckets.size,
    avgSys, avgDia, avgPP,
    pctStage1Plus, pctStage2Plus,
    distribution,
    bradyCount: readings.filter((r) => r.pulse !== null && r.pulse < BRADYCARDIA_BPM).length,
    tachyCount: readings.filter((r) => r.pulse !== null && r.pulse > TACHYCARDIA_BPM).length,
  });

  return {
    avgSys, avgDia,
    pctInRange: points.length === 0 ? null : inRangeDays / points.length,
    avgPulsePressure: avgPP,
    pctStage1Plus,
    pctStage2Plus,
    points,
    distribution,
    topAbnormal: abnormal,
    count: readings.length,
    sufficiency: suff,
    clinicalContext,
  };
}

// Consumes the SQL aggregate (migration 0034) instead of raw rows: exact
// over the full window — the old raw-row path was silently capped at 1000
// arbitrary samples by PostgREST max_rows. Per-day median + counts come
// from percentile_cont(0.5), which matches the old JS median() exactly.
function shapeHR(hr: HrSummary): ReportData['hr'] {
  if (hr.count === 0) {
    return {
      avgResting: null, minObserved: null, maxObserved: null,
      points: [], count: 0,
      sufficiency: sufficiency('none', 'No heart-rate samples in this range.'),
      clinicalContext: { paragraphs: [] },
    };
  }
  // per_day arrives day-ascending from the RPC (jsonb_agg ORDER BY day).
  const points = hr.per_day.map((d) => ({
    day: d.day,
    restingBpm: d.median,
    count: d.n,
  }));

  const days = points.length;
  const suff: VitalSufficiency = days < DAYS_SUFFICIENT_MIN
    ? sufficiency('insufficient', `${days} of ≥${DAYS_SUFFICIENT_MIN} days needed.`)
    : sufficiency('sufficient', `${hr.count} samples over ${days} days.`);

  const avgResting = mean(
    points.map((p) => p.restingBpm).filter((v): v is number => v !== null),
  );

  return {
    avgResting,
    minObserved: hr.min,
    maxObserved: hr.max,
    points,
    count: hr.count,
    sufficiency: suff,
    clinicalContext: buildHrContext({
      avgResting,
      minObserved: hr.min,
      maxObserved: hr.max,
      sampleCount: hr.count,
      days,
    }),
  };
}

// Consumes the SQL aggregate (migration 0034) — see shapeHR. Semantics
// preserved exactly: per-day min = min(coalesce(hourly_min, hourly_avg)),
// min_observed = lowest single observation across both columns,
// events_below_93 counts both columns (one row can contribute two events,
// matching the old flatMap). SPO2_DESATURATION_EVENT lives in the SQL now.
function shapeSpO2(spo2: Spo2Summary): ReportData['spo2'] {
  if (spo2.count === 0) {
    return {
      avgMinPercent: null, minObserved: null,
      daysBelow90: 0, eventsBelow93: 0,
      points: [], count: 0,
      sufficiency: sufficiency('none', 'No blood-oxygen samples in this range.'),
      clinicalContext: { paragraphs: [] },
    };
  }
  const cleanPoints = spo2.per_day.map((d) => ({
    day: d.day,
    avgPercent: d.avg,
    minPercent: d.min,
    count: d.n,
  }));
  const minValues = cleanPoints
    .map((p) => p.minPercent)
    .filter((v): v is number => v !== null);

  const minObserved = spo2.min_observed;
  const eventsBelow93 = spo2.events_below_93;

  const days = cleanPoints.length;
  const suff: VitalSufficiency = days < DAYS_SUFFICIENT_MIN
    ? sufficiency('insufficient', `${days} of ≥${DAYS_SUFFICIENT_MIN} days needed.`)
    : sufficiency('sufficient', `${days} days observed.`);

  const avgMinPercent = mean(minValues);

  return {
    avgMinPercent,
    minObserved: minObserved !== null && Number.isFinite(minObserved) ? minObserved : null,
    daysBelow90: cleanPoints.filter(
      (p) => p.minPercent !== null && p.minPercent < 90,
    ).length,
    eventsBelow93,
    points: cleanPoints,
    count: spo2.count,
    sufficiency: suff,
    clinicalContext: buildSpo2Context({
      avgMinPercent,
      minObserved: minObserved !== null && Number.isFinite(minObserved) ? minObserved : null,
      eventsBelow93,
      days,
    }),
  };
}

function shapeSleep(vitals: VitalsOtherRow[], tz: string): ReportData['sleep'] {
  const samples = vitals.filter(
    (v) => v.vital_type === 'sleep_session' && v.value_int !== null,
  );
  if (samples.length === 0) {
    return {
      avgTotalMinutes: null, points: [], count: 0,
      sufficiency: sufficiency('none', 'No sleep sessions recorded in this range.'),
      clinicalContext: { paragraphs: [] },
    };
  }
  const buckets = new Map<string, VitalsOtherRow>();
  for (const s of samples) {
    const day = dayOf(s.measured_at, tz);
    if (!buckets.has(day)) buckets.set(day, s);
  }
  const points = Array.from(buckets.entries())
    .map(([day, s]) => ({
      day,
      totalMinutes: s.value_int as number,
      deepMinutes: s.value_int_2 ?? 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const nights = points.length;
  const suff: VitalSufficiency = nights < NIGHTS_SUFFICIENT_MIN
    ? sufficiency('insufficient', `${nights} of ≥${NIGHTS_SUFFICIENT_MIN} nights needed.`)
    : sufficiency('sufficient', `${nights} nights observed.`);

  const avgTotalMinutes = mean(points.map((p) => p.totalMinutes));

  return {
    avgTotalMinutes,
    points,
    count: samples.length,
    sufficiency: suff,
    clinicalContext: buildSleepContext({
      nights,
      avgTotalMinutes,
      avgDeepMinutes: mean(points.map((p) => p.deepMinutes)),
    }),
  };
}

function shapeActivity(vitals: VitalsOtherRow[], tz: string): ReportData['activity'] {
  const samples = vitals.filter(
    (v) => v.vital_type === 'steps_day' && v.value_int !== null,
  );
  if (samples.length === 0) {
    return {
      avgSteps: null, daysAtTarget: 0,
      points: [], count: 0,
      sufficiency: sufficiency('none', 'No activity recorded in this range.'),
      clinicalContext: { paragraphs: [] },
    };
  }
  // Sprint 19 PDF v2 — pre-fix this took the FIRST sample per day,
  // which was a cumulative tally written early in the morning. Now
  // we take the MAX, which is the end-of-day total.
  const buckets = new Map<string, VitalsOtherRow>();
  for (const s of samples) {
    const day = dayOf(s.measured_at, tz);
    const prev = buckets.get(day);
    if (!prev || (s.value_int ?? 0) > (prev.value_int ?? 0)) {
      buckets.set(day, s);
    }
  }
  const points = Array.from(buckets.entries())
    .map(([day, s]) => ({
      day,
      totalSteps: s.value_int as number,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const daysObserved = points.length;
  const daysAtTarget = points.filter((p) => p.totalSteps >= ACTIVITY_DAILY_TARGET).length;
  const avgSteps = mean(points.map((p) => p.totalSteps));

  const suff: VitalSufficiency = daysObserved < DAYS_SUFFICIENT_MIN
    ? sufficiency('insufficient', `${daysObserved} of ≥${DAYS_SUFFICIENT_MIN} days needed.`)
    : sufficiency('sufficient', `${daysObserved} days observed.`);

  return {
    avgSteps,
    daysAtTarget,
    points,
    count: samples.length,
    sufficiency: suff,
    clinicalContext: buildActivityContext({
      avgSteps,
      daysObserved,
      daysAtTarget,
    }),
  };
}


// ── Clinical context builders ─────────────────────────────────────
//
// Each returns 0-3 short sentences interpreting the vital. Rules-only;
// no probabilities, no diagnoses. The clinician supplies the judgment.
// Voice rules apply — see file header.

function buildBpContext(args: {
  count: number;
  days: number;
  avgSys: number | null;
  avgDia: number | null;
  avgPP: number | null;
  pctStage1Plus: number | null;
  pctStage2Plus: number | null;
  distribution: BPClassDistribution;
  bradyCount: number;
  tachyCount: number;
}): ClinicalContext {
  const paragraphs: string[] = [];
  if (args.avgSys === null || args.avgDia === null) return { paragraphs };

  const avgLine = `Average ${Math.round(args.avgSys)}/${Math.round(args.avgDia)} mmHg across ${args.count} reading${args.count === 1 ? '' : 's'} over ${args.days} day${args.days === 1 ? '' : 's'}.`;
  const stageBits: string[] = [];
  if (args.pctStage2Plus !== null) {
    const n = args.distribution.stage2 + args.distribution.crisis;
    if (n > 0) {
      stageBits.push(`${n} of ${args.count} (${Math.round(args.pctStage2Plus * 100)}%) met ACC/AHA Stage 2 (≥140/90).`);
    }
  }
  if (args.pctStage1Plus !== null && stageBits.length === 0) {
    const n = args.distribution.stage1 + args.distribution.stage2 + args.distribution.crisis;
    if (n > 0) {
      stageBits.push(`${n} of ${args.count} (${Math.round(args.pctStage1Plus * 100)}%) met Stage 1 or higher (≥130/80).`);
    }
  }
  paragraphs.push(stageBits.length > 0 ? `${avgLine} ${stageBits.join(' ')}` : avgLine);

  if (args.avgPP !== null) {
    const ppNotes: string[] = [`Pulse pressure averaged ${args.avgPP} mmHg.`];
    if (args.avgPP > PULSE_PRESSURE_HIGH) {
      ppNotes.push('Above the 60 mmHg reference band.');
    }
    paragraphs.push(ppNotes.join(' '));
  }

  if (args.bradyCount > 0 || args.tachyCount > 0) {
    const rhythmBits: string[] = [];
    if (args.bradyCount > 0) rhythmBits.push(`${args.bradyCount} reading${args.bradyCount === 1 ? '' : 's'} with pulse below 60 bpm`);
    if (args.tachyCount > 0) rhythmBits.push(`${args.tachyCount} reading${args.tachyCount === 1 ? '' : 's'} with pulse above 100 bpm`);
    paragraphs.push(`Pulse: ${rhythmBits.join('; ')}. Listed in the abnormal-readings table.`);
  }

  return { paragraphs };
}

function buildHrContext(args: {
  avgResting: number | null;
  minObserved: number | null;
  maxObserved: number | null;
  sampleCount: number;
  days: number;
}): ClinicalContext {
  const paragraphs: string[] = [];
  if (args.avgResting === null) return { paragraphs };
  const restingLine = `Resting heart rate averaged ${Math.round(args.avgResting)} bpm across ${args.sampleCount} samples over ${args.days} day${args.days === 1 ? '' : 's'}.`;
  const rangeBits: string[] = [];
  if (args.minObserved !== null && args.maxObserved !== null) {
    rangeBits.push(`Observed range ${args.minObserved}–${args.maxObserved} bpm.`);
  }
  paragraphs.push([restingLine, ...rangeBits].join(' '));

  // Adult resting HR reference: ~60-100 bpm (AHA). Flag both bounds.
  if (args.minObserved !== null && args.minObserved < 60) {
    paragraphs.push(`Lowest observed ${args.minObserved} bpm is below the 60 bpm adult resting reference. Context matters — sleep, fitness level, medication.`);
  }
  if (args.maxObserved !== null && args.maxObserved > 100) {
    paragraphs.push(`Highest observed ${args.maxObserved} bpm is above 100 bpm. Likely reflects activity or stress; sustained elevations are worth following up.`);
  }
  return { paragraphs };
}

function buildSpo2Context(args: {
  avgMinPercent: number | null;
  minObserved: number | null;
  eventsBelow93: number;
  days: number;
}): ClinicalContext {
  const paragraphs: string[] = [];
  if (args.avgMinPercent === null && args.minObserved === null) return { paragraphs };
  const bits: string[] = [];
  if (args.avgMinPercent !== null) {
    bits.push(`Average overnight low ${Math.round(args.avgMinPercent)}% across ${args.days} day${args.days === 1 ? '' : 's'}.`);
  }
  if (args.minObserved !== null) {
    bits.push(`Single lowest observation ${args.minObserved}%.`);
  }
  paragraphs.push(bits.join(' '));

  if (args.eventsBelow93 > 0) {
    paragraphs.push(`${args.eventsBelow93} observation${args.eventsBelow93 === 1 ? '' : 's'} below the 93% desaturation reference. Pattern worth reviewing alongside sleep quality.`);
  }
  return { paragraphs };
}

function buildSleepContext(args: {
  nights: number;
  avgTotalMinutes: number | null;
  avgDeepMinutes: number | null;
}): ClinicalContext {
  const paragraphs: string[] = [];
  if (args.avgTotalMinutes === null) return { paragraphs };
  if (args.nights < NIGHTS_SUFFICIENT_MIN) {
    paragraphs.push(`${args.nights} night${args.nights === 1 ? '' : 's'} of data — not enough to characterise a pattern. Reported here for completeness.`);
    return { paragraphs };
  }
  const h = Math.floor(args.avgTotalMinutes / 60);
  const m = Math.round(args.avgTotalMinutes - h * 60);
  const bits = [`Average total sleep ${h}h ${String(m).padStart(2, '0')}m across ${args.nights} nights.`];
  if (args.avgDeepMinutes !== null && args.avgTotalMinutes > 0) {
    const pct = Math.round((args.avgDeepMinutes / args.avgTotalMinutes) * 100);
    bits.push(`Deep sleep averaged ${Math.round(args.avgDeepMinutes)}m (${pct}% of total).`);
  }
  paragraphs.push(bits.join(' '));
  if (args.avgTotalMinutes < 360) {
    paragraphs.push('Average below the 6h reference band for adults — worth reviewing sleep environment and routine.');
  }
  return { paragraphs };
}

function buildActivityContext(args: {
  avgSteps: number | null;
  daysObserved: number;
  daysAtTarget: number;
}): ClinicalContext {
  const paragraphs: string[] = [];
  if (args.avgSteps === null) return { paragraphs };
  if (args.daysObserved < DAYS_SUFFICIENT_MIN) {
    paragraphs.push(`${args.daysObserved} day${args.daysObserved === 1 ? '' : 's'} of activity data — not enough to characterise a pattern.`);
    return { paragraphs };
  }
  const steps = Math.round(args.avgSteps);
  const stepsLabel = steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : `${steps}`;
  paragraphs.push(`Averaged ${stepsLabel} steps/day across ${args.daysObserved} days. Reached the ${ACTIVITY_DAILY_TARGET.toLocaleString()}-step reference on ${args.daysAtTarget} of ${args.daysObserved} day${args.daysObserved === 1 ? '' : 's'}.`);
  return { paragraphs };
}

// ── Executive summary ─────────────────────────────────────────────

function buildExecutiveSummary(args: {
  bp: ReportData['bp'];
  hr: ReportData['hr'];
  spo2: ReportData['spo2'];
  sleep: ReportData['sleep'];
  activity: ReportData['activity'];
}): ExecutiveSummary {
  const bpHeadline = (() => {
    if (args.bp.sufficiency.level === 'none') return 'No readings';
    if (args.bp.avgSys === null || args.bp.avgDia === null) return 'No readings';
    const avg = `${Math.round(args.bp.avgSys)}/${Math.round(args.bp.avgDia)} mmHg avg`;
    if (args.bp.pctStage2Plus !== null && args.bp.pctStage2Plus > 0) {
      return `${avg} · ${Math.round(args.bp.pctStage2Plus * 100)}% Stage 2+`;
    }
    if (args.bp.pctStage1Plus !== null && args.bp.pctStage1Plus > 0) {
      return `${avg} · ${Math.round(args.bp.pctStage1Plus * 100)}% Stage 1+`;
    }
    return `${avg} · within normal band`;
  })();

  const hrHeadline = args.hr.avgResting !== null
    ? `Resting ${Math.round(args.hr.avgResting)} bpm${args.hr.minObserved !== null && args.hr.maxObserved !== null ? ` · range ${args.hr.minObserved}–${args.hr.maxObserved}` : ''}`
    : 'No samples';

  const spo2Headline = (() => {
    if (args.spo2.avgMinPercent === null && args.spo2.minObserved === null) return 'No samples';
    const bits: string[] = [];
    if (args.spo2.avgMinPercent !== null) bits.push(`Avg overnight low ${Math.round(args.spo2.avgMinPercent)}%`);
    if (args.spo2.minObserved !== null) bits.push(`nadir ${args.spo2.minObserved}%`);
    return bits.join(' · ');
  })();

  const sleepHeadline = (() => {
    if (args.sleep.avgTotalMinutes === null) return 'No sessions';
    const h = Math.floor(args.sleep.avgTotalMinutes / 60);
    const m = Math.round(args.sleep.avgTotalMinutes - h * 60);
    return `${h}h ${String(m).padStart(2, '0')}m avg · ${args.sleep.points.length} night${args.sleep.points.length === 1 ? '' : 's'}`;
  })();

  const activityHeadline = (() => {
    if (args.activity.avgSteps === null) return 'No samples';
    const steps = Math.round(args.activity.avgSteps);
    const label = steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : `${steps}`;
    return `${label} steps/day · ${args.activity.daysAtTarget}/${args.activity.points.length} at target`;
  })();

  const keyFindings: string[] = [];

  // Highest-priority signals first.
  if (args.bp.pctStage2Plus !== null && args.bp.pctStage2Plus >= 0.5) {
    keyFindings.push(`BP persistently elevated — ${Math.round(args.bp.pctStage2Plus * 100)}% of readings met ACC/AHA Stage 2 (≥140/90).`);
  } else if (args.bp.pctStage1Plus !== null && args.bp.pctStage1Plus >= 0.5) {
    keyFindings.push(`Majority of BP readings at Stage 1 or above (≥130/80) — ${Math.round(args.bp.pctStage1Plus * 100)}% of ${args.bp.count}.`);
  }
  const bradyTotal = args.bp.topAbnormal.filter((r) => r.flags.some((f) => f.reason === 'bradycardia')).length;
  if (bradyTotal > 0) {
    keyFindings.push(`Pulse below 60 bpm observed in ${bradyTotal} reading${bradyTotal === 1 ? '' : 's'} — see abnormal-readings table.`);
  }
  if (args.spo2.minObserved !== null && args.spo2.minObserved < 90) {
    keyFindings.push(`SpO2 dipped to ${args.spo2.minObserved}% — single lowest observation in the window.`);
  } else if (args.spo2.eventsBelow93 > 0) {
    keyFindings.push(`${args.spo2.eventsBelow93} SpO2 observation${args.spo2.eventsBelow93 === 1 ? '' : 's'} below the 93% reference.`);
  }

  // Data-completeness warnings so the doctor doesn't over-read sparse data.
  if (args.sleep.sufficiency.level === 'insufficient') {
    keyFindings.push(`Sleep data incomplete — ${args.sleep.points.length} of 7 night${args.sleep.points.length === 1 ? '' : 's'} observed.`);
  }
  if (args.activity.sufficiency.level === 'insufficient') {
    keyFindings.push(`Activity data incomplete — ${args.activity.points.length} of 7 day${args.activity.points.length === 1 ? '' : 's'} observed.`);
  }

  return {
    bpHeadline, hrHeadline, spo2Headline, sleepHeadline, activityHeadline,
    keyFindings: keyFindings.slice(0, 5),
  };
}

// ── Clinical fields (optional, mobile-supplied) ────────────────────

function buildClinicalFields(
  req: PdfRequest,
): ReportData['clinicalFields'] | null {
  const cap = (v: string | undefined): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    if (trimmed.length === 0) return undefined;
    return trimmed.slice(0, 300);
  };
  const medications = cap(req.medications);
  const symptoms = cap(req.symptoms);
  const targetBp = cap(req.targetBp);
  if (!medications && !symptoms && !targetBp) return null;
  return {
    ...(medications ? { medications } : {}),
    ...(symptoms ? { symptoms } : {}),
    ...(targetBp ? { targetBp } : {}),
  };
}
