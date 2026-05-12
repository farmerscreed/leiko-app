// Shared classifier module for Edge Functions — Sprint 15.
//
// Ports apps/mobile/src/utils/classification.ts to a Deno-compatible
// form so detect-anomaly + compute-baselines + send-push can run the
// same rules the mobile app already uses for in-app tier chips.
//
// Pure functions only — no database access. The Edge Function fetches
// readings + baselines + recent overnight lows from Postgres and
// passes them in. Keeps the rules unit-testable without a database.
//
// Per CLAUDE.md + D3: STATISTICAL classification, not clinical.
// Per D13 §11.1: Sleep + Activity never produce anomaly events
// regardless of their classifier tier. That's enforced by
// producesAnomalyEvent below — the only place that decision lives.
//
// Sourced from:
//   apps/mobile/src/utils/classification.ts (Sprint 6 / 7.5)
//   docs/_reference/D13-multi-vitals-constellation-spec.md §6, §11
//   docs/10-anomaly-logic.md §2

// ─────────────────────────────────────────────────────────────────────
// Shared types.

export type VitalKind = 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity';

export type ClassificationTier = 'in_pattern' | 'calm_concerned' | 'confirmed_urgent';

// Sleep gets one extra tier because its classifier returns `no_data` when
// the parent skipped a night. Activity's `progress` tier never produces
// an anomaly event so it doesn't need to flow back here.

// ─────────────────────────────────────────────────────────────────────
// BP — single-reading classifier (mirror of mobile path).

export interface ReadingForClassification {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
}

export interface ReadingBaseline {
  sys: number;
  dia: number;
  pulse: number;
  sigmaSys: number;
  sigmaDia: number;
  sigmaPulse: number;
  daysOfData: number;
}

export interface BPClassification {
  tier: ClassificationTier;
  reason:
    | 'crisis_absolute'
    | 'absolute_cold_start'
    | 'cold_start'
    | 'outlier_and_soft_threshold'
    | 'within_baseline';
}

const BP_CRISIS_SYS = 180;
const BP_CRISIS_DIA = 120;
const BP_STAGE2_SYS = 160;
const BP_STAGE2_DIA = 100;
const BP_SOFT_SYS = 150;
const BP_SOFT_DIA = 95;
const BP_SOFT_PULSE = 120;
const BP_COLD_PULSE = 130;
const BP_SIGMA_MULTIPLIER = 2;
const BP_MIN_BASELINE_DAYS = 14;

/**
 * Classify a single BP reading against an optional baseline.
 *
 * The sigma multiplier is scaled by the family's anomaly_sensitivity
 * (clamped 0.8–1.5 per docs/10-anomaly-logic.md §3). 1.0 is the
 * default; thumbs-down nudges it up (less sensitive), thumbs-up down.
 */
export function classifyBP(
  reading: ReadingForClassification,
  baseline?: ReadingBaseline | null,
  sensitivity: number = 1.0,
): BPClassification {
  const { systolic, diastolic } = reading;
  const pulse = reading.pulse ?? 0;

  // Crisis-absolute always wins, regardless of baseline maturity.
  if (systolic >= BP_CRISIS_SYS || diastolic >= BP_CRISIS_DIA) {
    return { tier: 'confirmed_urgent', reason: 'crisis_absolute' };
  }

  if (!baseline || baseline.daysOfData < BP_MIN_BASELINE_DAYS) {
    if (systolic > BP_STAGE2_SYS || diastolic > BP_STAGE2_DIA || pulse > BP_COLD_PULSE) {
      return { tier: 'calm_concerned', reason: 'absolute_cold_start' };
    }
    return { tier: 'in_pattern', reason: 'cold_start' };
  }

  const k = BP_SIGMA_MULTIPLIER * sensitivity;
  const sysOutlier = Math.abs(systolic - baseline.sys) > k * baseline.sigmaSys;
  const diaOutlier = Math.abs(diastolic - baseline.dia) > k * baseline.sigmaDia;
  const pulseOutlier =
    reading.pulse != null &&
    Math.abs(reading.pulse - baseline.pulse) > k * baseline.sigmaPulse;

  const exceedsSoft =
    systolic > BP_SOFT_SYS || diastolic > BP_SOFT_DIA || pulse > BP_SOFT_PULSE;

  if ((sysOutlier || diaOutlier || pulseOutlier) && exceedsSoft) {
    return { tier: 'calm_concerned', reason: 'outlier_and_soft_threshold' };
  }
  return { tier: 'in_pattern', reason: 'within_baseline' };
}

// BP — rolling 60-minute sustained-pattern check.

