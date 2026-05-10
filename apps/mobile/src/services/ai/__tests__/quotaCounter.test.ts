import {
  FREE_TIER_QUOTA,
  PLUS_TIER_QUOTA,
  getQuotaSnapshot,
  incrementLocal,
  quotaForTier,
  reconcileFromAuditLog,
  _internals,
} from '../quotaCounter';
import { mmkv } from '../../storage';

beforeEach(() => {
  mmkv.clearAll();
});

describe('quotaForTier', () => {
  it('returns 5 for free / past_due', () => {
    expect(quotaForTier('free')).toBe(FREE_TIER_QUOTA);
    expect(quotaForTier('past_due')).toBe(FREE_TIER_QUOTA);
  });

  it('returns 100 for plus / plus_trial / plus_grace', () => {
    expect(quotaForTier('plus')).toBe(PLUS_TIER_QUOTA);
    expect(quotaForTier('plus_trial')).toBe(PLUS_TIER_QUOTA);
    expect(quotaForTier('plus_grace')).toBe(PLUS_TIER_QUOTA);
  });
});

describe('getQuotaSnapshot — cold cache', () => {
  it('returns count=0, limit=tier-cap, lastReconcileMs=null when no cache exists', () => {
    const snap = getQuotaSnapshot('u-1', 'free');
    expect(snap.count).toBe(0);
    expect(snap.limit).toBe(FREE_TIER_QUOTA);
    expect(snap.lastReconcileMs).toBeNull();
    expect(snap.monthKey).toBe(_internals.currentMonthKey());
  });
});

describe('incrementLocal', () => {
  it('writes 1 the first time and increments on subsequent calls', () => {
    incrementLocal('u-1');
    expect(getQuotaSnapshot('u-1', 'free').count).toBe(1);
    incrementLocal('u-1');
    expect(getQuotaSnapshot('u-1', 'free').count).toBe(2);
  });
});

describe('reconcileFromAuditLog', () => {
  function buildClient(count: number) {
    // Sprint 12.5: chain switched from .eq('action', ...) to
    // .in('action', [...]) so the counter sweeps both ai.user_question
    // AND ai.daily_narration into the monthly Tier-B quota.
    const gte = jest.fn().mockResolvedValue({ count, error: null });
    const inEq = jest.fn().mockReturnValue({ gte });
    const eq1 = jest.fn().mockReturnValue({ in: inEq });
    const select = jest.fn().mockReturnValue({ eq: eq1 });
    return { from: jest.fn().mockReturnValue({ select }) };
  }

  it('writes the fresh count when no cache existed', async () => {
    const client = buildClient(7);
    const result = await reconcileFromAuditLog('u-1', client as never);
    expect(result).toBe(7);
    expect(getQuotaSnapshot('u-1', 'plus').count).toBe(7);
  });

  it('does not down-count when audit-log returns a smaller value (monotone within month)', async () => {
    incrementLocal('u-1');
    incrementLocal('u-1');
    incrementLocal('u-1'); // local = 3
    const client = buildClient(2);
    const result = await reconcileFromAuditLog('u-1', client as never);
    expect(result).toBe(3);
  });
});
