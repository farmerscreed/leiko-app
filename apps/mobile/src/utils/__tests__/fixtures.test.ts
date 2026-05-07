/* eslint-disable @typescript-eslint/no-require-imports */
// Fixture-builder tests — Sprint 7.5.
//
// Two contracts the fixtures must hold:
//   1. Determinism — same seed → same record stream.
//   2. Classifier alignment — each scenario fires the tier its name
//      claims (in_pattern, calm_concerned, confirmed_urgent), so the
//      integration tests downstream don't need to second-guess.

const fixtures = require('../../../../../tools/ble-mock/fixtures');
import {
  classifyHR,
  classifySpO2,
  classifySleep,
  classifyActivity,
} from '../classification';
import type { HRSample, SpO2Sample, SleepSession, ActivityDay, CaloriesDay } from '../../types/vitals';

// Resting HR for the day per D13 §2.2: lowest 10-min rolling-avg
// during the user's sleep window. Tests substitute "minimum bpm
// across any 30-min window in the day" — close enough to the real
// computation to drive classifier pathways.
function dailyRestingFromSamples(samples: HRSample[]): number[] {
  const byDay: Record<string, number[]> = {};
  for (const s of samples) {
    const day = new Date(s.measuredAtSec * 1000).toISOString().slice(0, 10);
    (byDay[day] ??= []).push(s.bpm);
  }
  return Object.keys(byDay)
    .sort()
    .map((day) => Math.min(...byDay[day]));
}

// SpO2 overnight low per D13 §6.3: lowest valid SpO2 during the
// sleep window. Tests use the same UTC 02:00-04:00 band the
// fixture writes to.
function overnightLowsFromSamples(samples: SpO2Sample[]): number[] {
  const byDay: Record<string, number[]> = {};
  for (const s of samples) {
    const date = new Date(s.measuredAtSec * 1000);
    const hour = date.getUTCHours();
    if (hour >= 2 && hour <= 4) {
      const day = date.toISOString().slice(0, 10);
      (byDay[day] ??= []).push(s.percent);
    }
  }
  return Object.keys(byDay)
    .sort()
    .map((day) => Math.min(...byDay[day]));
}

