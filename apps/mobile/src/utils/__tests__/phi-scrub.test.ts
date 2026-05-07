// PHI scrub — Sprint 7.5 / D13 §13.3.
//
// Failing any of these tests means a regression: someone added a new
// vital field without thinking about its egress, or the scrub stopped
// stripping a field that must be stripped.

import {
  scrubBPReading,
  scrubHRSample,
  scrubSpO2Sample,
  scrubSleepSession,
  scrubActivityDay,
  scrubCaloriesDay,
  scrubForAi,
  assertScrubbed,
  quantiseToDay,
} from '../phi-scrub';
import type {
  BPReading,
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
  CaloriesDay,
  MultiVitalsPayload,
} from '../../types/vitals';

const NOW = 1737460800; // 2025-01-21 12:00:00 UTC
const NOON_TODAY = NOW;
const START_OF_TODAY = 1737417600; // 2025-01-21 00:00:00 UTC

describe('quantiseToDay', () => {
  it('rounds noon-today to start-of-day UTC', () => {
    expect(quantiseToDay(NOON_TODAY)).toBe(START_OF_TODAY);
  });
  it('is idempotent on a value already at start-of-day', () => {
    expect(quantiseToDay(START_OF_TODAY)).toBe(START_OF_TODAY);
  });
});

describe('scrubBPReading', () => {
  it('quantises measuredAtSec to start-of-day, preserves values + source', () => {
    const r: BPReading = {
      measuredAtSec: NOON_TODAY,
      systolic: 122,
      diastolic: 78,
      pulse: 70,
      source: 'watch',
    };
    expect(scrubBPReading(r)).toEqual({
      measuredAtSec: START_OF_TODAY,
      systolic: 122,
      diastolic: 78,
      pulse: 70,
      source: 'watch',
    });
  });
});

describe('scrubHRSample', () => {
  it('strips sampleWindowSec + isSpotCheck, quantises timestamp', () => {
    const s: HRSample = {
      measuredAtSec: NOON_TODAY,
      bpm: 65,
      sampleWindowSec: 1800,
      motionState: 'rest',
      isSpotCheck: true,
    };
    const out = scrubHRSample(s);
    expect(out).toEqual({
      measuredAtSec: START_OF_TODAY,
      bpm: 65,
      motionState: 'rest',
    });
    expect('sampleWindowSec' in out).toBe(false);
    expect('isSpotCheck' in out).toBe(false);
  });
});

describe('scrubSpO2Sample', () => {
  it('strips perfusionIndex / sampleWindowSec / isSpotCheck, keeps min/max', () => {
    const s: SpO2Sample = {
      measuredAtSec: NOON_TODAY,
      percent: 96,
      maxInWindow: 98,
      minInWindow: 94,
      sampleWindowSec: 1800,
      isSpotCheck: false,
      perfusionIndex: 0.7,
    };
    const out = scrubSpO2Sample(s);
    expect(out).toEqual({
      measuredAtSec: START_OF_TODAY,
      percent: 96,
      maxInWindow: 98,
      minInWindow: 94,
    });
    expect('perfusionIndex' in out).toBe(false);
    expect('sampleWindowSec' in out).toBe(false);
    expect('isSpotCheck' in out).toBe(false);
  });
});

describe('scrubSleepSession', () => {
  it('drops the user-local ISO strings + quantises timestamps', () => {
    const session: SleepSession = {
      sessionStartSec: NOW - 8 * 3600,
      sessionEndSec: NOW,
      sessionStartLocal: '2025-01-21T04:00:00.000+01:00',
      sessionEndLocal: '2025-01-21T12:00:00.000+01:00',
      totalMinutes: 444,
      deepMinutes: 100,
      remMinutes: 80,
      lightMinutes: 240,
      awakeMinutes: 24,
      awakeCount: 2,
      transitions: [
        { atSec: NOW - 8 * 3600 + 73, stage: 'light' }, // odd-second
        { atSec: NOW - 6 * 3600, stage: 'deep' },
      ],
      sleepScore: 78,
    };
    const out = scrubSleepSession(session);
    expect('sessionStartLocal' in out).toBe(false);
    expect('sessionEndLocal' in out).toBe(false);
    // Per-second timestamps quantised: start-of-day vs minute-rounded
    // for transitions.
    expect(out.sessionStartSec).toBe(START_OF_TODAY);
    expect(out.sessionEndSec).toBe(START_OF_TODAY);
    // Transition rounded to minute (atSec was NOW - 8h + 73s).
    const expected = Math.floor((NOW - 8 * 3600 + 73) / 60) * 60;
    expect(out.transitions[0].atSec).toBe(expected);
    expect(out.totalMinutes).toBe(444);
    expect(out.sleepScore).toBe(78);
  });
});

