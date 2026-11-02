// Health Connect record builders — the duplicate / overcount fix
// (2026-11-02). Every record must carry a stable clientRecordId so a
// re-sent row updates in place instead of being added again.

import {
  bloodPressureRecords,
  caloriesRecords,
  clientRecordId,
  dayWindowSec,
  localDayStartSec,
  heartRateRecords,
  LEIKO_HC_DEVICE,
  oxygenRecords,
  RECORDING_ACTIVE,
  RECORDING_AUTOMATIC,
  RECORDING_MANUAL,
  sleepRecords,
  stepsRecords,
} from '../adapters/hcRecords';
import type { ActivityDay, CaloriesDay, SleepSession } from '../../../types/vitals';

type Meta = {
  clientRecordId: string;
  clientRecordVersion: number;
  recordingMethod: number;
  device?: typeof LEIKO_HC_DEVICE;
};
const meta = (r: unknown): Meta => (r as { metadata: Meta }).metadata;
const field = <T>(r: unknown, k: string): T => (r as Record<string, T>)[k];

const DAY = 1_762_041_600; // 2025-11-02T00:00:00Z
const NOW = DAY + 10 * 3600; // 10:00 the same day

function stepsDay(totalSteps: number): ActivityDay {
  return {
    dayLocal: '2025-11-02',
    measuredAtSec: DAY,
    totalSteps,
    targetSteps: 6000,
    lastSampleAtSec: NOW,
    hourly: Array(24).fill(0),
  };
}

describe('clientRecordId', () => {
  it('is stable for the same vital and instant', () => {
    expect(clientRecordId('bp', 1700000000)).toBe(clientRecordId('bp', 1700000000.9));
    expect(clientRecordId('bp', 1700000000)).not.toBe(clientRecordId('hr', 1700000000));
  });
});

describe('steps — the overcount bug', () => {
  it('two syncs of the same day share one id, and the bigger total wins', () => {
    const [morning] = stepsRecords([stepsDay(1200)], NOW, 'UTC');
    const [later] = stepsRecords([stepsDay(4000)], NOW + 3600, 'UTC');
    expect(meta(morning).clientRecordId).toBe(meta(later).clientRecordId);
    expect(meta(later).clientRecordVersion).toBeGreaterThan(meta(morning).clientRecordVersion);
    expect(field<number>(later, 'count')).toBe(4000);
  });

  it("today's record never ends in the future", () => {
    const [r] = stepsRecords([stepsDay(1200)], NOW, 'UTC');
    expect(field<string>(r, 'endTime')).toBe(new Date(NOW * 1000).toISOString());
  });

  it('a finished day spans the whole day', () => {
    const [r] = stepsRecords([stepsDay(9000)], DAY + 3 * 86_400, 'UTC');
    expect(field<string>(r, 'endTime')).toBe(new Date((DAY + 86_400) * 1000).toISOString());
  });

  it('one step still gets a positive version', () => {
    const [r] = stepsRecords([stepsDay(1)], NOW);
    expect(meta(r).clientRecordVersion).toBeGreaterThanOrEqual(1);
  });
});

describe('calories', () => {
  it('fractional increases still raise the version', () => {
    const day = (kcal: number): CaloriesDay => ({
      dayLocal: '2025-11-02',
      measuredAtSec: DAY,
      totalKcal: 1800,
      activityKcal: kcal,
      bmrKcal: 1500,
      targetKcal: null,
    });
    const [a] = caloriesRecords([day(120.1)], NOW);
    const [b] = caloriesRecords([day(120.4)], NOW);
    expect(meta(a).clientRecordId).toBe(meta(b).clientRecordId);
    expect(meta(b).clientRecordVersion).toBeGreaterThan(meta(a).clientRecordVersion);
  });
});

describe('day windows — local midnight, not the UTC day key (2026-11-02)', () => {
  it('Chicago day starts at 06:00 UTC in winter, 05:00 UTC in summer', () => {
    expect(new Date(localDayStartSec('2026-11-02', 'America/Chicago') * 1000).toISOString()).toBe(
      '2026-11-02T06:00:00.000Z',
    );
    expect(new Date(localDayStartSec('2026-07-01', 'America/Chicago') * 1000).toISOString()).toBe(
      '2026-07-01T05:00:00.000Z',
    );
    expect(new Date(localDayStartSec('2026-11-02', 'Africa/Lagos') * 1000).toISOString()).toBe(
      '2026-11-01T23:00:00.000Z',
    );
  });

  it('the day DST ends is 25 hours long', () => {
    const w = dayWindowSec('2026-11-01', Date.UTC(2026, 11, 1) / 1000, 'America/Chicago');
    expect(w.end - w.start).toBe(25 * 3600);
  });

  it('a Chicago steps record spans local midnight to local midnight', () => {
    const day: ActivityDay = { ...stepsDay(5000), dayLocal: '2026-10-31', measuredAtSec: Date.UTC(2026, 9, 31) / 1000 };
    const [r] = stepsRecords([day], Date.UTC(2026, 10, 2) / 1000, 'America/Chicago');
    expect(field<string>(r, 'startTime')).toBe('2026-10-31T05:00:00.000Z');
    expect(field<string>(r, 'endTime')).toBe('2026-11-01T05:00:00.000Z');
  });

  it('never ends before it starts', () => {
    const w = dayWindowSec('2026-11-02', 0, 'UTC');
    expect(w.end).toBe(w.start + 1);
  });

  it('re-written day records outrank the ones written with the old window', () => {
    const [r] = stepsRecords([stepsDay(1)], NOW, 'UTC');
    expect(meta(r).clientRecordVersion).toBeGreaterThan(1_000_000);
  });
});

