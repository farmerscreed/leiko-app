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

  it('formats both times in the user tz when HR-inferred', () => {
    expect(bedTimeSub(bedSec, wakeSec, TZ_LAGOS, 'hr_inferred', 450)).toMatch(/10:00/);
    expect(bedTimeSub(bedSec, wakeSec, TZ_LAGOS, 'hr_inferred', 450)).toMatch(/6:30/);
  });

  it('renders different times in a different tz when HR-inferred', () => {
    // Same epochs in NYC (UTC-4 DST): bed = 17:00, wake = 01:30.
    expect(bedTimeSub(bedSec, wakeSec, TZ_NYC, 'hr_inferred', 450)).toMatch(/5:00/);
    expect(bedTimeSub(bedSec, wakeSec, TZ_NYC, 'hr_inferred', 450)).toMatch(/1:30/);
  });

  it('frames HR-inferred times as an estimate (~) and prefixes "Last night"', () => {
    const out = bedTimeSub(bedSec, wakeSec, TZ_LAGOS, 'hr_inferred', 450);
    expect(out).toMatch(/^Last night/);
    expect(out).toMatch(/~/);
  });

  it('shows duration only — never a fabricated clock — when not HR-inferred', () => {
    // The watch does not record bed/wake; without a confident HR signal we
    // must not print any clock time. 450 min = 7:30.
    const fb = bedTimeSub(bedSec, wakeSec, TZ_LAGOS, 'fallback', 450);
    expect(fb).toBe('Last night · 7:30 slept');
    expect(fb).not.toMatch(/→/); // no bed→wake arrow / clock
    const legacy = bedTimeSub(bedSec, wakeSec, TZ_LAGOS, undefined, 450);
    expect(legacy).toBe('Last night · 7:30 slept');
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
