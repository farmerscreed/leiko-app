// Daytime rest / nap estimation — 2026-11-18.
//
// Why this file exists: the watch reports only nightly sleep totals
// (0x07). Urion's own app has nothing more for the watch either
// (docs/06-ble-protocol.md §3.2). So naps are invisible unless we
// estimate them from what we do have:
//
//   • heart rate every 5 minutes, all day and night;
//   • the hourly step timeline (services/activity/stepTimeline.ts).
//
// A rest period is a stretch of at least MIN_REST_MINUTES during the
// day where heart rate stays close to the wearer's OWN sleeping level
// and, where we have the step timeline, the hours it covers had almost
// no steps. The sleeping level comes from the night before (lowest-
// quarter HR between 01:00 and 05:00 local), so a fit wearer with a
// low resting HR and a wearer with a high one are each judged against
// themselves.
//
// These are estimates and are labelled so. Sitting very still can look
// like a nap; a light doze with fidgeting can be missed. `confidence`
// says whether movement data backed the heart-rate signal.
//
// Pure: no React, no MMKV. Tests in __tests__/detectRestPeriods.test.ts.

import { epochSecForLocalHour } from '../../utils/userTz';
import type { HRSample, RestPeriod } from '../../types/vitals';

export type { RestPeriod };
export type RestConfidence = RestPeriod['confidence'];

/** Daytime search window, local hours [start, end). */
const DAY_WINDOW_START_HOUR = 9;
const DAY_WINDOW_END_HOUR = 21;
/** Night window the sleeping baseline is taken from (local, same date). */
const BASELINE_START_HOUR = 1;
const BASELINE_END_HOUR = 5;
/** Heart rate this close to the sleeping level counts as resting. */
const REST_DELTA_BPM = 8;
/** Shortest stretch we call a rest period. */
export const MIN_REST_MINUTES = 20;
/** Gap between two samples that still counts as continuous. */
const MAX_SAMPLE_GAP_SEC = 11 * 60;
/** Steps per hour (covered hour) above which the hour counts as active. */
const MAX_STEPS_PER_HOUR = 150;
/** Fewer baseline samples than this → we don't trust the baseline. */
const MIN_BASELINE_SAMPLES = 12;
const SAMPLE_SEC = 5 * 60;

function percentile(sorted: number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i];
}

/** Sleeping heart rate for `dayLocal`: 25th percentile of samples
 *  between 01:00 and 05:00 local that night, or null without enough
 *  night data. */
export function sleepingBaselineBpm(
  samples: ReadonlyArray<HRSample>,
  dayLocal: string,
  tz: string,
): number | null {
  const from = epochSecForLocalHour(dayLocal, BASELINE_START_HOUR, tz);
  const to = epochSecForLocalHour(dayLocal, BASELINE_END_HOUR, tz);
  const vals = samples
    .filter((s) => s.measuredAtSec >= from && s.measuredAtSec < to && s.bpm > 0)
    .map((s) => s.bpm)
    .sort((a, b) => a - b);
  if (vals.length < MIN_BASELINE_SAMPLES) return null;
  return percentile(vals, 0.25);
}

/**
 * Find daytime rest periods for one local day.
 *
 * @param hourlySteps steps per local hour for the day, or null when we
 *   have no timeline for it (then confidence is 'hr_only'). Hours with
 *   0 because nothing was placed are indistinguishable from still hours
 *   — callers pass null when the day's timeline placed no steps at all.
 */
export function detectRestPeriods(
  samples: ReadonlyArray<HRSample>,
  dayLocal: string,
  tz: string,
  hourlySteps: ReadonlyArray<number> | null,
): RestPeriod[] {
  const baseline = sleepingBaselineBpm(samples, dayLocal, tz);
  if (baseline === null) return [];

  const windowStart = epochSecForLocalHour(dayLocal, DAY_WINDOW_START_HOUR, tz);
  const windowEnd = epochSecForLocalHour(dayLocal, DAY_WINDOW_END_HOUR, tz);
  const day = samples
    .filter((s) => s.measuredAtSec >= windowStart && s.measuredAtSec < windowEnd && s.bpm > 0)
    .slice()
    .sort((a, b) => a.measuredAtSec - b.measuredAtSec);

  const limit = baseline + REST_DELTA_BPM;
  const runs: HRSample[][] = [];
  let run: HRSample[] = [];
  for (const s of day) {
    const prev = run[run.length - 1];
    const continuous = prev && s.measuredAtSec - prev.measuredAtSec <= MAX_SAMPLE_GAP_SEC;
    if (s.bpm <= limit) {
      if (run.length && !continuous) {
        runs.push(run);
        run = [];
      }
      run.push(s);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const hourStart = (h: number) => epochSecForLocalHour(dayLocal, h, tz);
  const out: RestPeriod[] = [];
  for (const r of runs) {
    const startSec = r[0].measuredAtSec;
    const endSec = r[r.length - 1].measuredAtSec + SAMPLE_SEC;
    const minutes = Math.round((endSec - startSec) / 60);
    if (minutes < MIN_REST_MINUTES) continue;

    let confidence: RestConfidence = 'hr_only';
    if (hourlySteps && hourlySteps.length === 24) {
      // Every local hour the period touches must have been quiet.
      let quiet = true;
      for (let h = 0; h < 24; h++) {
        const hs = hourStart(h);
        const he = h === 23 ? hs + 3600 : hourStart(h + 1);
        if (he <= startSec || hs >= endSec) continue;
        if (hourlySteps[h] > MAX_STEPS_PER_HOUR) quiet = false;
      }
      if (!quiet) continue; // heart rate low but the wearer was walking: not rest
      confidence = 'hr_and_steps';
    }

    const avgBpm = Math.round(r.reduce((a, s) => a + s.bpm, 0) / r.length);
    out.push({ startSec, endSec, durationMinutes: minutes, avgBpm, baselineBpm: baseline, confidence, dayLocal });
  }
  return out;
}