/**
 * Returns true when 3+ readings in the last 60 minutes are at Stage 2
 * (> 160/100). Per docs/10-anomaly-logic.md §2.
 *
 * `recent` is expected sorted by measured_at desc; we only consider
 * the rows whose measured_at is within (nowSec - 3600, nowSec].
 */
export function checkSustainedPattern(
  recent: { systolic: number; diastolic: number; measured_at_sec: number }[],
  nowSec: number,
): boolean {
  const windowStart = nowSec - 60 * 60;
  const stage2Hits = recent.filter(
    (r) =>
      r.measured_at_sec > windowStart &&
      r.measured_at_sec <= nowSec &&
      (r.systolic > BP_STAGE2_SYS || r.diastolic > BP_STAGE2_DIA),
  ).length;
  return stage2Hits >= 3;
}

// BP baseline computation (used by the nightly cron).

export interface BaselineInput {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  measured_at_sec: number;
}

export interface ComputedBpBaseline {
  sysMean: number;
  diaMean: number;
  pulseMean: number | null;
  sigmaSys: number;
  sigmaDia: number;
  sigmaPulse: number | null;
  daysOfData: number;
  readingCount: number;
}

/**
 * Compute a baseline over the supplied readings. `daysOfData` is
 * counted by distinct UTC dates (a proxy good enough for the 14-day
 * gate; the user's local TZ doesn't shift this materially because
 * the gate is "at least 14 days").
 *
 * Variance uses the population formula (1/N), matching the existing
 * `sigma` semantics in the mobile classifier.
 */
