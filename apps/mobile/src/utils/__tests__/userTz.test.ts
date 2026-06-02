// userTz — tz resolution + clock + day-key formatting.
// Sprint 18 / SLEEP_TIMEZONE_FIX_BRIEF.

import {
  userTz,
  deviceTz,
  formatClockInTz,
  dayKeyInTz,
  epochSecForLocalHour,
  tzOffsetMs,
} from '../userTz';
import { useAuth } from '../../state/auth';

describe('userTz', () => {
  beforeEach(() => {
    // Reset auth profile between cases.
    useAuth.setState({ profile: null });
  });

  it('returns profile tz when set', () => {
    useAuth.setState({ profile: { timezone: 'Africa/Lagos' } as never });
    expect(userTz()).toBe('Africa/Lagos');
  });

  it('falls back to device tz when profile tz is empty', () => {
    useAuth.setState({ profile: { timezone: '' } as never });
    expect(userTz()).toBe(deviceTz());
  });

  it('falls back to device tz when no profile is loaded', () => {
    expect(userTz()).toBe(deviceTz());
  });
});

describe('formatClockInTz', () => {
  // 2026-05-22T06:42:00Z = 07:42 in Lagos (UTC+1), 02:42 in NYC (UTC-4
  // during DST). The exact hour-of-day in the output proves we used
  // the target tz, not the device default.
  const sec = Math.floor(new Date('2026-05-22T06:42:00Z').getTime() / 1000);

  it('renders the wall-clock hour in the named tz', () => {
    expect(formatClockInTz(sec, 'Africa/Lagos')).toMatch(/7:42/);
  });

  it('renders a different hour in a different tz', () => {
    expect(formatClockInTz(sec, 'America/New_York')).toMatch(/2:42/);
  });

  it('renders UTC unchanged', () => {
    expect(formatClockInTz(sec, 'UTC')).toMatch(/6:42/);
  });
});

describe('dayKeyInTz', () => {
  it('returns YYYY-MM-DD in the named tz', () => {
    // 2026-05-22T23:30:00Z is 22 May in Lagos but already 23 May in
    // Tokyo (UTC+9 → 08:30 next-day). Both renders verify tz-aware day
    // accounting.
    const sec = Math.floor(new Date('2026-05-22T23:30:00Z').getTime() / 1000);
    expect(dayKeyInTz(sec, 'UTC')).toBe('2026-05-22');
    expect(dayKeyInTz(sec, 'Africa/Lagos')).toBe('2026-05-23');
    expect(dayKeyInTz(sec, 'Asia/Tokyo')).toBe('2026-05-23');
  });
});

describe('epochSecForLocalHour', () => {
  it('rounds-trips through dayKeyInTz', () => {
    const tz = 'Africa/Lagos';
    const sec = epochSecForLocalHour('2026-05-22', 7, tz);
    expect(dayKeyInTz(sec, tz)).toBe('2026-05-22');
    expect(formatClockInTz(sec, tz)).toMatch(/7:00/);
  });

  it('handles a UTC-negative tz correctly', () => {
    const tz = 'America/New_York';
    const sec = epochSecForLocalHour('2026-05-22', 7, tz);
    // 07:00 New York during DST = 11:00 UTC (UTC-4).
    expect(formatClockInTz(sec, 'UTC')).toMatch(/11:00/);
    expect(formatClockInTz(sec, tz)).toMatch(/7:00/);
  });

  it('handles UTC', () => {
    const sec = epochSecForLocalHour('2026-05-22', 7, 'UTC');
    expect(formatClockInTz(sec, 'UTC')).toMatch(/7:00/);
  });
});

describe('tzOffsetMs', () => {
  it('reports +1h for Africa/Lagos', () => {
    const at = new Date('2026-05-22T12:00:00Z');
    expect(tzOffsetMs(at, 'Africa/Lagos')).toBe(60 * 60 * 1000);
  });

  it('reports -4h for America/New_York during DST', () => {
    // Late May is firmly inside US DST.
    const at = new Date('2026-05-22T12:00:00Z');
    expect(tzOffsetMs(at, 'America/New_York')).toBe(-4 * 60 * 60 * 1000);
  });

  it('reports 0 for UTC', () => {
    const at = new Date('2026-05-22T12:00:00Z');
    expect(tzOffsetMs(at, 'UTC')).toBe(0);
  });
});
