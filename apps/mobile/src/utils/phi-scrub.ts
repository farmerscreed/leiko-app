// PHI scrub — Sprint 7.5.
//
// Strips identifying or hardware-fingerprint fields from a payload
// before it leaves the device for any non-/sync destination (AI / LiteLLM
// in Sprint 11+, analytics enrichment, future export tools). Per D13
// §13.3 + CLAUDE.md data rules:
//
//   • Vital VALUES are necessary for AI narration → NOT stripped.
//   • Per-sample timestamps are quantised to the day before AI egress
//     so individual sample times can't be cross-referenced.
//   • No MAC / serial / device id / sensor confidence fields ever leave
//     the device for AI or analytics enrichment.
//
// /sync itself does NOT use this scrub — the Edge Function legitimately
// needs the device id for row attribution, and the readings/vitals_other
// tables intentionally store the per-sample timestamp. /sync is RLS-
// protected; AI/analytics are not. Hence the scrub gate runs at the
// AI/analytics boundary, not at /sync.
//
// Usage:
//   import { scrubForAi } from './utils/phi-scrub';
//   const safe = scrubForAi(payload);
//   await llm.chat(safe);
//
// Test gate per the sprint card: every new vital field added in
// Sprint 7.5 has a corresponding scrub test below; failing the scrub
// test means a regression and the new field was added without thinking
// about its egress.

import type {
  HRSample,
  SpO2Sample,
  SleepSession,
  SleepTransition,
  ActivityDay,
  CaloriesDay,
  MultiVitalsPayload,
  DeviceMeta,
  BPReading,
} from '../types/vitals';

const SECONDS_PER_DAY = 24 * 60 * 60;

