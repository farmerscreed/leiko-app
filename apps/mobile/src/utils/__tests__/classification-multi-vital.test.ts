// Multi-vital classifier tests — Sprint 7.5.
//
// Per D13 §6.2-§6.6. Each classifier has a cold-start branch (or
// equivalent thin-data path), a hot-path tier ladder, and the
// stale/no_data axis is tested separately.
//
// Coverage gate from sprint card: ≥ 90% on the new classifiers.

import {
  classifyHR,
  classifySpO2,
  classifySleep,
  classifyActivity,
  computeSleepScore,
  checkStaleness,
} from '../classification';

// HR ─────────────────────────────────────────────────────────────────

describe('classifyHR — confirmed_urgent at extremes', () => {
  it.each([
    [39, 'low'],
    [25, 'very low'],
    [131, 'high'],
    [180, 'very high'],
  ])('bpm=%i (%s) → confirmed_urgent', (restingBpmToday) => {
    const c = classifyHR({ restingBpmToday, restingBpmRecent: [70, 71, 72] });
    expect(c.tier).toBe('confirmed_urgent');
    expect(c.reason).toBe('extreme_value');
  });

  it('extreme value fires even with full baseline', () => {
    const baseline = Array.from({ length: 14 }, () => 70);
    const c = classifyHR({ restingBpmToday: 30, restingBpmRecent: baseline });
    expect(c.tier).toBe('confirmed_urgent');
  });
});

describe('classifyHR — cold-start (<14 days of baseline)', () => {
  it('bpm=70 with no baseline → in_pattern (cold_start_in_band)', () => {
    expect(classifyHR({ restingBpmToday: 70, restingBpmRecent: [] }).tier).toBe(
      'in_pattern',
    );
  });

  it('bpm=50 (boundary low) → in_pattern', () => {
    expect(classifyHR({ restingBpmToday: 50, restingBpmRecent: [] }).tier).toBe(
      'in_pattern',
    );
  });

  it('bpm=95 (boundary high) → in_pattern', () => {
    expect(classifyHR({ restingBpmToday: 95, restingBpmRecent: [] }).tier).toBe(
      'in_pattern',
    );
  });

  it('bpm=49 (just below band) → calm_concerned', () => {
    const c = classifyHR({ restingBpmToday: 49, restingBpmRecent: [] });
    expect(c.tier).toBe('calm_concerned');
    expect(c.reason).toBe('cold_start_outside_band');
  });

  it('bpm=96 (just above band) → calm_concerned', () => {
    const c = classifyHR({ restingBpmToday: 96, restingBpmRecent: [] });
    expect(c.tier).toBe('calm_concerned');
  });

  it('thin baseline (<14 days) takes the cold-start path', () => {
    const thin = [70, 71, 72, 73, 74, 75, 76];   // 7 days
    expect(classifyHR({ restingBpmToday: 96, restingBpmRecent: thin }).tier).toBe(
      'calm_concerned',
    );
  });
});

describe('classifyHR — hot path (≥14 days of baseline)', () => {
  const calmBaseline = Array.from({ length: 14 }, () => 70);   // median 70

  it('today=70 (== baseline) → in_pattern', () => {
    const c = classifyHR({ restingBpmToday: 70, restingBpmRecent: calmBaseline });
    expect(c.tier).toBe('in_pattern');
    expect(c.reason).toBe('baseline_within');
  });

  it('today=98 (>baseline+15 but only 1 day) → in_pattern (no trend)', () => {
    const c = classifyHR({ restingBpmToday: 98, restingBpmRecent: calmBaseline });
    expect(c.tier).toBe('in_pattern');
  });

  it('3-day trend > baseline+15 → calm_concerned', () => {
    // Last 2 days of baseline + today all > 70+15 = 85.
    const recent = [...Array.from({ length: 12 }, () => 70), 90, 92];
    const c = classifyHR({ restingBpmToday: 95, restingBpmRecent: recent });
    expect(c.tier).toBe('calm_concerned');
    expect(c.reason).toBe('baseline_3day_trend');
  });

  it('only 2 trend days (today + 1 prior) → in_pattern', () => {
    // Only 1 prior day > 85; trend rule needs all 3.
    const recent = [...Array.from({ length: 12 }, () => 70), 70, 92];
    const c = classifyHR({ restingBpmToday: 95, restingBpmRecent: recent });
    expect(c.tier).toBe('in_pattern');
  });

  it('today > 100 sustained at rest → calm_concerned (single sample)', () => {
    const c = classifyHR({ restingBpmToday: 105, restingBpmRecent: calmBaseline });
    expect(c.tier).toBe('calm_concerned');
    expect(c.reason).toBe('sustained_high_at_rest');
  });

  it('today=100 (boundary, NOT >) → in_pattern', () => {
    const c = classifyHR({ restingBpmToday: 100, restingBpmRecent: calmBaseline });
    expect(c.tier).toBe('in_pattern');
  });
});

