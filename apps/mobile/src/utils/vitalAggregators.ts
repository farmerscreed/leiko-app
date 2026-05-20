// utils/vitalAggregators — Sprint 17a.
//
// Pure helpers for the per-vital aggregator semantics currently
// implemented as methods on the Zustand slices (`state/hr.ts`,
// `state/spo2.ts`, `state/sleep.ts`, `state/activity.ts`). Extracted
// here so the family-scoped fetcher
// (`services/families/fetchParentPulseData`) can compute the same
// values from server-fetched data WITHOUT writing to the singleton
// slices.
//
// Pure-function-style — no Zustand, no MMKV, no React. Inputs: a
// list of typed samples + `nowSec`. Outputs: numbers / arrays /
// nullables, matching the existing slice method signatures so a
// future refactor can collapse the slice copies into delegations
// without changing call-site contracts.
//
// IMPORTANT — semantics MUST stay in lockstep with the slices. If a
// constant changes in `state/hr.ts` (e.g. RESTING_RECENT_DAYS), it
// has to change here too. The current duplication is intentional v1
// scope; tracked as a follow-up refactor.

import type {
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
} from '../types/vitals';

const SECONDS_PER_DAY = 24 * 60 * 60;

// ----- HR ---------------------------------------------------------
// Mirrored from state/hr.ts:
//   SLEEP_WINDOW_START_HOUR = 22
//   SLEEP_WINDOW_END_HOUR   = 6
//   ROLLING_WINDOW_SEC      = 10 * 60
//   RESTING_RECENT_DAYS     = 14
const HR_SLEEP_WINDOW_START_HOUR = 22;
const HR_SLEEP_WINDOW_END_HOUR = 6;
const HR_ROLLING_WINDOW_SEC = 10 * 60;
const HR_RESTING_RECENT_DAYS = 14;

// ----- SpO2 -------------------------------------------------------
const SPO2_OVERNIGHT_START_HOUR = 22;
const SPO2_OVERNIGHT_END_HOUR = 6;
const SPO2_DEFAULT_NIGHTS = 14;

// ----- Sleep ------------------------------------------------------
const SLEEP_LAST_NIGHT_LOOKBACK_SEC = 36 * 60 * 60;

// ----- Shared helpers --------------------------------------------

function inHRSleepWindow(measuredAtSec: number): boolean {
  const hr = new Date(measuredAtSec * 1000).getUTCHours();
  return hr >= HR_SLEEP_WINDOW_START_HOUR || hr < HR_SLEEP_WINDOW_END_HOUR;
}

function inSpO2OvernightWindow(measuredAtSec: number): boolean {
  const hr = new Date(measuredAtSec * 1000).getUTCHours();
  return hr >= SPO2_OVERNIGHT_START_HOUR || hr < SPO2_OVERNIGHT_END_HOUR;
}

/** Sleep / overnight "night identity": evening samples (hr >= window
 *  start) belong to the next UTC date (their "owning morning"); early-
 *  morning samples (hr < window end) stay on the same UTC date.
 *  Matches the convention in `state/hr.ts` + `state/spo2.ts`. */
function nightDateKey(measuredAtSec: number, windowStartHour: number): string {
  const d = new Date(measuredAtSec * 1000);
  const hr = d.getUTCHours();
  const anchored = hr >= windowStartHour
    ? new Date(d.getTime() + SECONDS_PER_DAY * 1000)
    : d;
  return anchored.toISOString().slice(0, 10);
}

/** Lowest 10-min rolling-average HR across a sample list. Mirrors
 *  the local helper in state/hr.ts. Returns null if fewer than 2
 *  samples land in any window. */
function rollingMinAverage(samples: HRSample[]): number | null {
  if (samples.length < 2) return null;
  const sorted = [...samples].sort((a, b) => a.measuredAtSec - b.measuredAtSec);
  let lo = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const windowEnd = sorted[i].measuredAtSec;
    const windowStart = windowEnd - HR_ROLLING_WINDOW_SEC;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (sorted[j].measuredAtSec < windowStart) break;
      sum += sorted[j].bpm;
      n += 1;
    }
    if (n >= 2) {
      const avg = sum / n;
      if (avg < lo) lo = avg;
    }
  }
  return Number.isFinite(lo) ? lo : null;
}

// ----- Public API ------------------------------------------------

