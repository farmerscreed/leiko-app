// usePlusEntitlement — Sprint 9 stub.
//
// Returns the active subscription tier for the signed-in user, derived
// from `families.subscription_status` (per docs/09-paywall-and-iap.md
// §4 "source of truth"). Sprint 9 ships a stub that always reports
// 'free' — Sprint 10 wires:
//   1. RevenueCat purchase + restore SDK + product IDs.
//   2. /revenuecat-webhook Edge Function that updates families.subscription_status.
//   3. This hook reads families.subscription_status via supabase + a
//      Realtime subscription so tier changes propagate live.
//
// Contract:
//   • `tier` — one of the subscription_status values ('free' | 'plus' |
//     'plus_trial' | 'plus_grace' | 'past_due'). Sprint 9 always
//     returns 'free'.
//   • `isPlus` — derived gate. true when tier is 'plus' OR 'plus_trial'
//     OR 'plus_grace' (per §5 grace handling: still entitled).
//   • `isLoading` — true while the entitlement fetch is in flight.
//     Sprint 9 stub is synchronous, returns false immediately.
//
// Why a hook instead of a Zustand selector: when Sprint 10 lands the
// Supabase round-trip, TanStack Query owns the cache + invalidation;
// the hook signature here doesn't need to change.

import type { SubscriptionStatus } from '../types/database';

export interface PlusEntitlement {
  tier: SubscriptionStatus;
  /** True when the tier grants Plus features (active / trial / grace). */
  isPlus: boolean;
  isLoading: boolean;
}

/** Tiers that grant Plus features — keep in lockstep with the
 *  /revenuecat-webhook handler in Sprint 10. */
const PLUS_TIERS: ReadonlySet<SubscriptionStatus> = new Set([
  'plus',
  'plus_trial',
  'plus_grace',
]);

export function isPlusTier(tier: SubscriptionStatus): boolean {
  return PLUS_TIERS.has(tier);
}

export function usePlusEntitlement(): PlusEntitlement {
  // Sprint 9: stub. Sprint 10 swaps this for a TanStack Query that
  // reads families.subscription_status, plus a Realtime subscription
  // that invalidates the query on UPDATE. Keep the return shape stable
  // so call sites don't change.
  const tier: SubscriptionStatus = 'free';
  return {
    tier,
    isPlus: isPlusTier(tier),
    isLoading: false,
  };
}
