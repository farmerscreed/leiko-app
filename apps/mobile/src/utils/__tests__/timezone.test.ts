// utils/timezone — zone-aware wall-clock helpers.
//
// The runner is pinned to UTC (jest.config.js), so these tests prove
// the helpers convert correctly into OTHER zones regardless of the host.

import { zonedHour, zonedDateKey } from '../timezone';

// 2026-05-08T23:30:00Z — 11:30 PM UTC.
const LATE_UTC = Date.UTC(2026, 4, 8, 23, 30, 0) / 1000;
// 2026-05-08T00:30:00Z — 12:30 AM UTC.
const EARLY_UTC = Date.UTC(2026, 4, 8, 0, 30, 0) / 1000;

describe('zonedHour', () => {
  it('returns the UTC hour when no timezone is given', () => {
    expect(zonedHour(LATE_UTC)).toBe(23);
    expect(zonedHour(EARLY_UTC)).toBe(0);
  });

  it('returns the UTC hour for an explicit UTC zone', () => {
    expect(zonedHour(LATE_UTC, 'UTC')).toBe(23);
  });

  it('shifts the hour forward for an east-of-UTC zone (Lagos, +1)', () => {
    // 23:30 UTC → 00:30 next day in Lagos.
    expect(zonedHour(LATE_UTC, 'Africa/Lagos')).toBe(0);
    // 00:30 UTC → 01:30 in Lagos.
    expect(zonedHour(EARLY_UTC, 'Africa/Lagos')).toBe(1);
  });

  it('shifts the hour backward for a west-of-UTC zone (New York, -4 DST)', () => {
    // 00:30 UTC on May 8 → 20:30 on May 7 in New York (EDT, UTC-4).
    expect(zonedHour(EARLY_UTC, 'America/New_York')).toBe(20);
  });

  it('falls back to UTC hour for an unknown/garbage zone', () => {
    expect(zonedHour(LATE_UTC, 'Not/AZone')).toBe(23);
  });
});

describe('zonedDateKey', () => {
  it('returns the UTC date when no timezone is given', () => {
    expect(zonedDateKey(LATE_UTC)).toBe('2026-05-08');
    expect(zonedDateKey(EARLY_UTC)).toBe('2026-05-08');
  });

  it('rolls the date forward in an east zone at late-UTC (Lagos)', () => {
    // 23:30 UTC May 8 → 00:30 May 9 in Lagos.
    expect(zonedDateKey(LATE_UTC, 'Africa/Lagos')).toBe('2026-05-09');
  });

  it('rolls the date backward in a west zone at early-UTC (New York)', () => {
    // 00:30 UTC May 8 → 20:30 May 7 in New York.
    expect(zonedDateKey(EARLY_UTC, 'America/New_York')).toBe('2026-05-07');
  });

  it('falls back to the UTC date for an unknown/garbage zone', () => {
    expect(zonedDateKey(LATE_UTC, 'Not/AZone')).toBe('2026-05-08');
  });
});
