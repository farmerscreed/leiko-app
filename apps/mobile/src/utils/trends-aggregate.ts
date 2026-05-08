// trends-aggregate — Sprint 9 pure aggregator for the Trends screen.
//
// Takes the raw rows the Trends data hook fetched (BP readings + the
// four `vitals_other` shapes) and produces the daily series + summary
// numbers the chart and stat headlines render.
//
// Pure function — no React, no Supabase, no MMKV. Tests cover the
// aggregation logic without touching the network or device storage.
//
// Sprint 9 simplification (flagged for follow-up):
//   • Bucketing is daily across all four ranges (7d / 30d / 90d / 1y).
//     The trends.md spec calls for hourly bucketing at 7d for HR/SpO2
//     and weekly at 90d/1y; daily for everything is functionally
//     complete (the chart still tells the story) but loses some
//     resolution at the extremes. Polish pass after Sprint 9 acceptance.
//   • In-range computation uses the BP-only band (90/135 sys, 60/85
//     dia) per docs/02-design-tokens.md. Other vitals don't have a
//     "% in range" stat at v1.0.

import type { ReadingRow, VitalsOtherRow } from '../types/database';

export type TrendsRange = '7d' | '30d' | '90d' | '1y';

export const TRENDS_RANGE_DAYS: Record<TrendsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

export type VitalKind = 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity';

export interface TrendsBPPoint {
  /** YYYY-MM-DD bucket key (UTC date of the reading). */
  day: string;
  /** Daily mean systolic. */
  sys: number;
  /** Daily mean diastolic. */
  dia: number;
  /** Daily mean pulse, when present in the underlying readings. */
  pulse: number | null;
  /** How many readings landed in this bucket. */
  count: number;
}

export interface TrendsHRPoint {
  day: string;
  /** Daily resting-HR proxy: median of samples landing in 22:00–06:00
   *  local time, falling back to the day's overall median when no
   *  overnight samples exist (the latter is rare in real data). */
  restingBpm: number | null;
  count: number;
}

export interface TrendsSpO2Point {
  day: string;
  /** Daily mean of the per-sample average percent. */
  avgPercent: number | null;
  /** Daily minimum (lowest single-sample minInWindow / value_int_3). */
  minPercent: number | null;
  count: number;
}

export interface TrendsSleepPoint {
  day: string;
  /** Total minutes for the night ending on this day (per session). */
  totalMinutes: number;
  /** Deep minutes for the same session. 0 when not reported. */
  deepMinutes: number;
}

export interface TrendsActivityPoint {
  day: string;
  /** End-of-day step total. */
  totalSteps: number;
}

export interface TrendsSeries {
  bp: TrendsBPPoint[];
  hr: TrendsHRPoint[];
  spo2: TrendsSpO2Point[];
  sleep: TrendsSleepPoint[];
  activity: TrendsActivityPoint[];
}

export interface TrendsSummary {
  bp: {
    count: number;
    avgSys: number | null;
    avgDia: number | null;
    /** Fraction (0..1) of bucketed days whose mean BP fell inside the
     *  in-range band. Null when no data. */
    pctInRange: number | null;
  };
  hr: { count: number; avgResting: number | null };
  spo2: { count: number; avgMinPercent: number | null };
  sleep: { count: number; avgTotalMinutes: number | null };
  activity: { count: number; avgSteps: number | null };
}

export interface TrendsData {
  series: TrendsSeries;
  summary: TrendsSummary;
}

// In-range band per docs/02-design-tokens.md (mirrors BPTrendChart).
const SYS_LOWER = 90;
const SYS_UPPER = 135;
const DIA_LOWER = 60;
const DIA_UPPER = 85;

function dayLocalFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isOvernightHourUtc(iso: string): boolean {
  // Overnight = 22:00–06:00 UTC. Approximate proxy for the user's
  // sleep window without requiring a per-user timezone here. The
  // engine-side correlation calc uses local time; this aggregator
  // sticks to UTC for predictability across timezones — a known
  // simplification for v1.0.
  const hour = Number(iso.slice(11, 13));
  return hour >= 22 || hour < 6;
}

function bucketByDay<T>(rows: T[], dayOf: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const key = dayOf(row);
    const list = out.get(key);
    if (list) list.push(row);
    else out.set(key, [row]);
  }
  return out;
}

