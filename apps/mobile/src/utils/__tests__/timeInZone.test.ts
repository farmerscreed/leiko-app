// timeInZone — proves time-derived values follow the given IANA zone,
// not the (TZ=UTC) test runner zone. The bug these guard: a reading near
// midnight UTC lands on a different calendar day / part-of-day depending
// on the viewer's timezone.

import {
  resolveTimeZone,
  timeInZone,
  weekdayInZone,
  monthDayInZone,
  hourInZone,
  dayKeyInZone,
} from '../timeInZone';

// 2026-06-03T23:30:00Z — 11:30pm UTC.
//   Africa/Lagos (UTC+1): 2026-06-04 00:30 (next day, hour 0)
//   America/New_York (UTC-4 in June): 2026-06-03 19:30 (same day, hour 19)
const NEAR_MIDNIGHT_UTC = Date.UTC(2026, 5, 3, 23, 30, 0);

describe('resolveTimeZone', () => {
  it('passes through a valid IANA zone', () => {
    expect(resolveTimeZone('Africa/Lagos')).toBe('Africa/Lagos');
  });
  it('falls back to UTC for empty / null / invalid', () => {
    expect(resolveTimeZone('')).toBe('UTC');
    expect(resolveTimeZone(null)).toBe('UTC');
    expect(resolveTimeZone(undefined)).toBe('UTC');
    expect(resolveTimeZone('Not/AZone')).toBe('UTC');
  });
});

describe('hourInZone', () => {
  it('reads the hour in the target zone, not the device zone', () => {
    expect(hourInZone(NEAR_MIDNIGHT_UTC, 'UTC')).toBe(23);
    expect(hourInZone(NEAR_MIDNIGHT_UTC, 'Africa/Lagos')).toBe(0); // rolled past midnight
    expect(hourInZone(NEAR_MIDNIGHT_UTC, 'America/New_York')).toBe(19);
  });
  it('midnight reads as 0, not 24', () => {
    expect(hourInZone(Date.UTC(2026, 5, 3, 0, 0, 0), 'UTC')).toBe(0);
  });
});

describe('dayKeyInZone', () => {
  it('assigns the calendar day per the target zone', () => {
    expect(dayKeyInZone(NEAR_MIDNIGHT_UTC, 'UTC')).toBe('2026-06-03');
    expect(dayKeyInZone(NEAR_MIDNIGHT_UTC, 'Africa/Lagos')).toBe('2026-06-04');
    expect(dayKeyInZone(NEAR_MIDNIGHT_UTC, 'America/New_York')).toBe('2026-06-03');
  });
});

describe('timeInZone', () => {
  it('formats the wall-clock time of the target zone', () => {
    // Under TZ=UTC the device-zone time would be 11:30 PM; Lagos is 12:30 AM.
    expect(timeInZone(NEAR_MIDNIGHT_UTC, 'Africa/Lagos')).toMatch(/12:30/);
    expect(timeInZone(NEAR_MIDNIGHT_UTC, 'America/New_York')).toMatch(/7:30/);
  });
});

describe('weekday / monthDay in zone', () => {
  it('shifts the weekday and date across the midnight boundary', () => {
    // UTC: Wed Jun 3; Lagos: Thu Jun 4.
    expect(weekdayInZone(NEAR_MIDNIGHT_UTC, 'UTC', 'short')).toMatch(/Wed/);
    expect(weekdayInZone(NEAR_MIDNIGHT_UTC, 'Africa/Lagos', 'short')).toMatch(/Thu/);
    expect(monthDayInZone(NEAR_MIDNIGHT_UTC, 'Africa/Lagos')).toMatch(/Jun 4/);
  });
});
