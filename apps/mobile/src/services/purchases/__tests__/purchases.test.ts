// Tests for the RevenueCat adapter. The native module is mocked at
// __mocks__/react-native-purchases.js — these tests assert the
// adapter's no-op behaviour when API keys are missing and the
// happy-path call sequence when they are provided.

import {
  PRODUCT_IDS,
  configurePurchases,
  fetchOfferings,
  identifyPurchaser,
  logoutPurchaser,
  purchasePeriod,
  _resetPurchasesAdapterForTests,
} from '../index';

describe('purchases adapter — env / configure', () => {
  beforeEach(() => {
    _resetPurchasesAdapterForTests();
    delete process.env.EXPO_PUBLIC_RC_API_KEY_IOS;
    delete process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID;
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  });

  it('returns false from configure when API keys are missing', async () => {
    const ok = await configurePurchases();
    expect(ok).toBe(false);
  });

  it('no-ops identify when not configured', async () => {
    await expect(
      identifyPurchaser('user-1', { accountType: 'caregiver', familyId: 'fam-1' }),
    ).resolves.toBeUndefined();
  });

  it('no-ops logout when not configured', async () => {
    await expect(logoutPurchaser()).resolves.toBeUndefined();
  });

  it('returns empty offerings when not configured', async () => {
    const o = await fetchOfferings();
    expect(o).toEqual({ monthly: null, annual: null });
  });

  it('purchasePeriod throws purchases_unavailable when not configured', async () => {
    await expect(purchasePeriod('monthly')).rejects.toThrow('purchases_unavailable');
  });
});

describe('product IDs', () => {
  it('locks the App Store / Play product identifiers per docs/09 §4', () => {
    expect(PRODUCT_IDS.monthly).toBe('com.leiko.care.plus.monthly');
    expect(PRODUCT_IDS.annual).toBe('com.leiko.care.plus.annual');
  });
});


// 2026-10-30 — the 1.1.0 release build shipped without RevenueCat because
// the documented env name (EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY) was not
// the one the adapter read. Both names must configure purchases.
describe('purchases adapter — env var names', () => {
  beforeEach(() => {
    _resetPurchasesAdapterForTests();
    for (const k of [
      'EXPO_PUBLIC_RC_API_KEY_IOS',
      'EXPO_PUBLIC_RC_API_KEY_ANDROID',
      'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
      'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
    ]) {
      delete process.env[k];
    }
  });

  it.each([
    ['EXPO_PUBLIC_RC_API_KEY_ANDROID', 'EXPO_PUBLIC_RC_API_KEY_IOS'],
    ['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'],
  ])('configures when the key is set as %s', async (androidName, iosName) => {
    process.env[androidName] = 'goog_test';
    process.env[iosName] = 'appl_test';
    await expect(configurePurchases()).resolves.toBe(true);
  });
});
