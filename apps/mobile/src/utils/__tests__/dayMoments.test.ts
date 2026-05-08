// dayMoments — Sprint 8.
//
// Pure-function tests for the central-value picker (D13 §7.2) + the
// DaySpine moment derivation. No React, no MMKV — feeds composed
// DailyPulseData snapshots directly.

import {
  composeDailyPulseData,
  type DailyPulseSnapshot,
} from '../../state/dailyPulse';
import {
  deriveDayMoments,
  formatClockTime,
  formatSleepDuration,
  formatSteps,
  pickCentralValue,
} from '../dayMoments';
import type { LocalReading } from '../../state/readings';
import type { SleepSession } from '../../types/vitals';

// 2026-05-08 12:00:00 UTC.
const NOW_SEC = 1778414400;

const EMPTY_SNAPSHOT: DailyPulseSnapshot = {
  bpLatest: null,
  hrRestingToday: null,
  hrRestingRecent: [],
  hrLatestSampleAt: null,
  spo2LatestPercent: null,
  spo2OvernightLowsRecent: [],
  spo2LatestSampleAt: null,
  sleepSession: null,
  activityToday: null,
};

function makeBp(measuredAtSec: number, sys = 122, dia = 78, pulse: number | null = 64): LocalReading {
  return {
    localId: `local-${measuredAtSec}`,
    serverId: null,
    measuredAtSec,
    systolic: sys,
    diastolic: dia,
    pulse,
    source: 'watch',
    classification: { tier: 'in_pattern', reason: 'within_baseline' },
    deviceBleId: null,
    capturedAtMs: measuredAtSec * 1000,
  };
}

function makeSleep(endSec: number, totalMinutes = 7 * 60 + 42, awakeCount = 1): SleepSession {
  const startSec = endSec - totalMinutes * 60;
  return {
    sessionStartSec: startSec,
    sessionEndSec: endSec,
    sessionStartLocal: new Date(startSec * 1000).toISOString(),
    sessionEndLocal: new Date(endSec * 1000).toISOString(),
    totalMinutes,
    deepMinutes: 90,
    remMinutes: 80,
    lightMinutes: totalMinutes - 90 - 80 - 4,
    awakeMinutes: 4,
    awakeCount,
    transitions: [],
    sleepScore: 78,
  };
}

// ---------------------------------------------------------------------------
// pickCentralValue — D13 §7.2 priority cascade.
// ---------------------------------------------------------------------------

describe('pickCentralValue', () => {
  it('priority 1: fresh BP within 8h wins, label keys off the BP local hour', () => {
    // BP measured at 6:42am LOCAL — produced via Date(year, month, day, h, m).
    const dawn = new Date(2026, 4, 8, 6, 42).getTime() / 1000;
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, bpLatest: makeBp(dawn) },
      dawn + 60 * 60,
    );
    const central = pickCentralValue(data, dawn + 60 * 60);
    expect(central).toMatchObject({
      value: '122/78',
      priority: 'bp',
    });
    expect(central.label).toBe('morning BP');
  });

  it('priority 1: afternoon-measured BP labels as "latest BP"', () => {
    const dusk = new Date(2026, 4, 8, 16, 30).getTime() / 1000;
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, bpLatest: makeBp(dusk) },
      dusk + 60 * 60,
    );
    expect(pickCentralValue(data, dusk + 60 * 60).label).toBe('latest BP');
  });

  it('priority 2: HR resting today fills in when BP is absent', () => {
    const hrAt = NOW_SEC - 60 * 60;
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        hrRestingToday: 64,
        hrRestingRecent: [],
        hrLatestSampleAt: hrAt,
      },
      NOW_SEC,
    );
    const central = pickCentralValue(data, NOW_SEC);
    expect(central).toEqual({ value: '64', label: 'resting HR', priority: 'hr' });
  });

  it('priority 3: last night sleep when BP and HR both absent', () => {
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        sleepSession: makeSleep(NOW_SEC - 4 * 3600, 7 * 60 + 24),
      },
      NOW_SEC,
    );
    const central = pickCentralValue(data, NOW_SEC);
    expect(central).toEqual({ value: '7h 24m', label: 'last night', priority: 'sleep' });
  });

  it('priority 4: dash when no vital exists (calm empty state)', () => {
    const data = composeDailyPulseData(EMPTY_SNAPSHOT, NOW_SEC);
    const central = pickCentralValue(data, NOW_SEC);
    expect(central).toEqual({
      value: '—',
      label: 'no readings yet today',
      priority: 'none',
    });
  });

  it('priority 1 expires after 8h — falls through to HR', () => {
    const oldBpSec = NOW_SEC - 9 * 3600;
    const hrSec = NOW_SEC - 30 * 60;
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        bpLatest: makeBp(oldBpSec),
        hrRestingToday: 65,
        hrRestingRecent: [],
        hrLatestSampleAt: hrSec,
      },
      NOW_SEC,
    );
    expect(pickCentralValue(data, NOW_SEC).priority).toBe('hr');
  });
});

