import { formatPersonFooter } from '../personFooter';

const NOW = Date.UTC(2026, 9, 30, 17, 30);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

describe('formatPersonFooter', () => {
  it('recent BP → "Read · <time>"', () => {
    expect(formatPersonFooter(iso(NOW - HOUR), [], NOW)).toBe(`Read · ${clock(NOW - HOUR)}`);
  });

  it('stale BP + fresh HR → shows both (the founder case)', () => {
    expect(formatPersonFooter(iso(NOW - 31 * DAY), [iso(NOW - 9 * MIN)], NOW)).toBe(
      `Last BP · 31 days ago · Synced ${clock(NOW - 9 * MIN)}`,
    );
  });

  it('no BP + fresh vital → "No BP yet · Synced …"', () => {
    expect(formatPersonFooter(undefined, [null, iso(NOW - HOUR)], NOW)).toBe(
      `No BP yet · Synced ${clock(NOW - HOUR)}`,
    );
  });

  it('stale everything → old label', () => {
    expect(formatPersonFooter(iso(NOW - 3 * DAY), [iso(NOW - 2 * DAY)], NOW)).toBe(
      'Last reading · 3 days ago',
    );
  });

  it('nothing → "No readings yet"', () => {
    expect(formatPersonFooter(undefined, [undefined, null], NOW)).toBe('No readings yet');
  });
});
