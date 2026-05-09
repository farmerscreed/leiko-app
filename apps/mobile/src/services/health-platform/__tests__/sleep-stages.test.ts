// Sleep stage mapper tests — Sprint 9.5 / Task 6.
//
// Two source shapes need round-trip coverage:
//   1. Real transitions present (richer future case).
//   2. Empty transitions + per-stage minute totals (today's Urion path,
//      see services/sync/syncMultiVitals.ts §sleep synthesis).
//
// HK output: one inBed sample spanning the session + per-stage
// asleep* / awake samples for each canonical block. iOS-15 fallback
// folds the iOS-16 subtypes down to plain `asleep`.
//
// HC output: a stages array with the same boundaries, mapped to
// HC's SleepStageType numeric enum.

import {
  HC_STAGE,
  HK_SLEEP_VALUE,
  buildHCSleepStages,
  buildHKSleepSamples,
  canonicalBlocks,
  downgradeForLegacyIOS,
} from '../sleep-stages';
import type { SleepSession } from '../../../types/vitals';

const SESSION_START = 1700000000;
const SESSION_END = SESSION_START + 8 * 3600; // 8h

function emptyTransitions(): SleepSession['transitions'] {
  return [];
}

function baseSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    sessionStartSec: SESSION_START,
    sessionEndSec: SESSION_END,
    sessionStartLocal: new Date(SESSION_START * 1000).toISOString(),
    sessionEndLocal: new Date(SESSION_END * 1000).toISOString(),
    totalMinutes: 480,
    deepMinutes: 90,
    remMinutes: 0,
    lightMinutes: 360,
    awakeMinutes: 30,
    awakeCount: 1,
    transitions: emptyTransitions(),
    sleepScore: 0,
    ...overrides,
  };
}

describe('canonicalBlocks — synthesized from totals (no transitions)', () => {
  it('lays light → deep → awake sequentially, skipping zero-minute stages', () => {
    const blocks = canonicalBlocks(baseSession());
    // light 360m, deep 90m, awake 30m — REM skipped (0). Total 480m
    // matches sessionEnd - sessionStart, so cursor never clips.
    expect(blocks).toHaveLength(3);
    expect(blocks[0].stage).toBe('light');
    expect(blocks[0].endSec - blocks[0].startSec).toBe(360 * 60);
    expect(blocks[1].stage).toBe('deep');
    expect(blocks[1].endSec - blocks[1].startSec).toBe(90 * 60);
    expect(blocks[2].stage).toBe('awake');
    expect(blocks[2].endSec - blocks[2].startSec).toBe(30 * 60);
  });

  it('clips the last block at sessionEnd when totals overshoot', () => {
    // Totals add to 540 minutes, session is 480 minutes.
    const blocks = canonicalBlocks(
      baseSession({
        deepMinutes: 90,
        lightMinutes: 360,
        remMinutes: 60,
        awakeMinutes: 30,
      }),
    );
    const lastEnd = blocks[blocks.length - 1].endSec;
    expect(lastEnd).toBeLessThanOrEqual(SESSION_END);
  });

  it('returns no blocks when every per-stage total is zero', () => {
    const blocks = canonicalBlocks(
      baseSession({ lightMinutes: 0, deepMinutes: 0, remMinutes: 0, awakeMinutes: 0 }),
    );
    expect(blocks).toEqual([]);
  });
});