// ---------------------------------------------------------------------------
// deriveDayMoments — DaySpine source.
// ---------------------------------------------------------------------------

describe('deriveDayMoments', () => {
  it('returns an empty array when nothing is recorded', () => {
    const data = composeDailyPulseData(EMPTY_SNAPSHOT, NOW_SEC);
    expect(deriveDayMoments(data, NOW_SEC)).toEqual([]);
  });

  it('builds a sleep-then-BP spine in chronological order', () => {
    const sleepEnd = NOW_SEC - 6 * 3600;
    const bpAt = NOW_SEC - 5 * 3600 - 18 * 60;
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        sleepSession: makeSleep(sleepEnd, 7 * 60 + 42, 1),
        bpLatest: makeBp(bpAt),
      },
      NOW_SEC,
    );
    const moments = deriveDayMoments(data, NOW_SEC);
    expect(moments.map((m) => m.vital)).toEqual(['sleep', 'bp']);
    expect(moments[0].title).toBe('A quieter night');
    expect(moments[0].sub).toBe('7h 42m · 1 awakening');
    expect(moments[1].title).toBe('Morning reading');
    expect(moments[1].sub).toContain('BP 122/78 · pulse 64');
    expect(moments[1].past).toBe(false);
  });

  it('flags concerned BP readings via classification tier', () => {
    const bpAt = NOW_SEC - 30 * 60;
    const reading: LocalReading = {
      ...makeBp(bpAt, 142, 92, 78),
      classification: { tier: 'calm_concerned', reason: 'outlier_and_soft_threshold' },
    };
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, bpLatest: reading },
      NOW_SEC,
    );
    const moments = deriveDayMoments(data, NOW_SEC);
    expect(moments).toHaveLength(1);
    expect(moments[0]).toMatchObject({
      vital: 'bp',
      concerned: true,
    });
  });

  it('renders an SpO2 dip moment only when calm-concerned', () => {
    const sleepEnd = NOW_SEC - 4 * 3600;
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        sleepSession: makeSleep(sleepEnd, 7 * 60),
        // Last overnight low of 89 is in the [88, 89] borderline band per
        // classifySpO2 → calm_concerned. The moment renderer also requires
        // recentLow ≤ 92% to anchor, which 89% satisfies.
        spo2LatestPercent: 96,
        spo2OvernightLowsRecent: [92, 90, 89],
        spo2LatestSampleAt: NOW_SEC - 2 * 3600,
      },
      NOW_SEC,
    );
    const moments = deriveDayMoments(data, NOW_SEC);
    const spo2 = moments.find((m) => m.vital === 'spo2');
    expect(spo2).toBeDefined();
    expect(spo2!.title).toBe('A brief oxygen dip');
    expect(spo2!.concerned).toBe(true);
  });

  it('omits the SpO2 dip when latest classification is in pattern', () => {
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        spo2LatestPercent: 98,
        spo2OvernightLowsRecent: [97, 96, 98],
        spo2LatestSampleAt: NOW_SEC - 60 * 60,
      },
      NOW_SEC,
    );
    expect(deriveDayMoments(data, NOW_SEC).find((m) => m.vital === 'spo2')).toBeUndefined();
  });

  it('marks BP older than 6h as past', () => {
    const oldBpSec = NOW_SEC - 7 * 3600;
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, bpLatest: makeBp(oldBpSec) },
      NOW_SEC,
    );
    const moments = deriveDayMoments(data, NOW_SEC);
    expect(moments[0].past).toBe(true);
  });

  it('emits an activity moment whenever steps > 0', () => {
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        activityToday: {
          dayLocal: '2026-05-08',
          measuredAtSec: NOW_SEC - 5 * 3600,
          totalSteps: 2140,
          targetSteps: 6000,
          lastSampleAtSec: NOW_SEC - 30 * 60,
          hourly: new Array(24).fill(0),
        },
      },
      NOW_SEC,
    );
    const activity = deriveDayMoments(data, NOW_SEC).find((m) => m.vital === 'activity');
    expect(activity).toBeDefined();
    expect(activity!.sub).toBe('2,140 steps');
  });
});

// ---------------------------------------------------------------------------
// Format helpers — small but worth pinning for voice + display.
// ---------------------------------------------------------------------------

describe('format helpers', () => {
  it('formatSleepDuration → "7h 24m"', () => {
    expect(formatSleepDuration(7 * 60 + 24)).toBe('7h 24m');
  });
  it('formatSteps adds locale separators', () => {
    expect(formatSteps(2140)).toMatch(/2,140|2140/);
  });
  it('formatClockTime renders short am/pm', () => {
    // 06:42 local — covering both halves of the clock.
    const dawn = new Date(2026, 4, 8, 6, 42).getTime() / 1000;
    expect(formatClockTime(dawn)).toBe('6:42a');
    const dusk = new Date(2026, 4, 8, 21, 18).getTime() / 1000;
    expect(formatClockTime(dusk)).toBe('9:18p');
  });
});
