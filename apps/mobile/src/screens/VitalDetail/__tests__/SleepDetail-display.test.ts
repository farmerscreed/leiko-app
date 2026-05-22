// SleepDetail pure-helper tests — Sprint 18.

import { bedTimeSub, displayWindow } from '../SleepDetail';
import type { SleepSession } from '../../../types/vitals';

const TZ_LAGOS = 'Africa/Lagos';
const TZ_NYC = 'America/New_York';

describe('bedTimeSub', () => {
  // 22:00 → 06:30 the next morning, anchored at 2026-05-22 in Lagos.
  // 21:00 UTC = 22:00 Lagos. 05:30 UTC = 06:30 Lagos.
  const bedSec = Math.floor(new Date('2026-05-21T21:00:00Z').getTime() / 1000);
  const wakeSec = Math.floor(new Date('2026-05-22T05:30:00Z').getTime() / 1000);

  it('formats both times in the user tz', () => {
    expect(bedTimeSub(bedSec, wakeSec, TZ_LAGOS)).toMatch(/10:00/);
    expect(bedTimeSub(bedSec, wakeSec, TZ_LAGOS)).toMatch(/6:30/);
  });

  it('renders different times in a different tz', () => {
    // Same epochs in NYC (UTC-4 DST): bed = 17:00, wake = 01:30.
    expect(bedTimeSub(bedSec, wakeSec, TZ_NYC)).toMatch(/5:00/);
    expect(bedTimeSub(bedSec, wakeSec, TZ_NYC)).toMatch(/1:30/);
  });

  it('prefixes "Last night"', () => {
    expect(bedTimeSub(bedSec, wakeSec, TZ_LAGOS)).toMatch(/^Last night/);
  });
});

describe('displayWindow', () => {
  const base: SleepSession = {
    sessionStartSec: 100,
    sessionEndSec: 200,
    sessionStartLocal: '',
    sessionEndLocal: '',
    totalMinutes: 5,
    deepMinutes: 0,
    remMinutes: 0,
    lightMinutes: 0,
    awakeMinutes: 0,
    awakeCount: 0,
    transitions: [],
    sleepScore: 0,
  };

  it('returns the legacy boundaries when no inferred values are present', () => {
    expect(displayWindow(base)).toEqual({
      startSec: 100,
      endSec: 200,
      wakeSource: undefined,
    });
  });

  it('returns the inferred boundaries when present', () => {
    const session: SleepSession = {
      ...base,
      inferredSessionStartSec: 1000,
      inferredSessionEndSec: 2000,
      wakeSource: 'hr_inferred',
    };
    expect(displayWindow(session)).toEqual({
      startSec: 1000,
      endSec: 2000,
      wakeSource: 'hr_inferred',
    });
  });

  it('returns the inferred boundaries with fallback marker', () => {
    const session: SleepSession = {
      ...base,
      inferredSessionStartSec: 1000,
      inferredSessionEndSec: 2000,
      wakeSource: 'fallback',
    };
    expect(displayWindow(session).wakeSource).toBe('fallback');
  });
});