describe('scrubActivityDay', () => {
  it('strips lastSampleAtSec + measuredAtSec, keeps dayLocal + totals + hourly', () => {
    const day: ActivityDay = {
      dayLocal: '2025-01-21',
      measuredAtSec: START_OF_TODAY,
      totalSteps: 7200,
      targetSteps: 6000,
      lastSampleAtSec: NOW,
      hourly: new Array<number>(24).fill(0).map((_, i) => i * 100),
    };
    const out = scrubActivityDay(day);
    expect(out).toEqual({
      dayLocal: '2025-01-21',
      totalSteps: 7200,
      targetSteps: 6000,
      hourly: day.hourly,
    });
    expect('lastSampleAtSec' in out).toBe(false);
    expect('measuredAtSec' in out).toBe(false);
  });
});

describe('scrubCaloriesDay', () => {
  it('strips measuredAtSec, keeps dayLocal + kcal split', () => {
    const day: CaloriesDay = {
      dayLocal: '2025-01-21',
      measuredAtSec: START_OF_TODAY,
      totalKcal: 1800,
      activityKcal: 400,
      bmrKcal: 1400,
      targetKcal: 2000,
    };
    const out = scrubCaloriesDay(day);
    expect(out).toEqual({
      dayLocal: '2025-01-21',
      totalKcal: 1800,
      activityKcal: 400,
      bmrKcal: 1400,
      targetKcal: 2000,
    });
    expect('measuredAtSec' in out).toBe(false);
  });
});

describe('scrubForAi (full payload)', () => {
  it('strips device entirely + applies per-vital scrubs', () => {
    const payload: MultiVitalsPayload = {
      device: {
        bleId: 'AA:BB:CC:DD:E4:F2',
        macSuffix: 'e4f2',
        name: 'Leiko Watch',
        model: 'U19M',
      },
      hrSamples: [
        { measuredAtSec: NOW, bpm: 65, sampleWindowSec: 1800, motionState: 'rest', isSpotCheck: false },
      ],
      spo2Samples: [
        {
          measuredAtSec: NOW,
          percent: 96,
          maxInWindow: 97,
          minInWindow: 95,
          sampleWindowSec: 1800,
          isSpotCheck: false,
          perfusionIndex: 0.7,
        },
      ],
      clientSyncedAtSec: NOW,
      clientAppVersion: '0.0.1',
    };
    const out = scrubForAi(payload);
    expect('device' in out).toBe(false);
    expect(out.hrSamples).toHaveLength(1);
    expect('sampleWindowSec' in out.hrSamples![0]).toBe(false);
    expect('perfusionIndex' in out.spo2Samples![0]).toBe(false);
    expect(out.clientSyncedAtSec).toBe(START_OF_TODAY);
    expect(out.clientAppVersion).toBe('0.0.1');
  });

  it('preserves the array-shape (BP / sleep / activity / calories independently optional)', () => {
    const out = scrubForAi({
      device: {
        bleId: 'X',
        macSuffix: 'X',
        name: null,
        model: 'U16H',
      },
      bpReadings: [{ measuredAtSec: NOW, systolic: 120, diastolic: 80, pulse: 70, source: 'watch' }],
      clientSyncedAtSec: NOW,
      clientAppVersion: '0.0.1',
    });
    expect(out.bpReadings).toHaveLength(1);
    expect(out.hrSamples).toBeUndefined();
    expect(out.sleepSessions).toBeUndefined();
  });
});

describe('assertScrubbed', () => {
  it('passes for a properly scrubbed payload', () => {
    const out = scrubForAi({
      device: { bleId: 'X', macSuffix: 'X', name: null, model: 'U16H' },
      hrSamples: [
        { measuredAtSec: NOW, bpm: 65, sampleWindowSec: 1800, motionState: 'rest', isSpotCheck: false },
      ],
      clientSyncedAtSec: NOW,
      clientAppVersion: '0.0.1',
    });
    expect(() => assertScrubbed(out)).not.toThrow();
  });

  it('throws when a banned key sneaks into the scrubbed shape', () => {
    const tainted = {
      bleId: 'AA:BB',
      hrSamples: [],
      clientSyncedAtSec: NOW,
      clientAppVersion: '0.0.1',
    } as unknown as Parameters<typeof assertScrubbed>[0];
    expect(() => assertScrubbed(tainted)).toThrow(/banned keys/);
  });

  it('throws when a sample carries perfusionIndex through manual construction', () => {
    const tainted = {
      hrSamples: [],
      spo2Samples: [
        {
          measuredAtSec: START_OF_TODAY,
          percent: 96,
          maxInWindow: 97,
          minInWindow: 95,
          perfusionIndex: 0.7, // banned
        },
      ],
      clientSyncedAtSec: START_OF_TODAY,
      clientAppVersion: '0.0.1',
    } as unknown as Parameters<typeof assertScrubbed>[0];
    expect(() => assertScrubbed(tainted)).toThrow(/perfusionIndex/);
  });
});
