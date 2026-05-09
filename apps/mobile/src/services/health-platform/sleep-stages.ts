// Sleep stage mapping — Sprint 9.5 / Task 6.
//
// Pure functions. No Platform imports. The iOS / Android adapters
// consume the output and feed it to saveCategorySample / insertRecords
// respectively.
//
// Source shape: SleepSession from types/vitals.ts. The richest case is
// when `transitions` is populated — each transition marks the START of
// a stage block; the block ends at the next transition's atSec, or at
// sessionEndSec for the last. Today's watch firmware does NOT expose
// transitions (per the comment in services/sync/syncMultiVitals.ts and
// the multi_vitals_gap memory note); we synthesize blocks from per-
// stage minute totals as a fallback. When richer transition data lands
// (Sprint 11+ if we move to a different sensor source), the same mapper
// honours it without changes.
//
// HK semantics (D13 §12.2 + Apple HealthKit docs):
//   • One `inBed` sample covering the entire bed window.
//   • Per-stage samples (`asleepCore` / `asleepDeep` / `asleepREM` /
//     `awake`) for each within-session block.
// iOS 15.x fallback: stage subtypes (3-5) require iOS 16+. Adapter
// downgrades stage values via downgradeForLegacyIOS() when Platform.
// Version < 16.
//
// HC semantics (D13 §12.4): a single SleepSessionRecord with `stages: []`.

import type { SleepSession, SleepStage } from '../../types/vitals';

// HK CategoryValueSleepAnalysis enum, mirrored as a const so the mapper
// stays platform-agnostic. Source values match
// @kingstinct/react-native-healthkit's generated enum (verified against
// the .d.ts at install time — see ADR-0005 and Task 3 commit).
export const HK_SLEEP_VALUE = {
  inBed: 0,
  asleep: 1, // also asleepUnspecified
  awake: 2,
  asleepCore: 3, // iOS 16+
  asleepDeep: 4, // iOS 16+
  asleepREM: 5, // iOS 16+
} as const;

export type HKSleepValue = (typeof HK_SLEEP_VALUE)[keyof typeof HK_SLEEP_VALUE];

// HC SleepStageType, mirrored from react-native-health-connect's
// constants module. Verified at install time.
export const HC_STAGE = {
  UNKNOWN: 0,
  AWAKE: 1,
  SLEEPING: 2,
  OUT_OF_BED: 3,
  LIGHT: 4,
  DEEP: 5,
  REM: 6,
} as const;

export interface HKSleepSample {
  value: HKSleepValue;
  startSec: number;
  endSec: number;
}

export interface HCStageBlock {
  startTimeSec: number;
  endTimeSec: number;
  stage: number;
}

// ────────────────────────────────────────────────────────────────────
// Internal: compute the canonical block list from a SleepSession.
// Returns blocks with our own SleepStage labels; downstream callers
// translate to HK or HC enums.

interface CanonicalBlock {
  startSec: number;
  endSec: number;
  stage: SleepStage;
}

function blocksFromTransitions(session: SleepSession): CanonicalBlock[] {
  // Sort transitions by time; trim any outside the session window.
  const sorted = [...session.transitions]
    .filter(
      (t) =>
        t.atSec >= session.sessionStartSec &&
        t.atSec <= session.sessionEndSec,
    )
    .sort((a, b) => a.atSec - b.atSec);

  if (sorted.length === 0) return [];

  const out: CanonicalBlock[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const start = sorted[i].atSec;
    const end =
      i === sorted.length - 1 ? session.sessionEndSec : sorted[i + 1].atSec;
    if (end > start) {
      out.push({ startSec: start, endSec: end, stage: sorted[i].stage });
    }
  }
  return out;
}

