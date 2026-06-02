// HR-derived wake-time inference — Sprint 18.
//
// Why this file exists: the U16PRO BLE 0x07 sleep packet carries only
// total / deep / light durations (per U16PRO_protocol_en.pdf §4.3) —
// no actual bedtime or wake time. Until Sprint 18 we synthesized
// sessionEnd as `day_UTC_midnight + 8h = 08:00 UTC`, which renders as
// "9 AM wake" in Lagos every single day regardless of when the user
// actually woke. SLEEP_TIMEZONE_FIX_BRIEF.md has the full background.
//
// The watch DOES record HR samples continuously (5-min cadence per the
// 0x15 index packet). When the user transitions from sleep to wake,
// HR rises sharply within minutes — the body's circadian "morning
// surge." We use this signal to infer wake time:
//
//   1. Define a wake window in the user's tz: 20:00 of the previous
//      local day → 11:00 of the named local day. Wide enough to catch
//      late nights and late wake-ups; narrow enough to exclude the
//      previous morning.
//   2. Pull the HR samples that fall inside that window.
//   3. Find the minimum HR observed during the deep-sleep block
//      (02:00–06:00 local). That's the sleeping baseline.
//   4. Walk forward from the baseline-minimum sample. The wake is the
//      first sample whose bpm > baseline + WAKE_DELTA AND is followed
//      by ≥ 2 more samples also > baseline + WAKE_HOLD_DELTA. Two
//      follow-ups guards against a brief mid-night HR spike (toilet
//      trip, bad dream, partner moving).
//   5. Return that sample's measuredAtSec as the inferred wake time;
//      derive inferred bed time as `wakeTime - totalMinutes × 60`.
//
// If <3 samples land in the window, OR no inflection is found, we
// fall back to a calibrated tz-aware synthesis: wake = 07:00 local in
// the user's tz, properly offset to UTC. The session is marked
// `wakeSource: 'fallback'` so the UI can surface "approx." next to it.
//
// This helper is pure / no React / no MMKV — depends only on its
// arguments. Tests live in inferWakeFromHR.test.ts.

import { epochSecForLocalHour } from '../../utils/userTz';
import type { HRSample } from '../../types/vitals';

/** HR delta (bpm) above the sleeping baseline that counts as a wake
 *  candidate. The "morning surge" reliably crosses this threshold
 *  within the first 10–15 min after waking. */
const WAKE_DELTA_BPM = 15;

/** Looser delta the follow-up samples must beat. Lets the wake-candidate
 *  flagged at +15 bpm be confirmed by samples at e.g. +12 bpm rather
 *  than requiring all three to stay above +15. */
const WAKE_HOLD_DELTA_BPM = 10;

/** Minimum HR samples needed in the window before we attempt
 *  inference. Below this we always fall back. */
const MIN_SAMPLES_FOR_INFERENCE = 3;

/** Number of follow-up samples (after the candidate) that must also
 *  exceed `baseline + WAKE_HOLD_DELTA_BPM` for the candidate to count
 *  as a real wake. Filters out single-sample HR spikes. */
const REQUIRED_FOLLOWUPS = 2;

/** Sleep-window minimum is sampled inside this band (local). */
const BASELINE_WINDOW_START_HOUR = 2;
const BASELINE_WINDOW_END_HOUR = 6;

/** Wake search window — wider than the baseline window so we catch
 *  late nights and late wake-ups. */
const WAKE_WINDOW_PRIOR_DAY_START_HOUR = 20; // 20:00 previous local day
const WAKE_WINDOW_DAY_END_HOUR = 11;          // 11:00 named local day

/** Fallback wake hour (local, in the user's tz) when HR data isn't
 *  usable. Better than the pre-Sprint-18 fixed 08:00 UTC. */
const FALLBACK_WAKE_HOUR_LOCAL = 7;

export type WakeSource = 'hr_inferred' | 'fallback';

export interface InferredWake {
  /** epoch sec UTC of inferred wake (= session end). */
  sessionEndSec: number;
  /** epoch sec UTC of inferred bedtime (= wake - total × 60). */
  sessionStartSec: number;
  /** How sessionEnd was derived. */
  source: WakeSource;
}

/**
 * Infer the user's wake time for the named local day, using HR samples
 * + the watch-reported total sleep minutes.
 *
 * @param hrSamples   All HR samples we have access to (pending + recent).
 *                    Filtered internally to the wake window.
 * @param dayLocal    YYYY-MM-DD — the calendar day in the USER'S TZ on
 *                    which the user woke up. (Not UTC midnight — caller
 *                    must convert.)
 * @param totalMinutes Watch-reported total sleep minutes.
 * @param tz          IANA timezone string. Required.
 */
