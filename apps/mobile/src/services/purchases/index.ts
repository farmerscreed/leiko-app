// services/purchases — RevenueCat SDK adapter.
//
// Sprint 10a wires the IAP plumbing per docs/09-paywall-and-iap.md §4.
// All call sites (Paywall screen, app boot, auth state changes) talk to
// this adapter rather than `react-native-purchases` directly so we can:
//
//   1. No-op cleanly when EXPO_PUBLIC_RC_API_KEY_* env vars are missing
//      (dev workspaces without an RC project configured shouldn't crash
//      on boot).
//   2. Mock the surface in jest without pulling the native module —
//      tests stub this file via `jest.mock(...)` rather than the
//      transitively-loaded RN bridge.
//   3. Centralise the product-ID + trial-mechanics constants so they
//      can't drift between app code and the webhook.
//
// The native module itself is loaded lazily (require, not import) so a
// bundle that hasn't run prebuild yet still type-checks and unit-tests.
// On a build that DOES have the native side, the require resolves on
// first call and is cached thereafter.

import type { AccountType } from '../../types/database';

// Resolved lazily inside getApiKey so the pure jest project (ts-jest in
// node, no jest-expo) can load this module transitively via auth.ts
// without parsing react-native's flow-typed entrypoint.
function getOs(): 'ios' | 'android' | 'other' {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = (require('react-native') as { Platform: { OS: string } }).Platform.OS;
    if (os === 'ios') return 'ios';
    if (os === 'android') return 'android';
    return 'other';
  } catch {
    return 'other';
  }
}

export const PRODUCT_IDS = {
  monthly: 'com.leiko.app.plus.monthly',
  annual: 'com.leiko.app.plus.annual',
} as const;

export type PurchasePeriod = 'monthly' | 'annual';

export interface PriceQuote {
  period: PurchasePeriod;
  productId: string;
  /** Localised price string from the store, e.g. "$4.99" or "₦7,990". */
  priceString: string;
  /** Numeric for analytics + sanity (we never display this). */
  priceMicros: number;
  currencyCode: string;
}

export interface OfferingsSnapshot {
  monthly: PriceQuote | null;
  annual: PriceQuote | null;
}

export interface PurchaseResult {
  productId: string;
  /** RevenueCat customer info — opaque to the app; the webhook is the
   *  authoritative entitlement path. We surface it only so the paywall
   *  can show "you're in" before the round-trip lands. */
  isPlusActive: boolean;
}

interface PurchasesModule {
  configure(options: { apiKey: string; appUserID?: string }): Promise<void>;
  logIn(appUserID: string): Promise<unknown>;
  logOut(): Promise<unknown>;
  getOfferings(): Promise<{
    current?: {
      monthly?: PurchasesPackage;
      annual?: PurchasesPackage;
      availablePackages: PurchasesPackage[];
    } | null;
  }>;
  purchasePackage(pkg: PurchasesPackage): Promise<{
    customerInfo: PurchasesCustomerInfo;
  }>;
  restorePurchases(): Promise<PurchasesCustomerInfo>;
  setAttributes(attrs: Record<string, string | null>): Promise<unknown>;
}

interface PurchasesPackage {
  identifier: string;
  product: {
    identifier: string;
    priceString: string;
    price: number;
    currencyCode: string;
  };
}

interface PurchasesCustomerInfo {
  entitlements: {
    active: Record<string, { isActive: boolean; productIdentifier: string }>;
  };
}

let nativeModule: PurchasesModule | null = null;
let nativeLoadFailed = false;
let configured = false;

function loadNative(): PurchasesModule | null {
  if (nativeModule) return nativeModule;
  if (nativeLoadFailed) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases');
    // The package's CJS export is the default; in some builds it's the
    // module object. Handle both.
    nativeModule = (mod?.default ?? mod) as PurchasesModule;
    return nativeModule;
  } catch {
    nativeLoadFailed = true;
    return null;
  }
}

function getApiKey(): string | null {
  // EAS build pipelines set these per-env. Local dev without keys
  // returns null and the adapter no-ops.
  const os = getOs();
  if (os === 'ios') return process.env.EXPO_PUBLIC_RC_API_KEY_IOS ?? null;
  if (os === 'android') return process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? null;
  return null;
}

