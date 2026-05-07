// dailyPulse compose function — Sprint 7.5.
//
// Tests the pure composeDailyPulseData function directly with hand-
// crafted snapshots. The hook itself (useDailyPulseData) is verified
// by the syncMultiVitals integration on real-watch soak; this test
// suite proves the wiring between slice snapshots and the classifiers.

import {
  composeDailyPulseData,
  type DailyPulseSnapshot,
} from '../dailyPulse';
import type { LocalReading } from '../readings';
import type { SleepSession, ActivityDay } from '../../types/vitals';
import type { Classification } from '../../utils/classification';

// 2025-01-21 12:00:00 UTC.
const NOW_SEC = 1737460800;

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

describe('composeDailyPulseData', () => {
  it('returns no_data slices for an empty snapshot', () => {
    const data = composeDailyPulseData(EMPTY_SNAPSHOT, NOW_SEC);
    expect(data.todayDateLocal).toBe('2025-01-21');
    expect(data.bp.latest).toBeNull();
    expect(data.bp.classification).toBeNull();
    expect(data.bp.staleness).toBe('no_data');
    expect(data.hr.restingToday).toBeNull();
    expect(data.hr.classification).toBeNull();
    expect(data.spo2.latestPercent).toBeNull();
    expect(data.sleep.session).toBeNull();
    // Sleep classifier returns 'no_data' for null input per D13 §6.4.
    expect(data.sleep.classification?.tier).toBe('no_data');
    expect(data.activity.stepsToday).toBe(0);
    expect(data.activity.targetSteps).toBe(6000);
    expect(data.activity.classification).toBeNull();
  });

  it('classifies HR when restingBpmToday is in band', () => {
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        hrRestingToday: 65,
        hrRestingRecent: [],          // cold-start branch
        hrLatestSampleAt: NOW_SEC - 3600,
      },
      NOW_SEC,
    );
    expect(data.hr.restingToday).toBe(65);
    expect(data.hr.classification?.tier).toBe('in_pattern');
    expect(data.hr.classification?.reason).toBe('cold_start_in_band');
    expect(data.hr.staleness).toBe('fresh');
  });

  it('classifies HR confirmed_urgent on extreme value', () => {
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        hrRestingToday: 145,
        hrRestingRecent: [],
        hrLatestSampleAt: NOW_SEC,
      },
      NOW_SEC,
    );
    expect(data.hr.classification?.tier).toBe('confirmed_urgent');
    expect(data.hr.classification?.reason).toBe('extreme_value');
  });

  it('classifies SpO2 from latest percent', () => {
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        spo2LatestPercent: 96,
        spo2OvernightLowsRecent: [95, 94, 96],
        spo2LatestSampleAt: NOW_SEC - 1800,
      },
      NOW_SEC,
    );
    expect(data.spo2.latestPercent).toBe(96);
    expect(data.spo2.classification?.tier).toBe('in_pattern');
  });

  it('classifies SpO2 confirmed_urgent on 3-night sustained dip', () => {
    const data = composeDailyPulseData(
      {
        ...EMPTY_SNAPSHOT,
        spo2LatestPercent: 96,
        spo2OvernightLowsRecent: [85, 86, 87],
        spo2LatestSampleAt: NOW_SEC,
      },
      NOW_SEC,
    );
    expect(data.spo2.classification?.tier).toBe('confirmed_urgent');
    expect(data.spo2.classification?.reason).toBe('overnight_dip_sustained');
  });

  it('classifies sleep via classifySleep + computes score', () => {
    const sessionEndSec = NOW_SEC - 4 * 3600;
    const sessionStartSec = sessionEndSec - 7 * 3600 - 30 * 60;
    const session: SleepSession = {
      sessionStartSec,
      sessionEndSec,
      sessionStartLocal: new Date(sessionStartSec * 1000).toISOString(),
      sessionEndLocal: new Date(sessionEndSec * 1000).toISOString(),
      totalMinutes: 7 * 60 + 24,
      deepMinutes: 100,
      remMinutes: 80,
      lightMinutes: 240,
      awakeMinutes: 4,
      awakeCount: 1,
      transitions: [],
      sleepScore: 0,
    };
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, sleepSession: session },
      NOW_SEC,
    );
    expect(data.sleep.session).toBe(session);
    expect(data.sleep.classification?.tier).toBe('in_pattern');
    expect(data.sleep.classification?.sleepScore).toBeGreaterThanOrEqual(70);
  });

  it('classifies activity by percent of target', () => {
    const day: ActivityDay = {
      dayLocal: '2025-01-21',
      measuredAtSec: NOW_SEC - 12 * 3600,
      totalSteps: 7200,
      targetSteps: 6000,
      lastSampleAtSec: NOW_SEC - 600,
      hourly: new Array<number>(24).fill(0),
    };
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, activityToday: day },
      NOW_SEC,
    );
    expect(data.activity.stepsToday).toBe(7200);
    expect(data.activity.targetSteps).toBe(6000);
    expect(data.activity.classification?.tier).toBe('in_pattern');
    expect(data.activity.classification?.percentOfTarget).toBeCloseTo(1.2);
  });

  it('marks BP slice via the LocalReading classification + measuredAtSec staleness', () => {
    const classification: Classification = {
      tier: 'in_pattern',
      reason: 'cold_start',
    };
    const reading: LocalReading = {
      localId: 'a',
      serverId: null,
      measuredAtSec: NOW_SEC - 1800,
      systolic: 122,
      diastolic: 78,
      pulse: 70,
      source: 'watch',
      classification,
      deviceBleId: 'AA:BB:CC:DD:E4:F2',
      capturedAtMs: NOW_SEC * 1000,
    };
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, bpLatest: reading },
      NOW_SEC,
    );
    expect(data.bp.latest).toEqual({ systolic: 122, diastolic: 78, pulse: 70 });
    expect(data.bp.classification).toBe(classification);
    expect(data.bp.staleness).toBe('fresh');
  });

  it('marks BP stale when the latest reading is older than 36h', () => {
    const reading: LocalReading = {
      localId: 'b',
      serverId: null,
      measuredAtSec: NOW_SEC - 48 * 3600,
      systolic: 122,
      diastolic: 78,
      pulse: 70,
      source: 'watch',
      classification: { tier: 'in_pattern', reason: 'cold_start' },
      deviceBleId: 'AA:BB:CC:DD:E4:F2',
      capturedAtMs: NOW_SEC * 1000,
    };
    const data = composeDailyPulseData(
      { ...EMPTY_SNAPSHOT, bpLatest: reading },
      NOW_SEC,
    );
    expect(data.bp.staleness).toBe('stale');
  });
});
