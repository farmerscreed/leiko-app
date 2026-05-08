import { isPlusTier, usePlusEntitlement } from '../usePlusEntitlement';

describe('usePlusEntitlement — Sprint 9 stub', () => {
  it('returns tier=free, isPlus=false, isLoading=false', () => {
    const result = usePlusEntitlement();
    expect(result.tier).toBe('free');
    expect(result.isPlus).toBe(false);
    expect(result.isLoading).toBe(false);
  });
});

describe('isPlusTier', () => {
  it('treats plus / plus_trial / plus_grace as Plus-entitled', () => {
    expect(isPlusTier('plus')).toBe(true);
    expect(isPlusTier('plus_trial')).toBe(true);
    expect(isPlusTier('plus_grace')).toBe(true);
  });

  it('treats free / past_due as not entitled', () => {
    expect(isPlusTier('free')).toBe(false);
    expect(isPlusTier('past_due')).toBe(false);
  });
});