describe('canonicalBlocks — driven by transitions', () => {
  it('honours transition boundaries when present', () => {
    const blocks = canonicalBlocks(
      baseSession({
        transitions: [
          { atSec: SESSION_START, stage: 'light' },
          { atSec: SESSION_START + 3600, stage: 'deep' },
          { atSec: SESSION_START + 5400, stage: 'rem' },
          { atSec: SESSION_START + 7200, stage: 'light' },
        ],
      }),
    );
    expect(blocks).toHaveLength(4);
    expect(blocks[0].stage).toBe('light');
    expect(blocks[0].endSec).toBe(SESSION_START + 3600);
    expect(blocks[1].stage).toBe('deep');
    expect(blocks[3].stage).toBe('light');
    // Last block runs to sessionEnd.
    expect(blocks[3].endSec).toBe(SESSION_END);
  });

  it('drops transitions outside the session window', () => {
    const blocks = canonicalBlocks(
      baseSession({
        transitions: [
          { atSec: SESSION_START - 60, stage: 'awake' }, // before
          { atSec: SESSION_START + 60, stage: 'light' },
          { atSec: SESSION_END + 60, stage: 'awake' },   // after
        ],
      }),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].stage).toBe('light');
    expect(blocks[0].startSec).toBe(SESSION_START + 60);
    expect(blocks[0].endSec).toBe(SESSION_END);
  });
});

describe('buildHKSleepSamples', () => {
  it('emits an inBed sample spanning the full session, then per-stage samples', () => {
    const samples = buildHKSleepSamples(baseSession());
    expect(samples[0].value).toBe(HK_SLEEP_VALUE.inBed);
    expect(samples[0].startSec).toBe(SESSION_START);
    expect(samples[0].endSec).toBe(SESSION_END);

    // Then 3 stage samples (light/deep/awake — no REM in baseSession).
    expect(samples).toHaveLength(4);
    expect(samples[1].value).toBe(HK_SLEEP_VALUE.asleepCore); // light
    expect(samples[2].value).toBe(HK_SLEEP_VALUE.asleepDeep); // deep
    expect(samples[3].value).toBe(HK_SLEEP_VALUE.awake);
  });
});

describe('downgradeForLegacyIOS', () => {
  it('folds asleepCore/Deep/REM down to plain asleep, leaves inBed + awake', () => {
    const samples = buildHKSleepSamples(
      baseSession({
        deepMinutes: 60,
        lightMinutes: 300,
        remMinutes: 60,
        awakeMinutes: 60,
      }),
    );
    const downgraded = downgradeForLegacyIOS(samples);
    // First is still inBed.
    expect(downgraded[0].value).toBe(HK_SLEEP_VALUE.inBed);
    // Stage samples: light/deep/rem all collapse to `asleep`; awake stays.
    const stageOnly = downgraded.slice(1);
    const counts = stageOnly.reduce(
      (acc, s) => ({ ...acc, [s.value]: (acc[s.value] ?? 0) + 1 }),
      {} as Record<number, number>,
    );
    expect(counts[HK_SLEEP_VALUE.asleep]).toBe(3); // light + deep + rem
    expect(counts[HK_SLEEP_VALUE.awake]).toBe(1);
    expect(counts[HK_SLEEP_VALUE.asleepCore]).toBeUndefined();
    expect(counts[HK_SLEEP_VALUE.asleepDeep]).toBeUndefined();
    expect(counts[HK_SLEEP_VALUE.asleepREM]).toBeUndefined();
  });
});

describe('buildHCSleepStages', () => {
  it('maps our SleepStage enum to HC SleepStageType numeric values', () => {
    const stages = buildHCSleepStages(
      baseSession({
        deepMinutes: 60,
        lightMinutes: 300,
        remMinutes: 60,
        awakeMinutes: 60,
      }),
    );
    const stageValues = stages.map((s) => s.stage);
    expect(stageValues).toEqual([
      HC_STAGE.LIGHT,
      HC_STAGE.DEEP,
      HC_STAGE.REM,
      HC_STAGE.AWAKE,
    ]);
  });

  it('returns an empty stages array when totals + transitions are both empty', () => {
    const stages = buildHCSleepStages(
      baseSession({
        lightMinutes: 0,
        deepMinutes: 0,
        remMinutes: 0,
        awakeMinutes: 0,
      }),
    );
    expect(stages).toEqual([]);
  });
});
