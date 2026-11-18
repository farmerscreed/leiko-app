// Maps validated typed payload arrays → vitals_other / readings row
// shapes. Pure functions, no I/O.
//
// Per docs/01-data-model.md: vitals_other has columns
// (device_id, vital_type, measured_at, value_int, value_int_2,
//  value_int_3, value_jsonb). Schema is normalised via the vital_type
// enum from migration 0001 (`'hr','spo2','sleep_session','steps_day',
// 'calories_day'`). The readings table holds BP only (legacy schema
// preserved per D13 §2.1).
//
// Per CLAUDE.md voice + data rules: nothing here logs values; the
// edge-function audit-log writer logs only counts + reasons.

import type {
  BPReading,
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
  CaloriesDay,
  RestPeriod,
} from './vital-types.ts';

export interface VitalsOtherRow {
  family_id: string;
  device_id: string;
  vital_type: 'hr' | 'spo2' | 'sleep_session' | 'steps_day' | 'calories_day' | 'rest_period';
  measured_at: string;
  value_int: number | null;
  value_int_2: number | null;
  value_int_3: number | null;
  value_jsonb: Record<string, unknown>;
}

export interface ReadingsRow {
  family_id: string;
  device_id: string;
  source: 'watch' | 'manual';
  measured_at: string;
  measured_at_local: string | null;
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

function toIso(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString();
}

export function mapHRSamples(
  samples: HRSample[],
  familyId: string,
  deviceId: string,
): VitalsOtherRow[] {
  return samples.map((s) => ({
    family_id: familyId,
    device_id: deviceId,
    vital_type: 'hr',
    measured_at: toIso(s.measuredAtSec),
    value_int: s.bpm,
    value_int_2: null,
    value_int_3: null,
    value_jsonb: {
      sample_window_sec: s.sampleWindowSec,
      motion_state: s.motionState,
      is_spot_check: s.isSpotCheck,
    },
  }));
}

export function mapSpO2Samples(
  samples: SpO2Sample[],
  familyId: string,
  deviceId: string,
): VitalsOtherRow[] {
  return samples.map((s) => ({
    family_id: familyId,
    device_id: deviceId,
    vital_type: 'spo2',
    measured_at: toIso(s.measuredAtSec),
    value_int: s.percent,
    value_int_2: s.maxInWindow,
    value_int_3: s.minInWindow,
    value_jsonb: {
      sample_window_sec: s.sampleWindowSec,
      is_spot_check: s.isSpotCheck,
      perfusion_index: s.perfusionIndex,
    },
  }));
}

export function mapSleepSessions(
  sessions: SleepSession[],
  familyId: string,
  deviceId: string,
): VitalsOtherRow[] {
  return sessions.map((s) => ({
    family_id: familyId,
    device_id: deviceId,
    vital_type: 'sleep_session',
    // measured_at = session END (the synthesized ~08:00 wake), NOT the
    // start. Data-completeness fix: the watch's 0x07 reply has no real
    // bed/wake; the client synthesizes end = 08:00 and start = end - total,
    // so the START drifts whenever `total` changes across re-reads and
    // produced a NEW row per sync (one night fragmented into many). The END
    // is constant per night, so it is the stable dedup key — re-reads now
    // collide and reconcile one row (the fullest, via the no-shrink guard +
    // mutable upsert in sync/index.ts). Supersedes the old D13 §2.4
    // "measured_at = start" convention. The actual start/end epochs are
    // preserved in value_jsonb.session_{start,end}_local. measured_at is a
    // NIGHT-IDENTITY key, never shown as a real wake time (display is
    // HR-inferred only).
    measured_at: toIso(s.sessionEndSec),
    value_int: s.totalMinutes,
    value_int_2: s.deepMinutes,
    value_int_3: s.remMinutes,
    value_jsonb: {
      session_start_local: s.sessionStartLocal,
      session_end_local: s.sessionEndLocal,
      light_minutes: s.lightMinutes,
      awake_minutes: s.awakeMinutes,
      awake_count: s.awakeCount,
      transitions: s.transitions,
      sleep_score: s.sleepScore,
      ...inferredSleepTimes(s),
    },
  }));
}

/** Longest plausible inferred session; anything longer is dropped. */
const MAX_INFERRED_SESSION_SEC = 20 * 3600;

/** The phone's heart-rate-inferred bed / wake times, when present and
 *  sane. Added 2026-11-18 — before this they never left the phone, so
 *  the doctor report, family view and AI only saw the synthetic 08:00. */
export function inferredSleepTimes(s: SleepSession): Record<string, string> {
  const start = s.inferredSessionStartSec;
  const end = s.inferredSessionEndSec;
  if (
    typeof start !== 'number' || typeof end !== 'number' ||
    !Number.isFinite(start) || !Number.isFinite(end) ||
    start <= 0 || end <= start || end - start > MAX_INFERRED_SESSION_SEC
  ) {
    return {};
  }
  const out: Record<string, string> = {
    inferred_start: toIso(start),
    inferred_end: toIso(end),
  };
  if (s.wakeSource === 'hr_inferred' || s.wakeSource === 'fallback') {
    out.wake_source = s.wakeSource;
  }
  return out;
}

/** Rest periods → vitals_other 'rest_period' rows (migration 0061).
 *  measured_at = start (immutable point, dedupe with device_id). */
export function mapRestPeriods(
  periods: RestPeriod[],
  familyId: string,
  deviceId: string,
): VitalsOtherRow[] {
  return periods.map((p) => ({
    family_id: familyId,
    device_id: deviceId,
    vital_type: 'rest_period',
    measured_at: toIso(p.startSec),
    value_int: Math.round((p.endSec - p.startSec) / 60),
    value_int_2: Math.round(p.avgBpm),
    value_int_3: null,
    value_jsonb: {
      end: toIso(p.endSec),
      confidence: p.confidence,
      baseline_bpm: p.baselineBpm,
      day_local: p.dayLocal,
    },
  }));
}

export function mapActivityDays(
  days: ActivityDay[],
  familyId: string,
  deviceId: string,
): VitalsOtherRow[] {
  return days.map((d) => ({
    family_id: familyId,
    device_id: deviceId,
    vital_type: 'steps_day',
    measured_at: toIso(d.measuredAtSec),
    value_int: d.totalSteps,
    value_int_2: null,
    value_int_3: null,
    value_jsonb: {
      day_local: d.dayLocal,
      target_steps: d.targetSteps,
      last_sample_at: toIso(d.lastSampleAtSec),
      hourly: d.hourly,
    },
  }));
}

export function mapCaloriesDays(
  days: CaloriesDay[],
  familyId: string,
  deviceId: string,
): VitalsOtherRow[] {
  return days.map((d) => ({
    family_id: familyId,
    device_id: deviceId,
    vital_type: 'calories_day',
    measured_at: toIso(d.measuredAtSec),
    value_int: d.totalKcal,
    value_int_2: null,
    value_int_3: null,
    value_jsonb: {
      day_local: d.dayLocal,
      target_kcal: d.targetKcal,
      activity_kcal: d.activityKcal,
      bmr_kcal: d.bmrKcal,
    },
  }));
}

export function mapBPReadings(
  readings: BPReading[],
  familyId: string,
  deviceId: string,
): ReadingsRow[] {
  return readings.map((r) => {
    const iso = toIso(r.measuredAtSec);
    return {
      family_id: familyId,
      device_id: deviceId,
      source: r.source,
      measured_at: iso,
      // Data-completeness cleanup: measured_at_local used to mirror UTC
      // with a 'Z' suffix — wrong data under a "local" name. Nothing reads
      // it; render-side localisation now happens in the app from
      // measured_at + the wearer's users.timezone. NULL until a properly
      // tz-wired implementation exists (don't store a wrong value).
      measured_at_local: null,
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
    };
  });
}
