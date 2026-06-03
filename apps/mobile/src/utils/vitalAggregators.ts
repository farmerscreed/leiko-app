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
import { hourInZone, dayKeyInZone } from './timeInZone';

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

// Data-completeness fix: these read the hour-of-day / calendar day in the
// wearer's `timeZone`, not UTC. Previously getUTCHours()/toISOString() made
// "today" and the overnight window start at UTC midnight/22:00 — wrong for
// any non-UTC user (e.g. Lagos UTC+1, New York UTC-4). The self-path slices
// (state/hr.ts etc.) already take a tz; this brings the caregiver-path
// aggregators in line. `timeZone` empty/invalid → UTC (resolveTimeZone).
function inHRSleepWindow(measuredAtSec: number, timeZone: string): boolean {
  const hr = hourInZone(measuredAtSec * 1000, timeZone);
  return hr >= HR_SLEEP_WINDOW_START_HOUR || hr < HR_SLEEP_WINDOW_END_HOUR;
}

function inSpO2OvernightWindow(measuredAtSec: number, timeZone: string): boolean {
  const hr = hourInZone(measuredAtSec * 1000, timeZone);
  return hr >= SPO2_OVERNIGHT_START_HOUR || hr < SPO2_OVERNIGHT_END_HOUR;
}

/** Sleep / overnight "night identity" in the wearer's `timeZone`: evening
 *  samples (local hr >= window start) belong to the next local date (their
 *  "owning morning"); early-morning samples (local hr < window end) stay on
 *  the same local date. Matches the convention in `state/hr.ts` +
 *  `state/spo2.ts` (which key off the user tz). */
function nightDateKey(
  measuredAtSec: number,
  windowStartHour: number,
  timeZone: string,
): string {
  const ms = measuredAtSec * 1000;
  const hr = hourInZone(ms, timeZone);
  const anchorMs = hr >= windowStartHour ? ms + SECONDS_PER_DAY * 1000 : ms;
  return dayKeyInZone(anchorMs, timeZone);
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
  timeZone: string,
): number | null {
  if (samples.length < 2) return null;
  const todayKey = nightDateKey(nowSec, HR_SLEEP_WINDOW_START_HOUR, timeZone);
  const windowSamples = samples.filter(
    (s) =>
      inHRSleepWindow(s.measuredAtSec, timeZone) &&
      nightDateKey(s.measuredAtSec, HR_SLEEP_WINDOW_START_HOUR, timeZone) === todayKey,
  );
  if (windowSamples.length < 2) return null;
  return rollingMinAverage(windowSamples);
}

export function computeHRRestingRecent(
  samples: HRSample[],
  nowSec: number,
  timeZone: string,
): number[] {
  if (samples.length === 0) return [];
  const byNight = new Map<string, HRSample[]>();
  for (const s of samples) {
    if (!inHRSleepWindow(s.measuredAtSec, timeZone)) continue;
    const key = nightDateKey(s.measuredAtSec, HR_SLEEP_WINDOW_START_HOUR, timeZone);
    const arr = byNight.get(key);
    if (arr) arr.push(s);
    else byNight.set(key, [s]);
  }
  const todayKey = nightDateKey(nowSec, HR_SLEEP_WINDOW_START_HOUR, timeZone);
  const out: number[] = [];
  for (let d = HR_RESTING_RECENT_DAYS; d >= 1; d--) {
    const nightKey = nightDateKey(
      nowSec - d * SECONDS_PER_DAY,
      HR_SLEEP_WINDOW_START_HOUR,
      timeZone,
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

/** bpm of the most recent HR sample (any time of day). Mirrors
 *  computeHRLatestSampleAt but returns `.bpm`. Drives the "latest"
 *  rung of the HR display fallback for parent-scoped data. */
export function computeHRLatestBpm(samples: HRSample[]): number | null {
  if (samples.length === 0) return null;
  return samples.reduce((a, b) =>
    b.measuredAtSec > a.measuredAtSec ? b : a,
  ).bpm;
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
  timeZone: string,
  nights: number = SPO2_DEFAULT_NIGHTS,
): number[] {
  if (samples.length === 0) return [];
  const byNight = new Map<string, SpO2Sample[]>();
  for (const s of samples) {
    if (!inSpO2OvernightWindow(s.measuredAtSec, timeZone)) continue;
    const key = nightDateKey(s.measuredAtSec, SPO2_OVERNIGHT_START_HOUR, timeZone);
    const arr = byNight.get(key);
    if (arr) arr.push(s);
    else byNight.set(key, [s]);
  }
  const out: number[] = [];
  for (let d = nights; d >= 0; d--) {
    const key = nightDateKey(
      nowSec - d * SECONDS_PER_DAY,
      SPO2_OVERNIGHT_START_HOUR,
      timeZone,
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
  timeZone: string,
): SleepSession | null {
  if (sessions.length === 0) return null;
  const inWindow = sessions.filter(
    (s) =>
      nowSec - s.sessionEndSec <= SLEEP_LAST_NIGHT_LOOKBACK_SEC &&
      s.sessionEndSec <= nowSec,
  );
  if (inWindow.length === 0) return null;
  // Vitals data-completeness fix: a single night can carry MULTIPLE
  // overlapping sleep_session rows. The watch re-reports the same night
  // across syncs with a drifting start time (e.g. 06:36→07:14, all ending
  // 08:00), and measured_at = session start is the dedup key, so each
  // variant becomes its own row. They overlap (all share the same wake),
  // so the longest is the most-complete superset — summing would
  // double-count, and picking by latest end (the old behaviour) could
  // surface the SHORTEST fragment and badly understate sleep.
  //
  // So: take the most recent night (by the wake morning = sessionEndSec's
  // date), then within that night return the fullest session by
  // totalMinutes. Mirrors computeActivityToday's max-pick against shadows.
  const wakeDate = (s: SleepSession) =>
    dayKeyInZone(s.sessionEndSec * 1000, timeZone);
  const latestNight = inWindow.reduce((a, b) =>
    b.sessionEndSec > a.sessionEndSec ? b : a,
  );
  const latestWake = wakeDate(latestNight);
  return inWindow
    .filter((s) => wakeDate(s) === latestWake)
    .reduce((a, b) => (b.totalMinutes > a.totalMinutes ? b : a));
}

export function computeActivityToday(
  days: ActivityDay[],
  nowSec: number,
  timeZone: string,
): ActivityDay | null {
  if (days.length === 0) return null;
  // "Today" in the wearer's tz — `d.dayLocal` is already a local YYYY-MM-DD,
  // so comparing against a UTC-derived date (the old toISOString) mismatched
  // near local midnight and could blank the day's steps.
  const todayLocal = dayKeyInZone(nowSec * 1000, timeZone);
  // There can be MORE than one row for today: a rotating BLE MAC mints a
  // second device row (ensureDeviceRow keys on mac_address), so the same
  // calendar day gets duplicate steps_day rows under different
  // device_ids — typically a zero-filled backfill shadowing the real
  // count. `.find` would break that tie arbitrarily and could surface
  // the 0. Steps only accumulate within a day, so the largest value is
  // the most complete read; pick it and a shadow 0 can never win.
  let best: ActivityDay | null = null;
  for (const d of days) {
    if (d.dayLocal !== todayLocal) continue;
    if (best === null || d.totalSteps > best.totalSteps) best = d;
  }
  return best;
}