export function computeBpBaseline(rows: BaselineInput[]): ComputedBpBaseline | null {
  if (rows.length === 0) return null;

  const sysMean = mean(rows.map((r) => r.systolic));
  const diaMean = mean(rows.map((r) => r.diastolic));
  const pulses = rows.map((r) => r.pulse).filter((p): p is number => p != null);
  const pulseMean = pulses.length > 0 ? mean(pulses) : null;

  const sigmaSys = popStdDev(rows.map((r) => r.systolic), sysMean);
  const sigmaDia = popStdDev(rows.map((r) => r.diastolic), diaMean);
  const sigmaPulse = pulses.length > 0 && pulseMean != null
    ? popStdDev(pulses, pulseMean)
    : null;

  const days = new Set(
    rows.map((r) => new Date(r.measured_at_sec * 1000).toISOString().slice(0, 10)),
  );

  return {
    sysMean,
    diaMean,
    pulseMean,
    sigmaSys,
    sigmaDia,
    sigmaPulse,
    daysOfData: days.size,
    readingCount: rows.length,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HR.

export interface HRClassificationInput {
  restingBpmToday: number;
  restingBpmRecent: number[];
}

export interface HRClassification {
  tier: ClassificationTier;
  reason:
    | 'extreme_value'
    | 'cold_start_in_band'
    | 'cold_start_outside_band'
    | 'baseline_within'
    | 'baseline_3day_trend'
    | 'sustained_high_at_rest';
}

const HR_EXTREME_LOW = 40;
const HR_EXTREME_HIGH = 130;
const HR_COLD_BAND_LOW = 50;
const HR_COLD_BAND_HIGH = 95;
const HR_TREND_DELTA_BPM = 15;
const HR_HIGH_AT_REST = 100;
const HR_MIN_BASELINE_DAYS = 14;
const HR_TREND_DAYS = 3;

export function classifyHR(input: HRClassificationInput): HRClassification {
  const { restingBpmToday, restingBpmRecent } = input;

  if (restingBpmToday < HR_EXTREME_LOW || restingBpmToday > HR_EXTREME_HIGH) {
    return { tier: 'confirmed_urgent', reason: 'extreme_value' };
  }

  if (restingBpmRecent.length < HR_MIN_BASELINE_DAYS) {
    if (restingBpmToday >= HR_COLD_BAND_LOW && restingBpmToday <= HR_COLD_BAND_HIGH) {
      return { tier: 'in_pattern', reason: 'cold_start_in_band' };
    }
    return { tier: 'calm_concerned', reason: 'cold_start_outside_band' };
  }

  const sorted = [...restingBpmRecent].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const last3 = [...restingBpmRecent.slice(-(HR_TREND_DAYS - 1)), restingBpmToday];
  if (
    last3.length === HR_TREND_DAYS &&
    last3.every((bpm) => bpm > median + HR_TREND_DELTA_BPM)
  ) {
    return { tier: 'calm_concerned', reason: 'baseline_3day_trend' };
  }

  if (restingBpmToday > HR_HIGH_AT_REST) {
    return { tier: 'calm_concerned', reason: 'sustained_high_at_rest' };
  }

  return { tier: 'in_pattern', reason: 'baseline_within' };
}

/** Median of an HR series. Exposed so the cron can persist hr_baselines.median_bpm. */
export function computeHrMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ─────────────────────────────────────────────────────────────────────
// SpO2.

export interface SpO2ClassificationInput {
  latestPercent: number;
  overnightLowsRecent: number[];
}

export interface SpO2Classification {
  tier: ClassificationTier;
  reason:
    | 'overnight_dip_sustained'
    | 'sample_or_overnight_borderline'
    | 'sample_and_overnight_in_band'
    | 'sample_below_90_alone';
}

const SPO2_URGENT_OVERNIGHT_LOW = 88;
const SPO2_URGENT_SUSTAINED_NIGHTS = 3;
const SPO2_BORDERLINE_SAMPLE_LOW = 90;
const SPO2_BORDERLINE_SAMPLE_HIGH = 94;
const SPO2_BORDERLINE_OVERNIGHT_LOW = 88;
const SPO2_BORDERLINE_OVERNIGHT_HIGH = 89;
const SPO2_IN_PATTERN_SAMPLE_FLOOR = 95;
const SPO2_IN_PATTERN_OVERNIGHT_FLOOR = 90;

export function classifySpO2(input: SpO2ClassificationInput): SpO2Classification {
  const { latestPercent, overnightLowsRecent } = input;

  const lastN = overnightLowsRecent.slice(-SPO2_URGENT_SUSTAINED_NIGHTS);
  if (
    lastN.length >= SPO2_URGENT_SUSTAINED_NIGHTS &&
    lastN.every((low) => low < SPO2_URGENT_OVERNIGHT_LOW)
  ) {
    return { tier: 'confirmed_urgent', reason: 'overnight_dip_sustained' };
  }

  const lastOvernightLow =
    overnightLowsRecent.length > 0
      ? overnightLowsRecent[overnightLowsRecent.length - 1]
      : null;

  const sampleBorderline =
    latestPercent >= SPO2_BORDERLINE_SAMPLE_LOW &&
    latestPercent <= SPO2_BORDERLINE_SAMPLE_HIGH;
  const overnightBorderline =
    lastOvernightLow !== null &&
    lastOvernightLow >= SPO2_BORDERLINE_OVERNIGHT_LOW &&
    lastOvernightLow <= SPO2_BORDERLINE_OVERNIGHT_HIGH;
  if (sampleBorderline || overnightBorderline) {
    return { tier: 'calm_concerned', reason: 'sample_or_overnight_borderline' };
  }

  const sampleHealthy = latestPercent >= SPO2_IN_PATTERN_SAMPLE_FLOOR;
  const overnightHealthy =
    lastOvernightLow === null || lastOvernightLow >= SPO2_IN_PATTERN_OVERNIGHT_FLOOR;
  if (sampleHealthy && overnightHealthy) {
    return { tier: 'in_pattern', reason: 'sample_and_overnight_in_band' };
  }

  return { tier: 'in_pattern', reason: 'sample_below_90_alone' };
}

// ─────────────────────────────────────────────────────────────────────
// Anomaly-event gate.

/**
 * Whether a (vital, tier) pair produces a persisted anomaly_events row
 * (and therefore a candidate push). Per D13 §11.1:
 *
 *   - bp, hr, spo2: calm_concerned + confirmed_urgent → event
 *   - sleep, activity: NEVER → no event, no push, no banner
 *
 * Single source of truth so detect-anomaly and the nightly cron can't
 * accidentally diverge.
 */
export function producesAnomalyEvent(
  vital: VitalKind,
  tier: ClassificationTier | 'no_data' | 'progress',
): boolean {
  if (vital === 'sleep' || vital === 'activity') return false;
  return tier === 'calm_concerned' || tier === 'confirmed_urgent';
}

/**
 * Per docs/10-anomaly-logic.md §3 dedup: if the most recent
 * anomaly_events row for (user_id, vital_kind) is within 4h AND the
 * incoming tier is calm_concerned, suppress. confirmed_urgent always
 * fires (a crisis-absolute can't be hidden behind a 4h dedup window).
 */
export function shouldDedupAnomaly(
  incomingTier: ClassificationTier,
  lastTriggeredAtSec: number | null,
  nowSec: number,
): boolean {
  if (incomingTier === 'confirmed_urgent') return false;
  if (lastTriggeredAtSec === null) return false;
  const FOUR_HOURS_SEC = 4 * 60 * 60;
  return nowSec - lastTriggeredAtSec < FOUR_HOURS_SEC;
}

// ─────────────────────────────────────────────────────────────────────
// Math helpers.

function mean(xs: number[]): number {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

function popStdDev(xs: number[], mu: number): number {
  if (xs.length === 0) return 0;
  const variance = xs.reduce((sum, x) => sum + (x - mu) * (x - mu), 0) / xs.length;
  return Math.sqrt(variance);
}
