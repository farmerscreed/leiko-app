// Sleep slice — reconcileWakeSources unit tests. Sprint 18.

import { mmkv } from '../../services/storage';
import { useSleep } from '../sleep';
import { epochSecForLocalHour } from '../../utils/userTz';
import type { HRSample, SleepSession } from '../../types/vitals';

const TZ = 'Africa/Lagos';

function sample(measuredAtSec: number, bpm: number): HRSample {
  return {
    measuredAtSec,
    bpm,
    sampleWindowSec: 300,
    motionState: 'unknown',
    isSpotCheck: false,
  };
}

function buildHRForWake(
  dayLocal: string,
  sleepBpm: number,
  wakeBpm: number,
  wakeHourLocal: number,
): HRSample[] {
  const samples: HRSample[] = [];
  const priorMs = new Date(`${dayLocal}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  const priorDay = new Date(priorMs).toISOString().slice(0, 10);
  const startSec = epochSecForLocalHour(priorDay, 22, TZ);
  const endSec = epochSecForLocalHour(dayLocal, 9, TZ);
  const wakeSec = epochSecForLocalHour(dayLocal, wakeHourLocal, TZ);
  for (let t = startSec; t <= endSec; t += 5 * 60) {
    samples.push(sample(t, t >= wakeSec ? wakeBpm : sleepBpm));
  }
  return samples;
}

function legacySession(dayLocal: string, totalMinutes: number): SleepSession {
  const dayStartSec = Math.floor(new Date(`${dayLocal}T00:00:00Z`).getTime() / 1000);
  const sessionEndSec = dayStartSec + 8 * 3600; // legacy 08:00 UTC synthesis
  const sessionStartSec = sessionEndSec - totalMinutes * 60;
  return {
    sessionStartSec,
    sessionEndSec,
    sessionStartLocal: new Date(sessionStartSec * 1000).toISOString(),
    sessionEndLocal: new Date(sessionEndSec * 1000).toISOString(),
    totalMinutes,
    deepMinutes: 90,
    remMinutes: 0,
    lightMinutes: 200,
    awakeMinutes: 0,
    awakeCount: 0,
    transitions: [],
    sleepScore: 65,
  };
}

beforeEach(() => {
  mmkv.clearAll();
  useSleep.getState().reset();
});

describe('reconcileWakeSources', () => {
  it('upgrades a legacy session to hr_inferred when HR data has a clear surge', () => {
    const dayLocal = '2026-05-22';
    useSleep.getState().addPending(legacySession(dayLocal, 420));
    const hr = buildHRForWake(dayLocal, 58, 78, 6.5);

    const upgraded = useSleep.getState().reconcileWakeSources(hr, TZ);
    expect(upgraded).toBe(1);
    const row = useSleep.getState().pending[0];
    expect(row.wakeSource).toBe('hr_inferred');
    expect(row.inferredSessionEndSec).toBeDefined();
    // Inferred wake ≈ 06:30 Lagos = 05:30 UTC = dayStart + 5.5h.
    const dayStart = Math.floor(new Date(`${dayLocal}T00:00:00Z`).getTime() / 1000);
    expect(row.inferredSessionEndSec).toBeGreaterThan(dayStart + 5 * 3600);
    expect(row.inferredSessionEndSec).toBeLessThan(dayStart + 6 * 3600);
    // Original boundaries are untouched — server identity preserved.
    expect(row.sessionStartSec).toBe(legacySession(dayLocal, 420).sessionStartSec);
    expect(row.sessionEndSec).toBe(legacySession(dayLocal, 420).sessionEndSec);
  });

  it('stamps a legacy session as fallback when HR is empty', () => {
    const dayLocal = '2026-05-22';
    useSleep.getState().addPending(legacySession(dayLocal, 420));

    const upgraded = useSleep.getState().reconcileWakeSources([], TZ);
    expect(upgraded).toBe(1);
    const row = useSleep.getState().pending[0];
    expect(row.wakeSource).toBe('fallback');
    expect(row.inferredSessionEndSec).toBeDefined();
  });

  it('does not overwrite an already-hr_inferred session', () => {
    const dayLocal = '2026-05-22';
    const base = legacySession(dayLocal, 420);
    useSleep.getState().addPending({
      ...base,
      wakeSource: 'hr_inferred',
      inferredSessionEndSec: base.sessionEndSec - 99,
      inferredSessionStartSec: base.sessionStartSec - 99,
    });
    const hr = buildHRForWake(dayLocal, 58, 78, 7);

    const upgraded = useSleep.getState().reconcileWakeSources(hr, TZ);
    expect(upgraded).toBe(0);
    const row = useSleep.getState().pending[0];
    expect(row.inferredSessionEndSec).toBe(base.sessionEndSec - 99);
  });

  it('does not change a fallback row when HR is still empty', () => {
    const dayLocal = '2026-05-22';
    const base = legacySession(dayLocal, 420);
    useSleep.getState().addPending({
      ...base,
      wakeSource: 'fallback',
      inferredSessionEndSec: base.sessionEndSec,
      inferredSessionStartSec: base.sessionStartSec,
    });

    const upgraded = useSleep.getState().reconcileWakeSources([], TZ);
    expect(upgraded).toBe(0);
  });

  it('upgrades a fallback row to hr_inferred when HR finally arrives', () => {
    const dayLocal = '2026-05-22';
    const base = legacySession(dayLocal, 420);
    useSleep.getState().addPending({
      ...base,
      wakeSource: 'fallback',
    });
    const hr = buildHRForWake(dayLocal, 58, 78, 6.5);

    const upgraded = useSleep.getState().reconcileWakeSources(hr, TZ);
    expect(upgraded).toBe(1);
    expect(useSleep.getState().pending[0].wakeSource).toBe('hr_inferred');
  });

  it('returns 0 when called with an empty tz', () => {
    const dayLocal = '2026-05-22';
    useSleep.getState().addPending(legacySession(dayLocal, 420));
    expect(useSleep.getState().reconcileWakeSources([], '')).toBe(0);
  });
});