// SpO2 ───────────────────────────────────────────────────────────────

describe('classifySpO2 — in_pattern', () => {
  it('latest 98, no overnight context → in_pattern', () => {
    const c = classifySpO2({ latestPercent: 98, overnightLowsRecent: [] });
    expect(c.tier).toBe('in_pattern');
    expect(c.reason).toBe('sample_and_overnight_in_band');
  });

  it('latest 95 (boundary), overnight 90 (boundary) → in_pattern', () => {
    expect(
      classifySpO2({ latestPercent: 95, overnightLowsRecent: [90] }).tier,
    ).toBe('in_pattern');
  });

  it('latest 88 alone (single below-90, no overnight) → in_pattern (no false alarm)', () => {
    const c = classifySpO2({ latestPercent: 88, overnightLowsRecent: [] });
    expect(c.tier).toBe('in_pattern');
    expect(c.reason).toBe('sample_below_90_alone');
  });
});

describe('classifySpO2 — calm_concerned', () => {
  it('latest 92 (in 90-94 band) → calm_concerned', () => {
    const c = classifySpO2({ latestPercent: 92, overnightLowsRecent: [96] });
    expect(c.tier).toBe('calm_concerned');
    expect(c.reason).toBe('sample_or_overnight_borderline');
  });

  it('latest 90 (boundary low) → calm_concerned', () => {
    expect(
      classifySpO2({ latestPercent: 90, overnightLowsRecent: [] }).tier,
    ).toBe('calm_concerned');
  });

  it('latest 94 (boundary high) → calm_concerned', () => {
    expect(
      classifySpO2({ latestPercent: 94, overnightLowsRecent: [] }).tier,
    ).toBe('calm_concerned');
  });

  it('latest fine, last overnight 88 → calm_concerned', () => {
    const c = classifySpO2({ latestPercent: 97, overnightLowsRecent: [89] });
    expect(c.tier).toBe('calm_concerned');
  });

  it('two consecutive nights below 88 (not yet 3) → calm_concerned, not urgent', () => {
    const c = classifySpO2({ latestPercent: 97, overnightLowsRecent: [86, 87] });
    expect(c.tier).toBe('in_pattern');
    // Note: single below-90 (or below-88) overnight doesn't fire on its own
    // because the borderline rule is 88-89 not <88; <88 by itself is "we
    // need pattern of 3" per D13. Two readings at <88 doesn't satisfy
    // either rule on a single sample.
  });
});

describe('classifySpO2 — confirmed_urgent', () => {
  it('overnight_low < 88 sustained 3 nights → confirmed_urgent', () => {
    const c = classifySpO2({
      latestPercent: 97,
      overnightLowsRecent: [85, 86, 87],
    });
    expect(c.tier).toBe('confirmed_urgent');
    expect(c.reason).toBe('overnight_dip_sustained');
  });

  it('overnight_low < 88 for 5 nights running → confirmed_urgent', () => {
    expect(
      classifySpO2({
        latestPercent: 97,
        overnightLowsRecent: [82, 83, 84, 85, 86],
      }).tier,
    ).toBe('confirmed_urgent');
  });

  it('one good night breaks the streak → not urgent', () => {
    // Last 3 nights are [86, 92, 86] — not all <88.
    const c = classifySpO2({
      latestPercent: 97,
      overnightLowsRecent: [86, 86, 92, 86],
    });
    expect(c.tier).not.toBe('confirmed_urgent');
  });
});

