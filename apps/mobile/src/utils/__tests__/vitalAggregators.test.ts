// vitalAggregators tests — Sprint 17a.
//
// Pure-helper coverage. Each helper is an extraction from the slice
// methods in `state/{hr,spo2,sleep,activity}.ts`; the assertions
// mirror the semantics those methods enforce.
//
// All "nowSec" values are chosen to land in UTC noon so the sleep
// window (22-06 UTC) is unambiguously "this night" for the sample
// timestamps used in the fixtures.

import {
  computeHRRestingToday,
  computeHRRestingRecent,
  computeHRLatestSampleAt,
  computeSpO2LatestPercent,
  computeSpO2LatestSampleAt,
  computeSpO2OvernightLowsRecent,
  computeSleepLastNight,
  computeActivityToday,
} from '../vitalAggregators';
import type {
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
} from '../../types/vitals';

const SECONDS_PER_DAY = 24 * 60 * 60;

// 2026-05-19T12:00:00Z — Tuesday noon UTC. Picked so 22:00–06:00 UTC
// of the "owning morning" 2026-05-19 is the relevant sleep window
// when we query restingBpmToday.
const NOW_SEC = Math.floor(Date.parse('2026-05-19T12:00:00Z') / 1000);

function hrSample(measuredAtSec: number, bpm: number): HRSample {
  return {
    measuredAtSec,
    bpm,
    sampleWindowSec: 5 * 60,
    motionState: 'rest',
    isSpotCheck: false,
  };
}

function spo2Sample(measuredAtSec: number, percent: number): SpO2Sample {
  return {
    measuredAtSec,
    percent,
    maxInWindow: percent,
    minInWindow: percent,
    sampleWindowSec: 60 * 60,
    isSpotCheck: false,
    perfusionIndex: null,
  };
}

function sleepSession(
  sessionStartSec: number,
  sessionEndSec: number,
  totalMinutes: number,
): SleepSession {
  return {
    sessionStartSec,
    sessionEndSec,
    sessionStartLocal: new Date(sessionStartSec * 1000).toISOString(),
    sessionEndLocal: new Date(sessionEndSec * 1000).toISOString(),
    totalMinutes,
    deepMinutes: 90,
    remMinutes: 0,
    lightMinutes: totalMinutes - 90 - 30,
    awakeMinutes: 30,
    awakeCount: 1,
    transitions: [],
    sleepScore: 75,
  };
}

function activityDay(dayLocal: string, totalSteps: number): ActivityDay {
  return {
    dayLocal,
    measuredAtSec: Math.floor(Date.parse(`${dayLocal}T00:00:00Z`) / 1000),
    totalSteps,
    targetSteps: 6000,
    lastSampleAtSec: Math.floor(Date.parse(`${dayLocal}T18:00:00Z`) / 1000),
    hourly: Array.from({ length: 24 }, () => 0),
  };
}

// =============================================================================
// HR
// =============================================================================

describe('computeHRRestingToday', () => {
  it('returns null with fewer than 2 samples', () => {
    expect(computeHRRestingToday([], NOW_SEC)).toBeNull();
    const lone = hrSample(NOW_SEC - 10 * 60 * 60, 60);
    expect(computeHRRestingToday([lone], NOW_SEC)).toBeNull();
  });

  it('returns the lowest 10-min rolling average within the sleep window', () => {
    // Three samples landing within tonight's window (22:00 UTC of the
    // prior calendar day → 06:00 UTC today). The algorithm walks each
    // sample as a window-end and averages everything inside the
    // preceding 10 min. For these three samples it produces 58 (i=0,
    // n<2 skip), 59 (i=1, avg of 58+60), 60 (i=2, avg of all three).
    // The lowest is 59.
    const baseSec =
      Math.floor(Date.parse('2026-05-19T02:00:00Z') / 1000); // 02:00 UTC = sleep window
    const samples: HRSample[] = [
      hrSample(baseSec, 58),
      hrSample(baseSec + 2 * 60, 60),
      hrSample(baseSec + 4 * 60, 62),
    ];
    const result = computeHRRestingToday(samples, NOW_SEC);
    expect(result).toBe(59);
  });

  it('ignores samples outside the sleep window', () => {
    const noonSec = Math.floor(Date.parse('2026-05-19T13:00:00Z') / 1000);
    const noonSec2 = noonSec + 5 * 60;
    const samples = [hrSample(noonSec, 70), hrSample(noonSec2, 72)];
    expect(computeHRRestingToday(samples, NOW_SEC)).toBeNull();
  });
});

