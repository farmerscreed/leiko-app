// learnSeed.test.ts — Sprint 14 task 2.

import { useLearnSeed, isHiddenByEntry } from '../learnSeed';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  useLearnSeed.getState()._hydrate({});
});

describe('isHiddenByEntry — pure helper', () => {
  it('treats undefined entry as not hidden', () => {
    expect(isHiddenByEntry(undefined, Date.now())).toBe(false);
  });

  it('treats fully-null entry as not hidden', () => {
    expect(
      isHiddenByEntry({ dismissedAt: null, readAt: null }, Date.now()),
    ).toBe(false);
  });

  it('hides for 30 days after dismiss', () => {
    const dismissedAt = 1_000_000_000_000;
    expect(isHiddenByEntry({ dismissedAt, readAt: null }, dismissedAt + 1 * MS_PER_DAY)).toBe(true);
    expect(isHiddenByEntry({ dismissedAt, readAt: null }, dismissedAt + 29 * MS_PER_DAY)).toBe(true);
    expect(isHiddenByEntry({ dismissedAt, readAt: null }, dismissedAt + 30 * MS_PER_DAY)).toBe(false);
    expect(isHiddenByEntry({ dismissedAt, readAt: null }, dismissedAt + 31 * MS_PER_DAY)).toBe(false);
  });

  it('hides for 90 days after read', () => {
    const readAt = 1_000_000_000_000;
    expect(isHiddenByEntry({ dismissedAt: null, readAt }, readAt + 1 * MS_PER_DAY)).toBe(true);
    expect(isHiddenByEntry({ dismissedAt: null, readAt }, readAt + 89 * MS_PER_DAY)).toBe(true);
    expect(isHiddenByEntry({ dismissedAt: null, readAt }, readAt + 90 * MS_PER_DAY)).toBe(false);
  });

  it('combined dismiss + read uses whichever window is longer', () => {
    const dismissedAt = 1_000_000_000_000;
    const readAt = dismissedAt + 5 * MS_PER_DAY;
    // 60 days after dismiss, 55 days after read — read wins (90-day window > 30+0).
    const now = readAt + 55 * MS_PER_DAY;
    expect(isHiddenByEntry({ dismissedAt, readAt }, now)).toBe(true);
  });
});

describe('useLearnSeed — store API', () => {
  it('starts with empty tracking', () => {
    expect(useLearnSeed.getState().tracking).toEqual({});
  });

  it('markDismissed sets dismissedAt', () => {
    useLearnSeed.getState().markDismissed('numbers-001', 1234);
    expect(useLearnSeed.getState().tracking['numbers-001']).toEqual({
      dismissedAt: 1234,
      readAt: null,
    });
  });

  it('markRead sets readAt', () => {
    useLearnSeed.getState().markRead('numbers-001', 5678);
    expect(useLearnSeed.getState().tracking['numbers-001']).toEqual({
      dismissedAt: null,
      readAt: 5678,
    });
  });

  it('markRead after markDismissed preserves dismissedAt', () => {
    useLearnSeed.getState().markDismissed('numbers-001', 100);
    useLearnSeed.getState().markRead('numbers-001', 200);
    expect(useLearnSeed.getState().tracking['numbers-001']).toEqual({
      dismissedAt: 100,
      readAt: 200,
    });
  });

  it('isHidden returns false before dismiss', () => {
    expect(useLearnSeed.getState().isHidden('numbers-001', 1234)).toBe(false);
  });

  it('isHidden returns true within 30-day dismiss window', () => {
    useLearnSeed.getState().markDismissed('numbers-001', 1000);
    expect(useLearnSeed.getState().isHidden('numbers-001', 1000 + 15 * MS_PER_DAY)).toBe(true);
  });

  it('isHidden returns false after 30-day dismiss window expires', () => {
    useLearnSeed.getState().markDismissed('numbers-001', 1000);
    expect(useLearnSeed.getState().isHidden('numbers-001', 1000 + 31 * MS_PER_DAY)).toBe(false);
  });

  it('hasEverBeenRead remembers reads even after the 90-day window', () => {
    useLearnSeed.getState().markRead('numbers-001', 1000);
    expect(useLearnSeed.getState().hasEverBeenRead('numbers-001')).toBe(true);
    expect(useLearnSeed.getState().isHidden('numbers-001', 1000 + 100 * MS_PER_DAY)).toBe(false);
    // hasEverBeenRead still returns true — the algorithm uses this for
    // the "Day 7 fixed surface skips articles already opened" rule.
    expect(useLearnSeed.getState().hasEverBeenRead('numbers-001')).toBe(true);
  });

  it('hasEverBeenRead returns false when only dismissed', () => {
    useLearnSeed.getState().markDismissed('numbers-001', 1000);
    expect(useLearnSeed.getState().hasEverBeenRead('numbers-001')).toBe(false);
  });
});
