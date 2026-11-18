import { mmkv } from '../../storage';
import {
  getWatchClockTz,
  rememberWatchClockTz,
  tzOffsetSecAt,
  wallClockInTz,
  watchClockOutOfZone,
} from '../watchClock';

beforeEach(() => {
  mmkv.clearAll();
});

describe('wallClockInTz', () => {
  const at = new Date('2026-11-17T19:05:30Z');

  it('reads the wall clock in Lagos (UTC+1)', () => {
    expect(wallClockInTz(at, 'Africa/Lagos')).toEqual({
      year: 2026, month: 11, day: 17, hour: 20, minute: 5, second: 30,
    });
  });

  it('reads the wall clock in Los Angeles (PST) across the date line', () => {
    expect(wallClockInTz(new Date('2026-11-17T03:00:00Z'), 'America/Los_Angeles')).toEqual({
      year: 2026, month: 11, day: 16, hour: 19, minute: 0, second: 0,
    });
  });

  it('reports midnight as hour 0, not 24', () => {
    expect(wallClockInTz(new Date('2026-11-17T23:00:00Z'), 'Africa/Lagos').hour).toBe(0);
  });
});

describe('tzOffsetSecAt', () => {
  it('handles fixed and DST zones', () => {
    expect(tzOffsetSecAt(new Date('2026-11-17T12:00:00Z'), 'Africa/Lagos')).toBe(3600);
    expect(tzOffsetSecAt(new Date('2026-07-01T12:00:00Z'), 'America/New_York')).toBe(-4 * 3600);
    expect(tzOffsetSecAt(new Date('2026-12-01T12:00:00Z'), 'America/New_York')).toBe(-5 * 3600);
  });
});

describe('remembered watch clock zone', () => {
  it('falls back to the device zone for an unknown watch', () => {
    expect(getWatchClockTz('AA:BB')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  });

  it('remembers per watch and flags a zone change', () => {
    rememberWatchClockTz('AA:BB', 'America/Los_Angeles');
    expect(getWatchClockTz('AA:BB')).toBe('America/Los_Angeles');
    expect(watchClockOutOfZone('Africa/Lagos')).toBe(true);
    rememberWatchClockTz('AA:BB', 'Africa/Lagos');
    expect(watchClockOutOfZone('Africa/Lagos')).toBe(false);
  });
});
