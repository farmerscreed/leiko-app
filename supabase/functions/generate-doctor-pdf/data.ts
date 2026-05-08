// Data fetcher for generate-doctor-pdf — Sprint 9.
//
// Pulls everything the report needs in one round of queries, then
// shapes it into the ReportData type the template consumes. The
// shaping is intentionally close to (but not identical to) the
// mobile-side trends-aggregate.ts — the PDF needs additional fields
// (BP classification distribution, top-5 abnormal, days-below-90,
// notes) that the on-device chart doesn't.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type {
  AbnormalReading,
  BPClassDistribution,
  BPDayPoint,
  CorrelationRow,
  PdfRequest,
  Range,
  ReportData,
  AccountType,
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
}

interface NoteRow {
  body: string;
  measured_at: string;
}

export async function fetchReportData(
  supabase: SupabaseClient,
  req: PdfRequest,
): Promise<ReportData> {
  const days = RANGE_DAYS[req.range];
  const startIso = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [userRes, readingsRes, vitalsRes, correlationsRes, notesRes] =
    await Promise.all([
      supabase
        .from('users')
        .select('display_name, year_of_birth, account_type')
        .eq('id', req.userId)
        .single(),
      supabase
        .from('readings')
        .select('measured_at, systolic, diastolic, pulse, hidden')
        .eq('family_id', req.familyId)
        .eq('hidden', false)
        .gte('measured_at', startIso)
        .order('measured_at', { ascending: true }),
      supabase
        .from('vitals_other')
        .select(
          'measured_at, vital_type, value_int, value_int_2, value_int_3, hidden',
        )
        .eq('family_id', req.familyId)
        .eq('hidden', false)
        .gte('measured_at', startIso),
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
        ? supabase
            .from('reading_notes')
            .select('body, readings:readings!inner(measured_at)')
            .eq('family_id', req.familyId)
            .gte('readings.measured_at', startIso)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (userRes.error) throw userRes.error;
  if (readingsRes.error) throw readingsRes.error;
  if (vitalsRes.error) throw vitalsRes.error;
  if (correlationsRes.error) throw correlationsRes.error;
  if (notesRes.error) throw notesRes.error;

  const user = userRes.data as UserRow;
  const readings = (readingsRes.data ?? []) as ReadingRow[];
  const vitals = (vitalsRes.data ?? []) as VitalsOtherRow[];
  const correlations = (correlationsRes.data ?? []) as (CorrelationRow & {
    computed_at: string;
  })[];
  const notesRaw = (notesRes.data ?? []) as {
    body: string;
    readings: { measured_at: string };
  }[];

  return shape(req, user, readings, vitals, correlations, notesRaw);
}

function shape(
  req: PdfRequest,
  user: UserRow,
  readings: ReadingRow[],
  vitals: VitalsOtherRow[],
  correlations: (CorrelationRow & { computed_at: string })[],
  notesRaw: { body: string; readings: { measured_at: string } }[],
): ReportData {
  const bp = shapeBP(readings);
  const hr = shapeHR(vitals);
  const spo2 = shapeSpO2(vitals);
  const sleep = shapeSleep(vitals);
  const activity = shapeActivity(vitals);
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
      day: n.readings.measured_at.slice(0, 10),
      body: n.body,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  return {
    user: {
      displayName: user.display_name,
      yearOfBirth: user.year_of_birth,
      accountType: user.account_type,
    },
    range: req.range,
    rangeLabel: RANGE_LABEL[req.range],
    generatedAtIso: new Date().toISOString(),
    bp,
    hr,
    spo2,
    sleep,
    activity,
    correlations: topCorrelations,
    notes,
  };
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function classifyBP(
  sys: number,
  dia: number,
): 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis' {
  // ACC/AHA 2017 thresholds — used for the distribution histogram in
  // the BP report. Aligned with the on-device classifier.
  if (sys >= 180 || dia >= 120) return 'crisis';
  if (sys >= 140 || dia >= 90) return 'stage2';
  if (sys >= 130 || dia >= 80) return 'stage1';
  if (sys >= 120 && dia < 80) return 'elevated';
  return 'normal';
}

function shapeBP(readings: ReadingRow[]): ReportData['bp'] {
  const buckets = new Map<string, ReadingRow[]>();
  for (const r of readings) {
    const day = dayOf(r.measured_at);
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
    normal: 0,
    elevated: 0,
    stage1: 0,
    stage2: 0,
    crisis: 0,
  };
  for (const r of readings) {
    distribution[classifyBP(r.systolic, r.diastolic)] += 1;
  }

  // Top 5 abnormal: anything not in 'normal', sorted by severity then
  // recency. Severity rank: crisis > stage2 > stage1 > elevated.
  const severityRank: Record<AbnormalReading['classification'], number> = {
    crisis: 4,
    stage2: 3,
    stage1: 2,
    elevated: 1,
    normal: 0,
  };
  const abnormal = readings
    .map((r): AbnormalReading => ({
      day: dayOf(r.measured_at),
      sys: r.systolic,
      dia: r.diastolic,
      pulse: r.pulse,
      classification: classifyBP(r.systolic, r.diastolic),
    }))
    .filter((r) => r.classification !== 'normal')
    .sort((a, b) => {
      const sd = severityRank[b.classification] - severityRank[a.classification];
      if (sd !== 0) return sd;
      return a.day < b.day ? 1 : -1;
    })
    .slice(0, 5);

  // pctInRange uses the daily-mean BP within the in-range band per the
  // mobile-side aggregator (90/135 sys, 60/85 dia) for parity.
  const inRangeDays = points.filter(
    (p) => p.sys >= 90 && p.sys <= 135 && p.dia >= 60 && p.dia <= 85,
  ).length;

  return {
    avgSys: mean(readings.map((r) => r.systolic)),
    avgDia: mean(readings.map((r) => r.diastolic)),
    pctInRange: points.length === 0 ? null : inRangeDays / points.length,
    points,
    distribution,
    topAbnormal: abnormal,
    count: readings.length,
  };
}

function shapeHR(vitals: VitalsOtherRow[]): ReportData['hr'] {
  const hrSamples = vitals.filter(
    (v) => v.vital_type === 'hr' && v.value_int !== null,
  );
  const buckets = new Map<string, number[]>();
  for (const s of hrSamples) {
    const day = dayOf(s.measured_at);
    const list = buckets.get(day);
    if (list) list.push(s.value_int as number);
    else buckets.set(day, [s.value_int as number]);
  }
  const points = Array.from(buckets.entries())
    .map(([day, samples]) => ({
      day,
      restingBpm: median(samples),
      count: samples.length,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
  return {
    avgResting: mean(
      points.map((p) => p.restingBpm).filter((v): v is number => v !== null),
    ),
    points,
    count: hrSamples.length,
  };
}

function shapeSpO2(vitals: VitalsOtherRow[]): ReportData['spo2'] {
  const samples = vitals.filter(
    (v) => v.vital_type === 'spo2' && v.value_int !== null,
  );
  const buckets = new Map<string, VitalsOtherRow[]>();
  for (const s of samples) {
    const day = dayOf(s.measured_at);
    const list = buckets.get(day);
    if (list) list.push(s);
    else buckets.set(day, [s]);
  }
  const points = Array.from(buckets.entries())
    .map(([day, daySamples]) => ({
      day,
      avgPercent: mean(daySamples.map((s) => s.value_int as number)),
      minPercent:
        daySamples
          .map((s) => s.value_int_3 ?? s.value_int)
          .filter((v): v is number => v !== null)
          .reduce((a, b) => Math.min(a, b), Infinity) ?? null,
      count: daySamples.length,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const cleanPoints = points.map((p) => ({
    ...p,
    minPercent: Number.isFinite(p.minPercent) ? p.minPercent : null,
  }));
  const minValues = cleanPoints
    .map((p) => p.minPercent)
    .filter((v): v is number => v !== null);
  return {
    avgMinPercent: mean(minValues),
    daysBelow90: cleanPoints.filter(
      (p) => p.minPercent !== null && p.minPercent < 90,
    ).length,
    points: cleanPoints,
    count: samples.length,
  };
}

function shapeSleep(vitals: VitalsOtherRow[]): ReportData['sleep'] {
  const samples = vitals.filter(
    (v) => v.vital_type === 'sleep_session' && v.value_int !== null,
  );
  const buckets = new Map<string, VitalsOtherRow>();
  for (const s of samples) {
    const day = dayOf(s.measured_at);
    if (!buckets.has(day)) buckets.set(day, s);
  }
  const points = Array.from(buckets.entries())
    .map(([day, s]) => ({
      day,
      totalMinutes: s.value_int as number,
      deepMinutes: s.value_int_2 ?? 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
  return {
    avgTotalMinutes: mean(points.map((p) => p.totalMinutes)),
    points,
    count: samples.length,
  };
}

function shapeActivity(vitals: VitalsOtherRow[]): ReportData['activity'] {
  const samples = vitals.filter(
    (v) => v.vital_type === 'steps_day' && v.value_int !== null,
  );
  const buckets = new Map<string, VitalsOtherRow>();
  for (const s of samples) {
    const day = dayOf(s.measured_at);
    if (!buckets.has(day)) buckets.set(day, s);
  }
  const points = Array.from(buckets.entries())
    .map(([day, s]) => ({
      day,
      totalSteps: s.value_int as number,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
  return {
    avgSteps: mean(points.map((p) => p.totalSteps)),
    points,
    count: samples.length,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