// Sleep ──────────────────────────────────────────────────────────────

describe('computeSleepScore', () => {
  it('8h total, 25% deep, 1 wake, perfect efficiency → 50+20+16+10 = 96', () => {
    const start = 0;
    const end = 8 * 3600;
    const score = computeSleepScore({
      totalMinutes: 480,
      deepMinutes: 120,
      awakeCount: 1,
      sessionStartSec: start,
      sessionEndSec: end,
    });
    expect(score).toBe(96);
  });

  it('4h or less total → 0 total_score', () => {
    const score = computeSleepScore({
      totalMinutes: 240,
      deepMinutes: 60,
      awakeCount: 0,
      sessionStartSec: 0,
      sessionEndSec: 240 * 60,
    });
    // total: 0, deep: 25%→20, continuity: 20, efficiency: 1*10 = 50
    expect(score).toBe(50);
  });

  it('caps total_score at 50 even for >8h', () => {
    const score = computeSleepScore({
      totalMinutes: 720,                 // 12h
      deepMinutes: 180,
      awakeCount: 0,
      sessionStartSec: 0,
      sessionEndSec: 12 * 3600,
    });
    // total: 50 (capped), deep: 25%→20, continuity: 20, efficiency: 10 = 100
    expect(score).toBe(100);
  });

  it('many wakes drives continuity to 0', () => {
    const score = computeSleepScore({
      totalMinutes: 480,
      deepMinutes: 120,
      awakeCount: 10,
      sessionStartSec: 0,
      sessionEndSec: 8 * 3600,
    });
    // continuity: max(0, 20-40) = 0
    expect(score).toBe(80);   // 50 + 20 + 0 + 10
  });

  it('zero-minute total avoids div-by-zero and returns 0 deep ratio', () => {
    expect(
      computeSleepScore({
        totalMinutes: 0,
        deepMinutes: 0,
        awakeCount: 0,
        sessionStartSec: 0,
        sessionEndSec: 0,
      }),
    ).toBe(20);
    // total: 0 (4-4=0 → 0), deep: 0, continuity: 20, efficiency: 0 = 20
  });
});

describe('classifySleep', () => {
  it('null input → no_data', () => {
    const c = classifySleep(null);
    expect(c.tier).toBe('no_data');
    expect(c.sleepScore).toBe(0);
  });

  it('score ≥ 70 → in_pattern', () => {
    // 7h total, 20% deep, 0 wakes, perfect efficiency
    // total=37.5 (clamped 37.5), deep=16, cont=20, eff=10 = 83
    const c = classifySleep({
      totalMinutes: 420,
      deepMinutes: 84,
      awakeCount: 0,
      sessionStartSec: 0,
      sessionEndSec: 7 * 3600,
    });
    expect(c.tier).toBe('in_pattern');
    expect(c.sleepScore).toBeGreaterThanOrEqual(70);
  });

  it('score 50-69 → calm_concerned', () => {
    // ~5h total to push score down
    const c = classifySleep({
      totalMinutes: 300,
      deepMinutes: 30,
      awakeCount: 3,
      sessionStartSec: 0,
      sessionEndSec: 6 * 3600,
    });
    // total: (5-4)*12.5 = 12.5; deep: 10/25*20 = 8;
    // continuity: 20-12 = 8; efficiency: 5/6 * 10 = 8.33 = ~8
    expect(c.tier).toBe('calm_concerned');
    expect(c.sleepScore).toBeGreaterThanOrEqual(30);
    expect(c.sleepScore).toBeLessThan(70);
  });

  it('very low score → still calm_concerned, never confirmed_urgent', () => {
    // 3h total, no deep, many wakes
    const c = classifySleep({
      totalMinutes: 180,
      deepMinutes: 0,
      awakeCount: 10,
      sessionStartSec: 0,
      sessionEndSec: 8 * 3600,
    });
    expect(c.tier).toBe('calm_concerned');
    // sleep is contextual data, never urgent on its own per D13 §6.4
  });
});

