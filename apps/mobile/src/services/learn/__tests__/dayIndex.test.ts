// dayIndex.test.ts — Sprint 14 task 1.

import { getDayIndex } from '../dayIndex';

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// 2026-05-01 00:00:00 UTC
const BASE_UTC_SEC = Date.UTC(2026, 4, 1) / 1000;

describe('getDayIndex', () => {
  it('returns null when no first reading has happened yet', () => {
    expect(getDayIndex(null, Date.now(), 'UTC')).toBeNull();
    expect(getDayIndex(null, Date.now(), 'America/New_York')).toBeNull();
  });

  it('returns 0 on the same local day as the first reading', () => {
    const firstReading = BASE_UTC_SEC;
    const sameDay = (firstReading + 6 * HOUR) * 1000;
    expect(getDayIndex(firstReading, sameDay, 'UTC')).toBe(0);
  });

  it('returns 1 the next local day', () => {
    const firstReading = BASE_UTC_SEC;
    const nextDay = (firstReading + 1 * DAY) * 1000;
    expect(getDayIndex(firstReading, nextDay, 'UTC')).toBe(1);
  });

  it('returns 14 two weeks after the first reading', () => {
    const firstReading = BASE_UTC_SEC;
    const twoWeeksOn = (firstReading + 14 * DAY) * 1000;
    expect(getDayIndex(firstReading, twoWeeksOn, 'UTC')).toBe(14);
  });

  describe('timezone handling — late-night readings', () => {
    // Lagos is UTC+1 (no DST). A reading at 23:30 Lagos local on
    // 2026-05-01 corresponds to 22:30 UTC. The next morning at 09:00
    // Lagos local corresponds to 08:00 UTC. Both should be on
    // calendar day 2026-05-02 in Lagos? No — 23:30 on 2026-05-01 IS
    // 2026-05-01 in Lagos. 09:00 the next morning is 2026-05-02. So
    // the difference is 1 day in Lagos.
    it('Lagos 23:30 reading → 09:00 next morning is day 1', () => {
      // Construct: 2026-05-01 23:30 Lagos = 22:30 UTC = (BASE + 22.5h)
      const firstReading = BASE_UTC_SEC + 22.5 * HOUR;
      const nextMorning = (BASE_UTC_SEC + (24 + 8) * HOUR) * 1000; // 08:00 UTC May 2 = 09:00 Lagos May 2
      expect(getDayIndex(firstReading, nextMorning, 'Africa/Lagos')).toBe(1);
    });

    // A NYC user takes a reading at 23:30 local (which is 03:30 UTC
    // the NEXT day in May, EDT = UTC-4). Without timezone awareness
    // the index would skew by one. With timezone awareness, both the
    // reading and the same-night context land on the same NYC
    // calendar day.
    it('NYC 23:30 reading + 23:45 check 15min later still day 0', () => {
      // 2026-05-01 23:30 EDT = 2026-05-02 03:30 UTC = BASE + 1d + 3.5h
      const firstReading = BASE_UTC_SEC + 1 * DAY + 3.5 * HOUR;
      const fifteenMinLater = (firstReading + 15 * MIN) * 1000;
      expect(getDayIndex(firstReading, fifteenMinLater, 'America/New_York')).toBe(0);
    });

    it('NYC 23:30 reading + 09:00 next morning is day 1, not day 0 or day 2', () => {
      // 23:30 EDT May 1 = 03:30 UTC May 2
      const firstReading = BASE_UTC_SEC + 1 * DAY + 3.5 * HOUR;
      // 09:00 EDT May 2 = 13:00 UTC May 2 = BASE + 1d + 13h
      const nextMorning = (BASE_UTC_SEC + 1 * DAY + 13 * HOUR) * 1000;
      expect(getDayIndex(firstReading, nextMorning, 'America/New_York')).toBe(1);
    });
  });

  describe('defensive behaviour', () => {
    it('returns 0 when now is BEFORE the first reading (clock skew)', () => {
      const firstReading = BASE_UTC_SEC + 5 * DAY;
      const earlier = BASE_UTC_SEC * 1000;
      expect(getDayIndex(firstReading, earlier, 'UTC')).toBe(0);
    });

    it('falls back to UTC when timezone is null', () => {
      const firstReading = BASE_UTC_SEC;
      const nextDay = (firstReading + 1 * DAY) * 1000;
      expect(getDayIndex(firstReading, nextDay, null)).toBe(1);
    });

    it('falls back to UTC when timezone is empty', () => {
      const firstReading = BASE_UTC_SEC;
      const nextDay = (firstReading + 1 * DAY) * 1000;
      expect(getDayIndex(firstReading, nextDay, '')).toBe(1);
    });

    it('falls back to UTC when timezone is invalid', () => {
      const firstReading = BASE_UTC_SEC;
      const nextDay = (firstReading + 1 * DAY) * 1000;
      expect(getDayIndex(firstReading, nextDay, 'Mars/Olympus_Mons')).toBe(1);
    });
  });

  describe('daylight-saving transitions', () => {
    // 2026-03-08 02:00 EST → 03:00 EDT (US "spring forward")
    // The local day is still March 8 either side of the jump.
    it('US spring-forward day still produces day 0 across the jump', () => {
      const firstReading = Date.UTC(2026, 2, 8, 6) / 1000; // 01:00 EST March 8
      const afterSpring = Date.UTC(2026, 2, 8, 16) * 1; // 12:00 EDT March 8 (UTC ms)
      expect(getDayIndex(firstReading, afterSpring, 'America/New_York')).toBe(0);
    });

    // 2026-11-01 02:00 EDT → 01:00 EST (US "fall back")
    it('US fall-back day still produces day 0 across the jump', () => {
      const firstReading = Date.UTC(2026, 10, 1, 5) / 1000; // 01:00 EDT November 1
      const afterFallback = Date.UTC(2026, 10, 1, 17) * 1; // 12:00 EST November 1
      expect(getDayIndex(firstReading, afterFallback, 'America/New_York')).toBe(0);
    });
  });
});