describe('computeHRRestingRecent', () => {
  it('returns empty array on empty input', () => {
    expect(computeHRRestingRecent([], NOW_SEC)).toEqual([]);
  });

  it('returns one entry per prior night with enough samples', () => {
    // Two prior nights: 2 nights ago (May 17 morning) and 1 night ago
    // (May 18 morning). Both within the 14-day window.
    const twoNightsAgo = Math.floor(
      Date.parse('2026-05-17T03:00:00Z') / 1000,
    );
    const oneNightAgo = Math.floor(
      Date.parse('2026-05-18T03:00:00Z') / 1000,
    );
    const samples: HRSample[] = [
      hrSample(twoNightsAgo, 60),
      hrSample(twoNightsAgo + 2 * 60, 62),
      hrSample(oneNightAgo, 64),
      hrSample(oneNightAgo + 2 * 60, 66),
    ];
    const result = computeHRRestingRecent(samples, NOW_SEC);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(61); // night 1 (2 days back): (60+62)/2
    expect(result[1]).toBe(65); // night 2 (1 day back): (64+66)/2
  });

  it('skips today (matches slice semantics)', () => {
    const todayWindow = Math.floor(
      Date.parse('2026-05-19T03:00:00Z') / 1000,
    );
    const samples = [
      hrSample(todayWindow, 60),
      hrSample(todayWindow + 2 * 60, 62),
    ];
    expect(computeHRRestingRecent(samples, NOW_SEC)).toEqual([]);
  });
});

describe('computeHRLatestSampleAt', () => {
  it('returns null on empty input', () => {
    expect(computeHRLatestSampleAt([])).toBeNull();
  });

  it('returns the maximum measuredAtSec', () => {
    const samples = [
      hrSample(100, 60),
      hrSample(200, 65),
      hrSample(150, 62),
    ];
    expect(computeHRLatestSampleAt(samples)).toBe(200);
  });
});

// =============================================================================
// SpO2
// =============================================================================

describe('computeSpO2LatestPercent', () => {
  it('returns null on empty input', () => {
    expect(computeSpO2LatestPercent([])).toBeNull();
  });

  it('returns the percent of the latest sample', () => {
    const samples = [spo2Sample(100, 97), spo2Sample(200, 95), spo2Sample(150, 96)];
    expect(computeSpO2LatestPercent(samples)).toBe(95);
  });
});

describe('computeSpO2LatestSampleAt', () => {
  it('returns the maximum measuredAtSec', () => {
    const samples = [spo2Sample(100, 97), spo2Sample(300, 96)];
    expect(computeSpO2LatestSampleAt(samples)).toBe(300);
  });
});

describe('computeSpO2OvernightLowsRecent', () => {
  it('returns empty on empty input', () => {
    expect(computeSpO2OvernightLowsRecent([], NOW_SEC)).toEqual([]);
  });

  it('returns the per-night minimum, oldest first', () => {
    const nightA = Math.floor(Date.parse('2026-05-17T03:00:00Z') / 1000);
    const nightB = Math.floor(Date.parse('2026-05-18T03:00:00Z') / 1000);
    const samples: SpO2Sample[] = [
      spo2Sample(nightA, 95),
      spo2Sample(nightA + 30 * 60, 93),
      spo2Sample(nightB, 96),
      spo2Sample(nightB + 30 * 60, 94),
    ];
    const result = computeSpO2OvernightLowsRecent(samples, NOW_SEC);
    // Oldest night → newest night. NightA's low is 93; NightB's is 94.
    expect(result).toEqual([93, 94]);
  });
});

