// Server-side validators per D13 §4.4 — Sprint 7.5.
//
// Pure functions only. No I/O, no logging side-effects. The Edge Function
// (`supabase/functions/sync/index.ts`) calls these on each incoming
// vital array; rejected items become `audit_log` rows + a PostHog
// `multi_vital_invalid_sample` event upstream.
//
// Why a separate module:
//  • Deterministic to unit-test (validator-only Deno test suite).
//  • Same accept/reject rules feed the audit-log writer, so a single
//    source of truth for "what's valid" cannot drift between the insert
//    path and the rejection-counting path.
//  • Keeps index.ts focused on auth + DB orchestration.
//
// Voice: rejection reasons are machine codes (`bpm_out_of_range`), not
// user-facing strings. Per D13 §4.4 silent-drop, the user never sees
// these; they exist only for ops monitoring.

import type {
  BPReading,
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
  CaloriesDay,
} from './vital-types.ts';

export interface RejectedSample {
  /** Index in the original input array. Useful for client-side debug. */
  idx: number;
  /** Machine-readable code. Stable across versions; new codes mean a
   *  new validator branch. Add a unit test before adding a code. */
  reason: string;
}

export interface ValidationResult<T> {
  accepted: T[];
  rejected: RejectedSample[];
}

// ────────────────────────────────────────────────────────────────────
// Shared shape guards — every vital needs a real timestamp; otherwise
// the dedupe index has nothing to anchor on.

function hasValidMeasuredAt(v: { measuredAtSec?: unknown }): boolean {
  return (
    typeof v.measuredAtSec === 'number' &&
    Number.isFinite(v.measuredAtSec) &&
    v.measuredAtSec > 0
  );
}

// ────────────────────────────────────────────────────────────────────
// BP — D13 §2.1 / §4.4 (the existing /sync inline check, lifted here so
// the multi-vitals path uses the same gate).

export function validateBPReadings(readings: BPReading[]): ValidationResult<BPReading> {
  const accepted: BPReading[] = [];
  const rejected: RejectedSample[] = [];
  readings.forEach((r, idx) => {
    if (!hasValidMeasuredAt(r)) {
      rejected.push({ idx, reason: 'missing_measured_at' });
      return;
    }
    if (typeof r.systolic !== 'number' || r.systolic < 30 || r.systolic > 300) {
      rejected.push({ idx, reason: 'systolic_out_of_range' });
      return;
    }
    if (typeof r.diastolic !== 'number' || r.diastolic < 20 || r.diastolic > 200) {
      rejected.push({ idx, reason: 'diastolic_out_of_range' });
      return;
    }
    if (
      r.pulse != null &&
      (typeof r.pulse !== 'number' || r.pulse < 30 || r.pulse > 240)
    ) {
      rejected.push({ idx, reason: 'pulse_out_of_range' });
      return;
    }
    accepted.push(r);
  });
  return { accepted, rejected };
}

// ────────────────────────────────────────────────────────────────────
// HR — D13 §4.4: bpm < 30 OR > 220 → reject (sensor noise). The 30
// floor matches BP-pulse so the sensor-noise tolerance is consistent.

export function validateHRSamples(samples: HRSample[]): ValidationResult<HRSample> {
  const accepted: HRSample[] = [];
  const rejected: RejectedSample[] = [];
  samples.forEach((s, idx) => {
    if (!hasValidMeasuredAt(s)) {
      rejected.push({ idx, reason: 'missing_measured_at' });
      return;
    }
    if (typeof s.bpm !== 'number' || s.bpm < 30 || s.bpm > 220) {
      rejected.push({ idx, reason: 'bpm_out_of_range' });
      return;
    }
    accepted.push(s);
  });
  return { accepted, rejected };
}

// ────────────────────────────────────────────────────────────────────
// SpO2 — D13 §4.4: percent < 70 OR > 100 → reject.

export function validateSpO2Samples(samples: SpO2Sample[]): ValidationResult<SpO2Sample> {
  const accepted: SpO2Sample[] = [];
  const rejected: RejectedSample[] = [];
  samples.forEach((s, idx) => {
    if (!hasValidMeasuredAt(s)) {
      rejected.push({ idx, reason: 'missing_measured_at' });
      return;
    }
    if (typeof s.percent !== 'number' || s.percent < 70 || s.percent > 100) {
      rejected.push({ idx, reason: 'percent_out_of_range' });
      return;
    }
    accepted.push(s);
  });
  return { accepted, rejected };
}

// ────────────────────────────────────────────────────────────────────
// Sleep — D13 §4.4: total_minutes < 30 OR > 18*60 (1080) → reject.
// "Too short to be a real session" / "physically impossible".

const SLEEP_MIN_MINUTES = 30;
const SLEEP_MAX_MINUTES = 18 * 60;

export function validateSleepSessions(sessions: SleepSession[]): ValidationResult<SleepSession> {
  const accepted: SleepSession[] = [];
  const rejected: RejectedSample[] = [];
  sessions.forEach((s, idx) => {
    if (typeof s.sessionStartSec !== 'number' || s.sessionStartSec <= 0) {
      rejected.push({ idx, reason: 'missing_session_start' });
      return;
    }
    if (typeof s.sessionEndSec !== 'number' || s.sessionEndSec <= s.sessionStartSec) {
      rejected.push({ idx, reason: 'invalid_session_end' });
      return;
    }
    if (
      typeof s.totalMinutes !== 'number' ||
      s.totalMinutes < SLEEP_MIN_MINUTES ||
      s.totalMinutes > SLEEP_MAX_MINUTES
    ) {
      rejected.push({ idx, reason: 'total_minutes_out_of_range' });
      return;
    }
    accepted.push(s);
  });
  return { accepted, rejected };
}

// ────────────────────────────────────────────────────────────────────
// Activity (steps_day) — D13 §4.4: < 0 OR > 100,000 → reject.

const STEPS_MAX = 100_000;

export function validateActivityDays(days: ActivityDay[]): ValidationResult<ActivityDay> {
  const accepted: ActivityDay[] = [];
  const rejected: RejectedSample[] = [];
  days.forEach((d, idx) => {
    if (typeof d.measuredAtSec !== 'number' || d.measuredAtSec <= 0) {
      rejected.push({ idx, reason: 'missing_measured_at' });
      return;
    }
    if (
      typeof d.totalSteps !== 'number' ||
      d.totalSteps < 0 ||
      d.totalSteps > STEPS_MAX
    ) {
      rejected.push({ idx, reason: 'steps_out_of_range' });
      return;
    }
    accepted.push(d);
  });
  return { accepted, rejected };
}

// ────────────────────────────────────────────────────────────────────
// Calories (calories_day) — D13 §4.4: < 0 OR > 10,000 → reject.

const KCAL_MAX = 10_000;

export function validateCaloriesDays(days: CaloriesDay[]): ValidationResult<CaloriesDay> {
  const accepted: CaloriesDay[] = [];
  const rejected: RejectedSample[] = [];
  days.forEach((d, idx) => {
    if (typeof d.measuredAtSec !== 'number' || d.measuredAtSec <= 0) {
      rejected.push({ idx, reason: 'missing_measured_at' });
      return;
    }
    if (
      typeof d.totalKcal !== 'number' ||
      d.totalKcal < 0 ||
      d.totalKcal > KCAL_MAX
    ) {
      rejected.push({ idx, reason: 'kcal_out_of_range' });
      return;
    }
    accepted.push(d);
  });
  return { accepted, rejected };
}