describe('seededRng — determinism', () => {
  it('same seed produces the same sequence', () => {
    const a = fixtures.seededRng(42);
    const b = fixtures.seededRng(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = fixtures.seededRng(1);
    const b = fixtures.seededRng(2);
    expect(a()).not.toBe(b());
  });

  it('floats stay in [0, 1)', () => {
    const r = fixtures.seededRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('HR fixtures', () => {
  it('hrInPatternBaseline produces 14×48=672 samples by default', () => {
    const samples: HRSample[] = fixtures.hrInPatternBaseline();
    expect(samples).toHaveLength(672);
    // Every sample is a rest sample with bpm in 65-75.
    for (const s of samples) {
      expect(s.motionState).toBe('rest');
      expect(s.bpm).toBeGreaterThanOrEqual(65);
      expect(s.bpm).toBeLessThanOrEqual(75);
    }
  });

  it('hrInPatternBaseline → classifyHR(today, recent) returns in_pattern', () => {
    const samples: HRSample[] = fixtures.hrInPatternBaseline({ seed: 100 });
    const dailies = dailyRestingFromSamples(samples);
    const today = dailies[dailies.length - 1];
    const recent = dailies.slice(0, -1);
    const c = classifyHR({ restingBpmToday: today, restingBpmRecent: recent });
    expect(c.tier).toBe('in_pattern');
  });

  it('hrCalmConcerned3DayTrend → classifyHR returns calm_concerned with 3day_trend reason', () => {
    const samples: HRSample[] = fixtures.hrCalmConcerned3DayTrend({ seed: 100 });
    const dailies = dailyRestingFromSamples(samples);
    const today = dailies[dailies.length - 1];
    const recent = dailies.slice(0, -1);
    const c = classifyHR({ restingBpmToday: today, restingBpmRecent: recent });
    expect(c.tier).toBe('calm_concerned');
    expect(c.reason).toBe('baseline_3day_trend');
  });

  it('hrConfirmedUrgentExtreme → classifyHR returns confirmed_urgent', () => {
    const [sample]: HRSample[] = fixtures.hrConfirmedUrgentExtreme({ bpm: 145 });
    const c = classifyHR({ restingBpmToday: sample.bpm, restingBpmRecent: [] });
    expect(c.tier).toBe('confirmed_urgent');
  });

  it('determinism: same seed → same record stream', () => {
    const a = fixtures.hrInPatternBaseline({ seed: 7, days: 2 });
    const b = fixtures.hrInPatternBaseline({ seed: 7, days: 2 });
    expect(a).toEqual(b);
  });
});

describe('SpO2 fixtures', () => {
  // Align to 1970-01-01 00:00 UTC so the test's "02:00-04:00 UTC"
  // window matches the fixture's overnight indices deterministically.
  const ALIGNED_START = 0;

  it('spo2InPattern → classifySpO2 returns in_pattern', () => {
    const samples: SpO2Sample[] = fixtures.spo2InPattern({
      seed: 100,
      startSec: ALIGNED_START,
    });
    const lows = overnightLowsFromSamples(samples);
    const latest = samples[samples.length - 1].percent;
    const c = classifySpO2({ latestPercent: latest, overnightLowsRecent: lows });
    expect(c.tier).toBe('in_pattern');
  });

  it('spo2OvernightDip → 3 nights below 88 → confirmed_urgent', () => {
    const samples: SpO2Sample[] = fixtures.spo2OvernightDip({
      seed: 100,
      days: 7,
      startSec: ALIGNED_START,
    });
    const lows = overnightLowsFromSamples(samples);
    expect(lows.length).toBe(7);
    expect(lows.slice(-3).every((l) => l < 88)).toBe(true);
    const c = classifySpO2({
      latestPercent: 97,
      overnightLowsRecent: lows,
    });
    expect(c.tier).toBe('confirmed_urgent');
  });
});

describe('Sleep fixtures', () => {
  it('sleepInPatternSession → classifySleep returns in_pattern', () => {
    const session: SleepSession = fixtures.sleepInPatternSession();
    const c = classifySleep({
      totalMinutes: session.totalMinutes,
      deepMinutes: session.deepMinutes,
      awakeCount: session.awakeCount,
      sessionStartSec: session.sessionStartSec,
      sessionEndSec: session.sessionEndSec,
    });
    expect(c.tier).toBe('in_pattern');
    expect(c.sleepScore).toBeGreaterThanOrEqual(70);
  });

  it('sleepShortSession → classifySleep returns calm_concerned', () => {
    const session: SleepSession = fixtures.sleepShortSession();
    const c = classifySleep({
      totalMinutes: session.totalMinutes,
      deepMinutes: session.deepMinutes,
      awakeCount: session.awakeCount,
      sessionStartSec: session.sessionStartSec,
      sessionEndSec: session.sessionEndSec,
    });
    expect(c.tier).toBe('calm_concerned');
    expect(c.sleepScore).toBeLessThan(70);
  });

  it('sleep transitions are monotonically ordered by atSec', () => {
    const session: SleepSession = fixtures.sleepInPatternSession();
    for (let i = 1; i < session.transitions.length; i++) {
      expect(session.transitions[i].atSec).toBeGreaterThanOrEqual(
        session.transitions[i - 1].atSec,
      );
    }
  });
});

describe('Activity + Calories fixtures', () => {
  it('activityNormalDay → classifyActivity returns in_pattern (above 80% target)', () => {
    const day: ActivityDay = fixtures.activityNormalDay();
    const c = classifyActivity({
      stepsToday: day.totalSteps,
      targetSteps: day.targetSteps,
    });
    expect(c.tier).toBe('in_pattern');
  });

  it('hourly distribution sums to totalSteps', () => {
    const day: ActivityDay = fixtures.activityNormalDay();
    const sum = day.hourly.reduce((a, b) => a + b, 0);
    expect(sum).toBe(day.totalSteps);
  });

  it('hourly array is length 24', () => {
    const day: ActivityDay = fixtures.activityNormalDay();
    expect(day.hourly).toHaveLength(24);
  });

  it('caloriesNormalDay totalKcal == activityKcal + bmrKcal', () => {
    const cal: CaloriesDay = fixtures.caloriesNormalDay();
    expect(cal.totalKcal).toBe(cal.activityKcal + cal.bmrKcal);
  });
});