/**
 * Idempotent — safe to call from RootNavigator's mount effect. Returns
 * true on a successful configure (or already-configured), false when
 * the SDK or API key is unavailable.
 */
export async function configurePurchases(): Promise<boolean> {
  if (configured) return true;
  const apiKey = getApiKey();
  if (!apiKey) return false;
  const native = loadNative();
  if (!native) return false;
  try {
    await native.configure({ apiKey });
    configured = true;
    return true;
  } catch {
    // The native module exists but configure failed — usually a missing
    // API key in production. Keep configured=false so the next call can
    // try again rather than silently swallowing.
    return false;
  }
}

/**
 * Identify the signed-in user with RevenueCat. Called from the auth
 * store's _setSession on every transition to authenticated. Sets
 * subscriber attributes that surface in RC dashboards (account_type,
 * family_id) without sending PHI.
 */
export async function identifyPurchaser(
  userId: string,
  attrs: { accountType: AccountType; familyId: string | null },
): Promise<void> {
  const ok = await configurePurchases();
  if (!ok) return;
  const native = loadNative();
  if (!native) return;
  try {
    await native.logIn(userId);
    await native.setAttributes({
      account_type: attrs.accountType,
      family_id: attrs.familyId,
    });
  } catch {
    // Best-effort. The webhook is the authoritative entitlement path —
    // if RC identify fails we still receive entitlement updates once
    // the user actually purchases.
  }
}

export async function logoutPurchaser(): Promise<void> {
  const native = loadNative();
  if (!native || !configured) return;
  try {
    await native.logOut();
  } catch {
    // ignore
  }
}

export async function fetchOfferings(): Promise<OfferingsSnapshot> {
  const ok = await configurePurchases();
  if (!ok) return { monthly: null, annual: null };
  const native = loadNative();
  if (!native) return { monthly: null, annual: null };
  try {
    const offerings = await native.getOfferings();
    const current = offerings.current;
    if (!current) return { monthly: null, annual: null };
    return {
      monthly: current.monthly ? toQuote(current.monthly, 'monthly') : null,
      annual: current.annual ? toQuote(current.annual, 'annual') : null,
    };
  } catch {
    return { monthly: null, annual: null };
  }
}

function toQuote(pkg: PurchasesPackage, period: PurchasePeriod): PriceQuote {
  return {
    period,
    productId: pkg.product.identifier,
    priceString: pkg.product.priceString,
    priceMicros: Math.round(pkg.product.price * 1_000_000),
    currencyCode: pkg.product.currencyCode,
  };
}

/**
 * Start a purchase / trial. Returns a PurchaseResult on success or
 * throws on user cancellation / store error. The PaywallSheet catches
 * the throw and surfaces a quiet "we couldn't start the trial" message.
 */
export async function purchasePeriod(period: PurchasePeriod): Promise<PurchaseResult> {
  const ok = await configurePurchases();
  if (!ok) throw new Error('purchases_unavailable');
  const native = loadNative();
  if (!native) throw new Error('purchases_unavailable');

  const offerings = await native.getOfferings();
  const pkg = period === 'monthly'
    ? offerings.current?.monthly
    : offerings.current?.annual;
  if (!pkg) throw new Error('package_not_found');

  const { customerInfo } = await native.purchasePackage(pkg);
  return {
    productId: pkg.product.identifier,
    isPlusActive: Object.values(customerInfo.entitlements.active).some(
      (e) => e.isActive,
    ),
  };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const ok = await configurePurchases();
  if (!ok) throw new Error('purchases_unavailable');
  const native = loadNative();
  if (!native) throw new Error('purchases_unavailable');
  const customerInfo = await native.restorePurchases();
  return {
    productId: '',
    isPlusActive: Object.values(customerInfo.entitlements.active).some(
      (e) => e.isActive,
    ),
  };
}

/** Test surface — clears module state between jest runs. */
export function _resetPurchasesAdapterForTests(): void {
  nativeModule = null;
  nativeLoadFailed = false;
  configured = false;
}