export function inferWakeFromHR(
  hrSamples: ReadonlyArray<HRSample>,
  dayLocal: string,
  totalMinutes: number,
  tz: string,
): InferredWake {
  // Window boundaries — convert local hours to UTC epoch sec via the
  // user's tz. Crossing midnight: start lives on the prior day.
  const priorDay = priorDayLocal(dayLocal);
  const windowStartSec = epochSecForLocalHour(
    priorDay,
    WAKE_WINDOW_PRIOR_DAY_START_HOUR,
    tz,
  );
  const windowEndSec = epochSecForLocalHour(
    dayLocal,
    WAKE_WINDOW_DAY_END_HOUR,
    tz,
  );

  // Baseline window — inside the wake window. Used to compute the
  // sleeping baseline only.
  const baselineStartSec = epochSecForLocalHour(
    dayLocal,
    BASELINE_WINDOW_START_HOUR,
    tz,
  );
  const baselineEndSec = epochSecForLocalHour(
    dayLocal,
    BASELINE_WINDOW_END_HOUR,
    tz,
  );

  const fallback = (): InferredWake => {
    const sessionEndSec = epochSecForLocalHour(
      dayLocal,
      FALLBACK_WAKE_HOUR_LOCAL,
      tz,
    );
    return {
      sessionEndSec,
      sessionStartSec: sessionEndSec - Math.max(0, totalMinutes) * 60,
      source: 'fallback',
    };
  };

  // Filter + sort the samples we'll consider for inference.
  const inWindow = hrSamples
    .filter(
      (s) =>
        s.measuredAtSec >= windowStartSec &&
        s.measuredAtSec <= windowEndSec &&
        s.bpm > 0,
    )
    .slice()
    .sort((a, b) => a.measuredAtSec - b.measuredAtSec);

  if (inWindow.length < MIN_SAMPLES_FOR_INFERENCE) {
    return fallback();
  }

  // Sleeping baseline = min HR observed in the deep-sleep band. When
  // no samples fall inside the baseline window (very short sleep, or
  // a fragmented night that crossed into morning) we fall back to the
  // overall window's min for resilience.
  const baselineSamples = inWindow.filter(
    (s) => s.measuredAtSec >= baselineStartSec && s.measuredAtSec <= baselineEndSec,
  );
  const baselineSource = baselineSamples.length > 0 ? baselineSamples : inWindow;
  const baselineBpm = baselineSource.reduce(
    (min, s) => (s.bpm < min ? s.bpm : min),
    baselineSource[0].bpm,
  );

  // Anchor: index of the minimum-HR sample inside `inWindow`. Walk
  // FORWARD from there looking for the wake inflection.
  const anchorIdx = inWindow.findIndex(
    (s) => s.bpm === baselineBpm && s.measuredAtSec >= baselineStartSec,
  );
  const startIdx = anchorIdx >= 0 ? anchorIdx : 0;

  const wakeThreshold = baselineBpm + WAKE_DELTA_BPM;
  const holdThreshold = baselineBpm + WAKE_HOLD_DELTA_BPM;

  for (let i = startIdx; i < inWindow.length; i++) {
    const candidate = inWindow[i];
    if (candidate.bpm <= wakeThreshold) continue;
    // Need REQUIRED_FOLLOWUPS more samples beyond this one, each above
    // holdThreshold. If we don't have that many follow-ups left in the
    // window, no inflection — fall back.
    if (i + REQUIRED_FOLLOWUPS >= inWindow.length) break;
    let confirmed = true;
    for (let j = 1; j <= REQUIRED_FOLLOWUPS; j++) {
      if (inWindow[i + j].bpm <= holdThreshold) {
        confirmed = false;
        break;
      }
    }
    if (confirmed) {
      return {
        sessionEndSec: candidate.measuredAtSec,
        sessionStartSec: candidate.measuredAtSec - Math.max(0, totalMinutes) * 60,
        source: 'hr_inferred',
      };
    }
  }

  return fallback();
}

/** YYYY-MM-DD → YYYY-MM-DD for the previous calendar day. UTC math is
 *  safe here: we're treating the string as a date label, not a moment. */
function priorDayLocal(dayLocal: string): string {
  const ms = new Date(`${dayLocal}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}