function blocksFromTotals(session: SleepSession): CanonicalBlock[] {
  // Fallback for the no-transitions case (today's Urion firmware path).
  // Lay light → deep → rem → awake out sequentially starting at session
  // start. Any stage with 0 minutes is skipped. Total minutes from the
  // four stages may be less than session totalMinutes — that's expected
  // when the firmware doesn't break the full window down (REM = 0 today).
  const out: CanonicalBlock[] = [];
  let cursor = session.sessionStartSec;
  const order: { stage: SleepStage; minutes: number }[] = [
    { stage: 'light', minutes: session.lightMinutes },
    { stage: 'deep', minutes: session.deepMinutes },
    { stage: 'rem', minutes: session.remMinutes },
    { stage: 'awake', minutes: session.awakeMinutes },
  ];
  for (const { stage, minutes } of order) {
    if (minutes <= 0) continue;
    const blockEnd = cursor + minutes * 60;
    // Don't run past session end — clip if synthesis exceeds it.
    const safeEnd = Math.min(blockEnd, session.sessionEndSec);
    if (safeEnd > cursor) {
      out.push({ startSec: cursor, endSec: safeEnd, stage });
      cursor = safeEnd;
    }
    if (cursor >= session.sessionEndSec) break;
  }
  return out;
}

export function canonicalBlocks(session: SleepSession): CanonicalBlock[] {
  if (session.transitions.length > 0) return blocksFromTransitions(session);
  return blocksFromTotals(session);
}

// ────────────────────────────────────────────────────────────────────
// HK mapping. Returns one `inBed` sample for the full session plus
// per-stage samples for each canonical block. Stage values use the
// iOS-16+ subtypes (asleepCore/Deep/REM); iOS 15.x adapters call
// downgradeForLegacyIOS() to fold them down to plain `asleep`.

const STAGE_TO_HK: Record<SleepStage, HKSleepValue> = {
  light: HK_SLEEP_VALUE.asleepCore,
  deep: HK_SLEEP_VALUE.asleepDeep,
  rem: HK_SLEEP_VALUE.asleepREM,
  awake: HK_SLEEP_VALUE.awake,
};

export function buildHKSleepSamples(session: SleepSession): HKSleepSample[] {
  const samples: HKSleepSample[] = [];
  // Spanning inBed sample first — Apple's recommended pattern; it
  // marks the bed window separate from the asleep blocks within it.
  samples.push({
    value: HK_SLEEP_VALUE.inBed,
    startSec: session.sessionStartSec,
    endSec: session.sessionEndSec,
  });
  for (const b of canonicalBlocks(session)) {
    samples.push({
      value: STAGE_TO_HK[b.stage],
      startSec: b.startSec,
      endSec: b.endSec,
    });
  }
  return samples;
}

/** Fold iOS-16+ subtypes down to iOS 15-compatible values. asleepCore /
 *  asleepDeep / asleepREM all collapse to plain `asleep` (1). inBed and
 *  awake are unchanged. */
export function downgradeForLegacyIOS(samples: HKSleepSample[]): HKSleepSample[] {
  return samples.map((s) => {
    if (
      s.value === HK_SLEEP_VALUE.asleepCore ||
      s.value === HK_SLEEP_VALUE.asleepDeep ||
      s.value === HK_SLEEP_VALUE.asleepREM
    ) {
      return { ...s, value: HK_SLEEP_VALUE.asleep };
    }
    return s;
  });
}

// ────────────────────────────────────────────────────────────────────
// HC mapping. Returns the stages array for a SleepSessionRecord. The
// adapter wraps it with the recordType + startTime/endTime fields.

const STAGE_TO_HC: Record<SleepStage, number> = {
  light: HC_STAGE.LIGHT,
  deep: HC_STAGE.DEEP,
  rem: HC_STAGE.REM,
  awake: HC_STAGE.AWAKE,
};

export function buildHCSleepStages(session: SleepSession): HCStageBlock[] {
  return canonicalBlocks(session).map((b) => ({
    startTimeSec: b.startSec,
    endTimeSec: b.endSec,
    stage: STAGE_TO_HC[b.stage],
  }));
}