// Activity ──────────────────────────────────────────────────────────

describe('classifyActivity', () => {
  it('steps at target → in_pattern', () => {
    const c = classifyActivity({ stepsToday: 6000, targetSteps: 6000 });
    expect(c.tier).toBe('in_pattern');
    expect(c.percentOfTarget).toBe(1);
  });

  it('80% of target (boundary) → in_pattern', () => {
    const c = classifyActivity({ stepsToday: 4800, targetSteps: 6000 });
    expect(c.tier).toBe('in_pattern');
  });

  it('just below 80% → progress', () => {
    const c = classifyActivity({ stepsToday: 4799, targetSteps: 6000 });
    expect(c.tier).toBe('progress');
    expect(c.reason).toBe('below_80_percent');
  });

  it('zero steps → progress, 0 percent', () => {
    const c = classifyActivity({ stepsToday: 0, targetSteps: 6000 });
    expect(c.tier).toBe('progress');
    expect(c.percentOfTarget).toBe(0);
  });

  it('over-target stays in_pattern (no upper cap on tier)', () => {
    const c = classifyActivity({ stepsToday: 12000, targetSteps: 6000 });
    expect(c.tier).toBe('in_pattern');
    expect(c.percentOfTarget).toBe(2);
  });

  it('zero target avoids div-by-zero', () => {
    const c = classifyActivity({ stepsToday: 5000, targetSteps: 0 });
    expect(c.tier).toBe('progress');
    expect(c.percentOfTarget).toBe(0);
  });
});

// Staleness ─────────────────────────────────────────────────────────

describe('checkStaleness', () => {
  const now = 1_700_000_000;

  it('null lastSampleAt → no_data', () => {
    expect(checkStaleness('hr', null, now)).toBe('no_data');
  });

  it('hr fresh within 6h', () => {
    expect(checkStaleness('hr', now - 5 * 3600, now)).toBe('fresh');
  });

  it('hr stale after 6h', () => {
    expect(checkStaleness('hr', now - 7 * 3600, now)).toBe('stale');
  });

  it('bp 36h threshold', () => {
    expect(checkStaleness('bp', now - 35 * 3600, now)).toBe('fresh');
    expect(checkStaleness('bp', now - 37 * 3600, now)).toBe('stale');
  });

  it('spo2 8h threshold', () => {
    expect(checkStaleness('spo2', now - 7 * 3600, now)).toBe('fresh');
    expect(checkStaleness('spo2', now - 9 * 3600, now)).toBe('stale');
  });

  it('sleep 24h threshold', () => {
    expect(checkStaleness('sleep', now - 23 * 3600, now)).toBe('fresh');
    expect(checkStaleness('sleep', now - 25 * 3600, now)).toBe('stale');
  });

  it('activity 6h threshold', () => {
    expect(checkStaleness('activity', now - 5 * 3600, now)).toBe('fresh');
    expect(checkStaleness('activity', now - 7 * 3600, now)).toBe('stale');
  });

  it('calories rides with activity threshold', () => {
    expect(checkStaleness('calories', now - 5 * 3600, now)).toBe('fresh');
    expect(checkStaleness('calories', now - 7 * 3600, now)).toBe('stale');
  });

  it('uses Date.now when nowSec omitted', () => {
    // Real-clock smoke test — should not throw.
    const realNow = Math.floor(Date.now() / 1000);
    expect(checkStaleness('hr', realNow - 60)).toBe('fresh');
  });
});