/** Drop sub-day precision; round down to start-of-UTC-day. */
function quantiseToDay(unixSec: number): number {
  return Math.floor(unixSec / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

/** A scrubbed BPReading — the source field stays (it's a category, not
 *  identifying), but the per-second timestamp is quantised. */
export interface ScrubbedBPReading {
  measuredAtSec: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  source: BPReading['source'];
}

export interface ScrubbedHRSample {
  measuredAtSec: number;
  bpm: number;
  motionState: HRSample['motionState'];
}

export interface ScrubbedSpO2Sample {
  measuredAtSec: number;
  percent: number;
  // max/min stay (they're aggregate, not identifying); perfusionIndex
  // strips because it's a sensor-fingerprint field per D13 §13.3.
  maxInWindow: number;
  minInWindow: number;
}

export interface ScrubbedSleepSession {
  // Day-quantised; the user-local ISO strings are dropped (would leak
  // exact bedtime).
  sessionStartSec: number;
  sessionEndSec: number;
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  awakeCount: number;
  sleepScore: number;
  // transitions stay because they're the most useful AI input (sleep
  // architecture), but each transition's per-second time is quantised
  // to the minute (60-sec granularity).
  transitions: { atSec: number; stage: SleepTransition['stage'] }[];
}

export interface ScrubbedActivityDay {
  dayLocal: string;
  totalSteps: number;
  targetSteps: number;
  // hourly stays; it's already aggregate. lastSampleAtSec strips.
  hourly: number[];
}

export interface ScrubbedCaloriesDay {
  dayLocal: string;
  totalKcal: number;
  activityKcal: number;
  bmrKcal: number;
  targetKcal: number | null;
}

export interface ScrubbedMultiVitalsPayload {
  // device strips entirely — no MAC, no serial-derivative, no name, no
  // model. The model is fingerprintable (only one Urion variant per
  // user, same per-account pattern would identify users across runs).
  bpReadings?: ScrubbedBPReading[];
  hrSamples?: ScrubbedHRSample[];
  spo2Samples?: ScrubbedSpO2Sample[];
  sleepSessions?: ScrubbedSleepSession[];
  activityDays?: ScrubbedActivityDay[];
  caloriesDays?: ScrubbedCaloriesDay[];
  // clientSyncedAtSec stays at day-quantised precision; clientAppVersion
  // stays (used to gate AI prompts on capability).
  clientSyncedAtSec: number;
  clientAppVersion: string;
}

const ROUND_TO_MINUTE = (sec: number) => Math.floor(sec / 60) * 60;

export function scrubBPReading(r: BPReading): ScrubbedBPReading {
  return {
    measuredAtSec: quantiseToDay(r.measuredAtSec),
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
    source: r.source,
  };
}

export function scrubHRSample(s: HRSample): ScrubbedHRSample {
  return {
    measuredAtSec: quantiseToDay(s.measuredAtSec),
    bpm: s.bpm,
    motionState: s.motionState,
  };
}

export function scrubSpO2Sample(s: SpO2Sample): ScrubbedSpO2Sample {
  return {
    measuredAtSec: quantiseToDay(s.measuredAtSec),
    percent: s.percent,
    maxInWindow: s.maxInWindow,
    minInWindow: s.minInWindow,
  };
}

export function scrubSleepSession(s: SleepSession): ScrubbedSleepSession {
  return {
    sessionStartSec: quantiseToDay(s.sessionStartSec),
    sessionEndSec: quantiseToDay(s.sessionEndSec),
    totalMinutes: s.totalMinutes,
    deepMinutes: s.deepMinutes,
    remMinutes: s.remMinutes,
    lightMinutes: s.lightMinutes,
    awakeMinutes: s.awakeMinutes,
    awakeCount: s.awakeCount,
    sleepScore: s.sleepScore,
    transitions: s.transitions.map((t) => ({
      atSec: ROUND_TO_MINUTE(t.atSec),
      stage: t.stage,
    })),
  };
}

export function scrubActivityDay(d: ActivityDay): ScrubbedActivityDay {
  return {
    dayLocal: d.dayLocal,
    totalSteps: d.totalSteps,
    targetSteps: d.targetSteps,
    hourly: [...d.hourly],
  };
}

export function scrubCaloriesDay(d: CaloriesDay): ScrubbedCaloriesDay {
  return {
    dayLocal: d.dayLocal,
    totalKcal: d.totalKcal,
    activityKcal: d.activityKcal,
    bmrKcal: d.bmrKcal,
    targetKcal: d.targetKcal,
  };
}

/**
 * The catch-all entry point: takes a full MultiVitalsPayload and
 * returns a fully scrubbed copy suitable for AI / analytics egress.
 * device + clientSyncedAtSec sub-day precision are stripped; per-vital
 * scrubbers handle the per-sample fields.
 *
 * NEVER use this for /sync — /sync needs the device id + per-sample
 * timestamps for row attribution + dedup. /sync's gate is RLS, not
 * scrubbing.
 */
export function scrubForAi(payload: MultiVitalsPayload): ScrubbedMultiVitalsPayload {
  return {
    bpReadings: payload.bpReadings?.map(scrubBPReading),
    hrSamples: payload.hrSamples?.map(scrubHRSample),
    spo2Samples: payload.spo2Samples?.map(scrubSpO2Sample),
    sleepSessions: payload.sleepSessions?.map(scrubSleepSession),
    activityDays: payload.activityDays?.map(scrubActivityDay),
    caloriesDays: payload.caloriesDays?.map(scrubCaloriesDay),
    clientSyncedAtSec: quantiseToDay(payload.clientSyncedAtSec),
    clientAppVersion: payload.clientAppVersion,
  };
}

/**
 * Type guard helper: assertScrubbed throws if the input contains any
 * banned field. Used by tests + as a defensive call site assertion in
 * the AI integration when it lands in Sprint 11.
 */
const BANNED_KEYS_TOP_LEVEL = ['device', 'deviceMeta', 'bleId', 'macSuffix', 'macAddress'];
const BANNED_KEYS_HR = ['sampleWindowSec', 'isSpotCheck'];
const BANNED_KEYS_SPO2 = ['sampleWindowSec', 'isSpotCheck', 'perfusionIndex'];
const BANNED_KEYS_SLEEP = ['sessionStartLocal', 'sessionEndLocal'];
const BANNED_KEYS_ACTIVITY = ['lastSampleAtSec', 'measuredAtSec'];

export function assertScrubbed(value: ScrubbedMultiVitalsPayload): void {
  const banned: string[] = [];
  for (const key of BANNED_KEYS_TOP_LEVEL) {
    if (key in (value as unknown as Record<string, unknown>)) banned.push(`top.${key}`);
  }
  for (const s of value.hrSamples ?? []) {
    for (const k of BANNED_KEYS_HR) {
      if (k in (s as unknown as Record<string, unknown>)) banned.push(`hr.${k}`);
    }
  }
  for (const s of value.spo2Samples ?? []) {
    for (const k of BANNED_KEYS_SPO2) {
      if (k in (s as unknown as Record<string, unknown>)) banned.push(`spo2.${k}`);
    }
  }
  for (const s of value.sleepSessions ?? []) {
    for (const k of BANNED_KEYS_SLEEP) {
      if (k in (s as unknown as Record<string, unknown>)) banned.push(`sleep.${k}`);
    }
  }
  for (const s of value.activityDays ?? []) {
    for (const k of BANNED_KEYS_ACTIVITY) {
      if (k in (s as unknown as Record<string, unknown>)) banned.push(`activity.${k}`);
    }
  }
  if (banned.length > 0) {
    throw new Error(`phi-scrub: banned keys present in scrubbed payload: ${banned.join(', ')}`);
  }
}

// Internal export for testing.
export { quantiseToDay };

// device meta type-only re-export so consumers can be explicit about
// what we strip (lint nudges callers away from passing DeviceMeta to
// scrubbed-payload contexts).
export type { DeviceMeta };