function sortByDayAsc<T extends { day: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

// ────────────────────────────────────────────────────────────────────
// Per-vital aggregators.

function aggregateBP(readings: ReadingRow[]): {
  series: TrendsBPPoint[];
  summary: TrendsSummary['bp'];
} {
  const visible = readings.filter((r) => !r.hidden);
  const buckets = bucketByDay(visible, (r) => dayLocalFromIso(r.measured_at));
  const series: TrendsBPPoint[] = [];
  for (const [day, rows] of buckets) {
    const sysAvg = mean(rows.map((r) => r.systolic)) ?? 0;
    const diaAvg = mean(rows.map((r) => r.diastolic)) ?? 0;
    const pulses = rows.map((r) => r.pulse).filter((p): p is number => p !== null);
    series.push({
      day,
      sys: sysAvg,
      dia: diaAvg,
      pulse: pulses.length > 0 ? mean(pulses) : null,
      count: rows.length,
    });
  }
  const sorted = sortByDayAsc(series);
  const summary: TrendsSummary['bp'] = {
    count: visible.length,
    avgSys: mean(visible.map((r) => r.systolic)),
    avgDia: mean(visible.map((r) => r.diastolic)),
    pctInRange:
      sorted.length === 0
        ? null
        : sorted.filter(
            (p) =>
              p.sys >= SYS_LOWER &&
              p.sys <= SYS_UPPER &&
              p.dia >= DIA_LOWER &&
              p.dia <= DIA_UPPER,
          ).length / sorted.length,
  };
  return { series: sorted, summary };
}

function aggregateHR(rows: VitalsOtherRow[]): {
  series: TrendsHRPoint[];
  summary: TrendsSummary['hr'];
} {
  const visible = rows.filter((r) => r.vital_type === 'hr' && !r.hidden && r.value_int !== null);
  const buckets = bucketByDay(visible, (r) => dayLocalFromIso(r.measured_at));
  const series: TrendsHRPoint[] = [];
  for (const [day, daySamples] of buckets) {
    const overnight = daySamples
      .filter((s) => isOvernightHourUtc(s.measured_at))
      .map((s) => s.value_int as number);
    const all = daySamples.map((s) => s.value_int as number);
    series.push({
      day,
      restingBpm: median(overnight.length > 0 ? overnight : all),
      count: daySamples.length,
    });
  }
  const sorted = sortByDayAsc(series);
  const restingValues = sorted
    .map((p) => p.restingBpm)
    .filter((v): v is number => v !== null);
  return {
    series: sorted,
    summary: {
      count: visible.length,
      avgResting: mean(restingValues),
    },
  };
}

function aggregateSpO2(rows: VitalsOtherRow[]): {
  series: TrendsSpO2Point[];
  summary: TrendsSummary['spo2'];
} {
  const visible = rows.filter((r) => r.vital_type === 'spo2' && !r.hidden && r.value_int !== null);
  const buckets = bucketByDay(visible, (r) => dayLocalFromIso(r.measured_at));
  const series: TrendsSpO2Point[] = [];
  for (const [day, daySamples] of buckets) {
    const avgs = daySamples.map((s) => s.value_int as number);
    const mins = daySamples
      .map((s) => s.value_int_3)
      .filter((v): v is number => v !== null);
    series.push({
      day,
      avgPercent: mean(avgs),
      minPercent: mins.length > 0 ? Math.min(...mins) : null,
      count: daySamples.length,
    });
  }
  const sorted = sortByDayAsc(series);
  const minValues = sorted
    .map((p) => p.minPercent)
    .filter((v): v is number => v !== null);
  return {
    series: sorted,
    summary: {
      count: visible.length,
      avgMinPercent: mean(minValues),
    },
  };
}

function aggregateSleep(rows: VitalsOtherRow[]): {
  series: TrendsSleepPoint[];
  summary: TrendsSummary['sleep'];
} {
  const visible = rows.filter(
    (r) => r.vital_type === 'sleep_session' && !r.hidden && r.value_int !== null,
  );
  // One row per night per device. The dedup index in 0001 enforces this
  // server-side; if a duplicate slips through we keep the first.
  const buckets = bucketByDay(visible, (r) => dayLocalFromIso(r.measured_at));
  const series: TrendsSleepPoint[] = [];
  for (const [day, [first]] of buckets) {
    series.push({
      day,
      totalMinutes: first.value_int as number,
      deepMinutes: first.value_int_2 ?? 0,
    });
  }
  const sorted = sortByDayAsc(series);
  return {
    series: sorted,
    summary: {
      count: visible.length,
      avgTotalMinutes: mean(sorted.map((p) => p.totalMinutes)),
    },
  };
}

function aggregateActivity(rows: VitalsOtherRow[]): {
  series: TrendsActivityPoint[];
  summary: TrendsSummary['activity'];
} {
  const visible = rows.filter(
    (r) => r.vital_type === 'steps_day' && !r.hidden && r.value_int !== null,
  );
  const buckets = bucketByDay(visible, (r) => dayLocalFromIso(r.measured_at));
  const series: TrendsActivityPoint[] = [];
  for (const [day, [first]] of buckets) {
    series.push({
      day,
      totalSteps: first.value_int as number,
    });
  }
  const sorted = sortByDayAsc(series);
  return {
    series: sorted,
    summary: {
      count: visible.length,
      avgSteps: mean(sorted.map((p) => p.totalSteps)),
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Top-level compose.

export interface AggregateTrendsInput {
  readings: ReadingRow[];
  vitalsOther: VitalsOtherRow[];
}

export function aggregateTrends(input: AggregateTrendsInput): TrendsData {
  const bp = aggregateBP(input.readings);
  const hr = aggregateHR(input.vitalsOther);
  const spo2 = aggregateSpO2(input.vitalsOther);
  const sleep = aggregateSleep(input.vitalsOther);
  const activity = aggregateActivity(input.vitalsOther);
  return {
    series: {
      bp: bp.series,
      hr: hr.series,
      spo2: spo2.series,
      sleep: sleep.series,
      activity: activity.series,
    },
    summary: {
      bp: bp.summary,
      hr: hr.summary,
      spo2: spo2.summary,
      sleep: sleep.summary,
      activity: activity.summary,
    },
  };
}

/** Lower-bound ISO timestamp for the requested range, exclusive of
 *  buckets older than the cutoff. Anchored to `nowMs` so callers can
 *  pin time for tests. */
export function rangeStartIso(range: TrendsRange, nowMs: number): string {
  const days = TRENDS_RANGE_DAYS[range];
  return new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
}
