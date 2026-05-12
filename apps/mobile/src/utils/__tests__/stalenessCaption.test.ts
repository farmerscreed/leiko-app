import { formatStalenessCaption } from '../stalenessCaption';

describe('formatStalenessCaption', () => {
  const now = Math.floor(new Date('2026-05-12T12:00:00Z').getTime() / 1000);

  it('returns null when there is no last sample', () => {
    expect(formatStalenessCaption(null, now)).toBeNull();
  });

  it('renders minutes for ages under one hour', () => {
    expect(formatStalenessCaption(now - 28 * 60, now)).toBe(
      'Last sync 28m ago',
    );
  });

  it('renders hours for ages between 1h and 48h', () => {
    expect(formatStalenessCaption(now - 4 * 3600, now)).toBe(
      'Last sync 4h ago',
    );
    expect(formatStalenessCaption(now - 26 * 3600, now)).toBe(
      'Last sync 26h ago',
    );
  });

  it('renders days for ages between 48h and 7d', () => {
    expect(formatStalenessCaption(now - 3 * 24 * 3600, now)).toBe(
      'Last sync 3d ago',
    );
  });

  it('renders weekday for ages beyond a week', () => {
    const out = formatStalenessCaption(now - 10 * 24 * 3600, now);
    expect(out).toMatch(/^Last sync /);
    // Don't pin the locale — just confirm it's not the day-form.
    expect(out).not.toMatch(/ago$/);
  });

  it("handles the 'just now' boundary safely", () => {
    expect(formatStalenessCaption(now - 5, now)).toBe('Last sync just now');
  });
});
