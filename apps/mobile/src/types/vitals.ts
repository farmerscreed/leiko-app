// Multi-vitals payload types — Sprint 7.5.
//
// Per docs/_reference/D13-multi-vitals-constellation-spec.md §2 (data
// shapes), §3.4 (per-vital cursor), §4.2 (MultiVitalsPayload).
//
// Numeric ranges in the comments are server-rejection thresholds per
// D13 §4.4 — they're enforced in supabase/functions/_shared/vital-
// validators.ts, not in these types. Types stay flexible; the wire
// gate is the validator.
//
// Time encoding rules (READ ME before adding a new vital):
//   • Per-sample vitals (BP, HR) carry `*Sec` fields in TRUE UTC,
//     post the watch-firmware-timestamp shift in
//     services/sync/syncBacklog.ts watchTimestampToUtcSec.
//   • Per-day vitals (SpO2 daily, sleep, activity, calories) carry
//     `dayLocal` in 'YYYY-MM-DD' (user-local) plus `measuredAtSec`
//     for start-of-day — the firmware quirk does NOT apply at the
//     daily boundary, per D13 §3.5.
//   • SpO2 samples within a day are per-sample → also pass through
//     watchTimestampToUtcSec when streamed via 0x73.

export interface BPReading {
  /** unix sec UTC, post watch-firmware shift */
  measuredAtSec: number;
  /** 30-300 (server-validated) */
  systolic: number;
  /** 20-200 (server-validated) */
  diastolic: number;
  /** 30-240 (server-validated); null when watch did not report it */
  pulse: number | null;
  source: 'watch' | 'manual';
}

export type HRMotionState = 'rest' | 'light' | 'moderate' | 'vigorous' | 'unknown';

export interface HRSample {
  /** unix sec UTC, post watch-firmware shift */
  measuredAtSec: number;
  /** 30-220 (server-validated). Per D13 §2.2 valid range 40-220 — the
   * lower 30 floor matches BP-pulse for sensor-noise tolerance. */
  bpm: number;
  /** Window the sample summarises. 1 for spot, 30 for auto-sample. */
  sampleWindowSec: number;
  motionState: HRMotionState;
  /** True when user pressed "Take HR" on the watch face. */
  isSpotCheck: boolean;
}

export interface SpO2Sample {
  /** unix sec UTC, post watch-firmware shift */
  measuredAtSec: number;
  /** 70-100 (server-validated); average for the sample window. */
  percent: number;
  /** Max within the sample window. */
  maxInWindow: number;
  /** Min within the sample window. */
  minInWindow: number;
  sampleWindowSec: number;
  isSpotCheck: boolean;
  /** Sensor confidence; null when watch firmware did not report. */
  perfusionIndex: number | null;
}

export type SleepStage = 'light' | 'deep' | 'rem' | 'awake';

export interface SleepTransition {
  /** unix sec UTC */
  atSec: number;
  stage: SleepStage;
}

export interface SleepSession {
  /** unix sec UTC; session start. */
  sessionStartSec: number;
  /** unix sec UTC; session end. */
  sessionEndSec: number;
  /** ISO with offset; for display in the user's locale. */
  sessionStartLocal: string;
  sessionEndLocal: string;
  /** 30-1080 (server-validated). */
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  /** Number of wake events during the session. */
  awakeCount: number;
  transitions: SleepTransition[];
  /** 0-100, computed per D13 §6.4. */
  sleepScore: number;
}

export interface ActivityDay {
  /** 'YYYY-MM-DD' in the user's local timezone. */
  dayLocal: string;
  /** Start-of-day in user-local, expressed as unix sec UTC. */
  measuredAtSec: number;
  /** 0-100,000 (server-validated). */
  totalSteps: number;
  /** User-set goal; default 6000 per Q-D13-1. */
  targetSteps: number;
  /** unix sec UTC of the most recent step sample contributing to this row. */
  lastSampleAtSec: number;
  /** Length 24, steps per hour 00-23 in user-local time. */
  hourly: number[];
}

export interface CaloriesDay {
  dayLocal: string;
  measuredAtSec: number;
  /** 0-10,000 (server-validated). */
  totalKcal: number;
  /** Active calories (movement-derived). */
  activityKcal: number;
  /** Basal estimate from setUserParams. */
  bmrKcal: number;
  /** User-set goal; null until set. */
  targetKcal: number | null;
}

export interface DeviceMeta {
  bleId: string;
  macSuffix: string;
  name: string | null;
  model: 'U16H' | 'U19M';
}

/**
 * /sync request payload after Sprint 7.5. Each array is independently
 * optional — a payload with only HR samples is valid, as is the
 * Sprint-6-style BP-only payload (omit everything except bpReadings).
 *
 * The Edge Function also accepts the legacy `{ device, reading }`
 * single-BP shape from Sprint 6 (discriminator on shape) — see
 * supabase/functions/sync/index.ts. New callers should always use
 * MultiVitalsPayload.
 */
export interface MultiVitalsPayload {
  device: DeviceMeta;
  bpReadings?: BPReading[];
  hrSamples?: HRSample[];
  spo2Samples?: SpO2Sample[];
  sleepSessions?: SleepSession[];
  activityDays?: ActivityDay[];
  caloriesDays?: CaloriesDay[];
  /** unix sec UTC at which the client packed this payload. */
  clientSyncedAtSec: number;
  clientAppVersion: string;
}

/**
 * Per-device sync cursor — D13 §3.4. Replaces the BP-only number map
 * stored at STORAGE_KEYS.lastSyncByDevice.
 *
 * `bp` and `hr` carry RAW watch-firmware seconds (NOT post-shift) so
 * the next 0x14/0x15 sinceTimestampSec request matches the watch's
 * storage format byte-for-byte. SpO2/sleep/activity carry 'YYYY-MM-DD'
 * in user-local time because their BLE wrappers are per-day, not
 * per-sample.
 *
 * Empty string ('' for the day cursors, 0 for hr) means "no successful
 * sync yet for this vital on this device" — the next sync pulls the
 * widest available window per protocol defaults.
 */
export interface VitalSyncCursor {
  /** unix sec, RAW watch-firmware format (pre-shift). */
  bp: number;
  /** unix sec, RAW watch-firmware format (pre-shift). */
  hr: number;
  /** 'YYYY-MM-DD' user-local; '' before first sync. */
  spo2: string;
  /** 'YYYY-MM-DD' user-local; '' before first sync. */
  sleep: string;
  /** 'YYYY-MM-DD' user-local; '' before first sync. */
  activity: string;
}

export type VitalKind = 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity' | 'calories';