export function computeHRRestingToday(
  samples: HRSample[],
  nowSec: number,
): number | null {
  if (samples.length < 2) return null;
  const todayKey = nightDateKey(nowSec, HR_SLEEP_WINDOW_START_HOUR);
  const windowSamples = samples.filter(
    (s) =>
      inHRSleepWindow(s.measuredAtSec) &&
      nightDateKey(s.measuredAtSec, HR_SLEEP_WINDOW_START_HOUR) === todayKey,
  );
  if (windowSamples.length < 2) return null;
  return rollingMinAverage(windowSamples);
}

export function computeHRRestingRecent(
  samples: HRSample[],
  nowSec: number,
): number[] {
  if (samples.length === 0) return [];
  const byNight = new Map<string, HRSample[]>();
  for (const s of samples) {
    if (!inHRSleepWindow(s.measuredAtSec)) continue;
    const key = nightDateKey(s.measuredAtSec, HR_SLEEP_WINDOW_START_HOUR);
    const arr = byNight.get(key);
    if (arr) arr.push(s);
    else byNight.set(key, [s]);
  }
  const todayKey = nightDateKey(nowSec, HR_SLEEP_WINDOW_START_HOUR);
  const out: number[] = [];
  for (let d = HR_RESTING_RECENT_DAYS; d >= 1; d--) {
    const nightKey = nightDateKey(
      nowSec - d * SECONDS_PER_DAY,
      HR_SLEEP_WINDOW_START_HOUR,
    );
    if (nightKey === todayKey) continue;
    const ns = byNight.get(nightKey);
    if (!ns || ns.length < 2) continue;
    const avg = rollingMinAverage(ns);
    if (avg === null) continue;
    out.push(avg);
  }
  return out;
}

export function computeHRLatestSampleAt(samples: HRSample[]): number | null {
  if (samples.length === 0) return null;
  return samples.reduce((a, b) =>
    b.measuredAtSec > a.measuredAtSec ? b : a,
  ).measuredAtSec;
}

export function computeSpO2LatestPercent(
  samples: SpO2Sample[],
): number | null {
  if (samples.length === 0) return null;
  return samples.reduce((a, b) =>
    b.measuredAtSec > a.measuredAtSec ? b : a,
  ).percent;
}

export function computeSpO2LatestSampleAt(
  samples: SpO2Sample[],
): number | null {
  if (samples.length === 0) return null;
  return samples.reduce((a, b) =>
    b.measuredAtSec > a.measuredAtSec ? b : a,
  ).measuredAtSec;
}

export function computeSpO2OvernightLowsRecent(
  samples: SpO2Sample[],
  nowSec: number,
  nights: number = SPO2_DEFAULT_NIGHTS,
): number[] {
  if (samples.length === 0) return [];
  const byNight = new Map<string, SpO2Sample[]>();
  for (const s of samples) {
    if (!inSpO2OvernightWindow(s.measuredAtSec)) continue;
    const key = nightDateKey(s.measuredAtSec, SPO2_OVERNIGHT_START_HOUR);
    const arr = byNight.get(key);
    if (arr) arr.push(s);
    else byNight.set(key, [s]);
  }
  const out: number[] = [];
  for (let d = nights; d >= 0; d--) {
    const key = nightDateKey(
      nowSec - d * SECONDS_PER_DAY,
      SPO2_OVERNIGHT_START_HOUR,
    );
    const ns = byNight.get(key);
    if (!ns || ns.length === 0) continue;
    out.push(Math.min(...ns.map((s) => s.percent)));
  }
  return out;
}

export function computeSleepLastNight(
  sessions: SleepSession[],
  nowSec: number,
): SleepSession | null {
  if (sessions.length === 0) return null;
  const inWindow = sessions.filter(
    (s) =>
      nowSec - s.sessionEndSec <= SLEEP_LAST_NIGHT_LOOKBACK_SEC &&
      s.sessionEndSec <= nowSec,
  );
  if (inWindow.length === 0) return null;
  return inWindow.reduce((a, b) => (b.sessionEndSec > a.sessionEndSec ? b : a));
}

export function computeActivityToday(
  days: ActivityDay[],
  nowSec: number,
): ActivityDay | null {
  if (days.length === 0) return null;
  const todayLocal = new Date(nowSec * 1000).toISOString().slice(0, 10);
  return days.find((d) => d.dayLocal === todayLocal) ?? null;
}
