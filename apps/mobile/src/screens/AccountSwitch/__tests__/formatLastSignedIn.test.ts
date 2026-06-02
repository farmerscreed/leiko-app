// formatLastSignedIn — Sprint 19 Block 4.

import { formatLastSignedIn } from '../AccountSwitchScreen';

const NOW = 1_700_000_000_000;

describe('formatLastSignedIn', () => {
  it('returns "just now" for under a minute', () => {
    expect(formatLastSignedIn(NOW - 30_000, NOW)).toBe('just now');
  });

  it('returns minutes under an hour', () => {
    expect(formatLastSignedIn(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(formatLastSignedIn(NOW - 59 * 60_000, NOW)).toBe('59 min ago');
  });

  it('returns hours under 24h', () => {
    expect(formatLastSignedIn(NOW - 3 * 3_600_000, NOW)).toBe('3h ago');
    expect(formatLastSignedIn(NOW - 23 * 3_600_000, NOW)).toBe('23h ago');
  });

  it('returns days under 30d', () => {
    expect(formatLastSignedIn(NOW - 2 * 24 * 3_600_000, NOW)).toBe('2d ago');
    expect(formatLastSignedIn(NOW - 29 * 24 * 3_600_000, NOW)).toBe('29d ago');
  });

  it('returns a locale date for older than 30d', () => {
    const out = formatLastSignedIn(NOW - 60 * 24 * 3_600_000, NOW);
    // Format depends on the test runner's default locale; assert
    // structure not exact text.
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(4);
    expect(out).not.toMatch(/min ago|h ago|d ago|just now/);
  });

  it('handles negative ageMs (clock skew) — clamps to just now', () => {
    expect(formatLastSignedIn(NOW + 5_000, NOW)).toBe('just now');
  });
});