describe('blood pressure', () => {
  const base = { measuredAtSec: NOW, systolic: 124, diastolic: 80, pulse: 70 };

  it('watch readings are labelled as taken on the Leiko watch', () => {
    const [r] = bloodPressureRecords([{ ...base, source: 'watch' }]);
    expect(meta(r).device).toEqual(LEIKO_HC_DEVICE);
    expect(meta(r).recordingMethod).toBe(RECORDING_ACTIVE);
    expect(meta(r).clientRecordId).toBe(`leiko-bp-${NOW}`);
  });

  it('manual readings are labelled manual and not attributed to the watch', () => {
    const [r] = bloodPressureRecords([{ ...base, source: 'manual' }]);
    expect(meta(r).recordingMethod).toBe(RECORDING_MANUAL);
    expect(meta(r).device).toBeUndefined();
  });
});

describe('heart rate and oxygen', () => {
  it('automatic samples vs spot checks', () => {
    const [auto] = heartRateRecords([
      { measuredAtSec: NOW, bpm: 72, sampleWindowSec: 30, motionState: 'rest', isSpotCheck: false },
    ]);
    const [spot] = oxygenRecords([
      {
        measuredAtSec: NOW,
        percent: 97,
        maxInWindow: 98,
        minInWindow: 96,
        sampleWindowSec: 1,
        isSpotCheck: true,
        perfusionIndex: null,
      },
    ]);
    expect(meta(auto).recordingMethod).toBe(RECORDING_AUTOMATIC);
    expect(meta(spot).recordingMethod).toBe(RECORDING_ACTIVE);
    expect(meta(auto).clientRecordId).not.toBe(meta(spot).clientRecordId);
  });
});

describe('sleep', () => {
  it('a night re-reported with more detail updates the same record', () => {
    const night = (total: number, awake: number): SleepSession =>
      ({
        sessionStartSec: DAY - 6 * 3600,
        sessionEndSec: DAY + 2 * 3600,
        sessionStartLocal: '',
        sessionEndLocal: '',
        totalMinutes: total,
        deepMinutes: 60,
        remMinutes: 0,
        lightMinutes: total - 60,
        awakeMinutes: awake,
        awakeCount: 1,
        transitions: [],
        sleepScore: 70,
      }) as SleepSession;
    const [a] = sleepRecords([night(400, 10)]);
    const [b] = sleepRecords([night(420, 15)]);
    expect(meta(a).clientRecordId).toBe(meta(b).clientRecordId);
    expect(meta(b).clientRecordVersion).toBeGreaterThan(meta(a).clientRecordVersion);
  });
});

describe('records Health Connect would reject (2026-11-02 device test)', () => {
  it('skips 0-step days — StepsRecord requires count >= 1', () => {
    expect(stepsRecords([stepsDay(0), stepsDay(12)], NOW)).toHaveLength(1);
  });

  it('skips days with no active calories', () => {
    const day = (kcal: number): CaloriesDay => ({
      dayLocal: '2025-11-02',
      measuredAtSec: DAY,
      totalKcal: 1500,
      activityKcal: kcal,
      bmrKcal: 1500,
      targetKcal: null,
    });
    expect(caloriesRecords([day(0), day(Number.NaN), day(5)], NOW)).toHaveLength(1);
  });

  it('skips a night whose end is not after its start', () => {
    const bad = {
      sessionStartSec: DAY,
      sessionEndSec: DAY,
      sessionStartLocal: '',
      sessionEndLocal: '',
      totalMinutes: 0,
      deepMinutes: 0,
      remMinutes: 0,
      lightMinutes: 0,
      awakeMinutes: 0,
      awakeCount: 0,
      transitions: [],
      sleepScore: 0,
    } as SleepSession;
    expect(sleepRecords([bad])).toHaveLength(0);
  });
});