// =============================================================================
// Sleep
// =============================================================================

describe('computeSleepLastNight', () => {
  it('returns null on empty input', () => {
    expect(computeSleepLastNight([], NOW_SEC)).toBeNull();
  });

  it('returns the latest session that ended within 36 hours', () => {
    const recentEnd = NOW_SEC - 6 * 60 * 60;
    const recent = sleepSession(recentEnd - 8 * 60 * 60, recentEnd, 420);
    const ancientEnd = NOW_SEC - 5 * SECONDS_PER_DAY;
    const ancient = sleepSession(ancientEnd - 8 * 60 * 60, ancientEnd, 360);
    const result = computeSleepLastNight([ancient, recent], NOW_SEC);
    expect(result?.sessionEndSec).toBe(recentEnd);
  });

  it('returns null when every session is older than 36 hours', () => {
    const ancientEnd = NOW_SEC - 5 * SECONDS_PER_DAY;
    const ancient = sleepSession(ancientEnd - 8 * 60 * 60, ancientEnd, 420);
    expect(computeSleepLastNight([ancient], NOW_SEC)).toBeNull();
  });

  it('consolidates a fragmented night to the fullest session (not the shortest)', () => {
    // Real prod shape: the watch re-reported one night as 5 overlapping
    // sessions, all ending at the same wake, with drifting (later) starts
    // and shrinking durations. The old "latest end" pick surfaced the
    // shortest (46 min); the fix returns the fullest superset (84 min).
    const wake = NOW_SEC - 6 * 60 * 60;
    const frags = [84, 72, 68, 50, 46].map((mins) =>
      sleepSession(wake - mins * 60, wake, mins),
    );
    const result = computeSleepLastNight(frags, NOW_SEC);
    expect(result?.totalMinutes).toBe(84);
  });

  it('does not let an earlier night outrank the most recent one', () => {
    const lastNightEnd = NOW_SEC - 6 * 60 * 60;
    const lastNight = sleepSession(lastNightEnd - 60 * 60, lastNightEnd, 60); // short but most recent
    const priorEnd = NOW_SEC - 30 * 60 * 60; // ~prior night, still in 36h window
    const prior = sleepSession(priorEnd - 8 * 60 * 60, priorEnd, 480); // longer, older
    const result = computeSleepLastNight([prior, lastNight], NOW_SEC);
    expect(result?.sessionEndSec).toBe(lastNightEnd);
    expect(result?.totalMinutes).toBe(60);
  });
});

// =============================================================================
// Activity
// =============================================================================

describe('computeActivityToday', () => {
  it('returns null on empty input', () => {
    expect(computeActivityToday([], NOW_SEC)).toBeNull();
  });

  it('matches dayLocal to today (UTC) and returns the row', () => {
    const today = '2026-05-19';
    const yesterday = '2026-05-18';
    const days = [activityDay(yesterday, 4500), activityDay(today, 6800)];
    const result = computeActivityToday(days, NOW_SEC);
    expect(result?.dayLocal).toBe(today);
    expect(result?.totalSteps).toBe(6800);
  });

  it('returns null when today is not in the list', () => {
    const yesterday = '2026-05-18';
    expect(
      computeActivityToday([activityDay(yesterday, 4500)], NOW_SEC),
    ).toBeNull();
  });

  it('picks the highest count when a duplicate day-row shadows it with 0', () => {
    // Repro of the rotating-MAC duplicate: a second device row backfilled
    // today as 0 while the active device wrote the real 38. Order is
    // arbitrary from the query (same measured_at), so both orderings must
    // resolve to the real count, never the shadow 0.
    const today = '2026-05-19';
    const shadow = activityDay(today, 0);
    const real = activityDay(today, 38);
    expect(computeActivityToday([shadow, real], NOW_SEC)?.totalSteps).toBe(38);
    expect(computeActivityToday([real, shadow], NOW_SEC)?.totalSteps).toBe(38);
  });
});
