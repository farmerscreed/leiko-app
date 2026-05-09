// Pure-helper tests for useSixthReadingPaywall. The hook itself
// requires the Zustand readings store + usePlusEntitlement; the
// non-trivial pieces are the month-keying and the count-this-month
// helpers, which are exported via _testHelpers.

import { _testHelpers } from '../useSixthReadingPaywall';

const { currentMonthKey, readingsThisMonth, flagKey, FREE_MONTHLY_READING_THRESHOLD } =
  _testHelpers;

describe('currentMonthKey', () => {
  it('returns YYYY-MM with zero-padded month', () => {
    expect(currentMonthKey(new Date('2026-03-09T12:00:00Z'))).toBe('2026-03');
    expect(currentMonthKey(new Date('2026-12-09T12:00:00Z'))).toBe('2026-12');
  });
});

describe('readingsThisMonth', () => {
  it('counts only readings within the current calendar month', () => {
    // Use locale-local Date constructor so the test passes regardless
    // of the runner's timezone — the helper itself uses Date(year,
    // monthIdx, 1) which is locale-local.
    const now = new Date(2026, 2, 15, 12); // 2026-03-15 12:00 local
    const inMonthStart = new Date(2026, 2, 1, 0, 0, 1).getTime();
    const earlyMarch = new Date(2026, 2, 10, 8).getTime();
    const lateFebruary = new Date(2026, 1, 28, 12).getTime();
    const earlierFeb = new Date(2026, 1, 1, 0).getTime();
    expect(
      readingsThisMonth([inMonthStart, earlyMarch, lateFebruary, earlierFeb], now),
    ).toBe(2);
  });

  it('returns zero for an empty list', () => {
    expect(readingsThisMonth([], new Date('2026-03-15'))).toBe(0);
  });
});

describe('flagKey', () => {
  it('namespaces by family id', () => {
    expect(flagKey('fam-1')).toBe('leiko.paywall.sixthReading.fam-1');
  });
});

describe('FREE_MONTHLY_READING_THRESHOLD', () => {
  it('locks at 6 per D8a §9.1', () => {
    expect(FREE_MONTHLY_READING_THRESHOLD).toBe(6);
  });
});
