// statusMap.ts — pure event-type → status mapping for the
// /revenuecat-webhook handler. Pulled into its own module so the
// classification table is testable without booting Deno's HTTP server.
//
// The truth table is in index.ts; this file is the executable form.

export type RcEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'TRIAL_STARTED'
  | 'TRIAL_CONVERTED'
  | 'TRIAL_CANCELLED'
  | 'CANCELLATION'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'TRANSFER';

/** Values allowed by the public.subscriptions.status CHECK. */
export type SubscriptionsStatus =
  | 'active'
  | 'trialing'
  | 'grace'
  | 'past_due'
  | 'cancelled'
  | 'expired';

/** Values allowed by the public.families.subscription_status CHECK. */
export type FamiliesSubscriptionStatus =
  | 'free'
  | 'plus'
  | 'plus_trial'
  | 'plus_grace'
  | 'past_due';

export interface ClassifiedEvent {
  subscriptionsStatus: SubscriptionsStatus;
  familiesStatus: FamiliesSubscriptionStatus;
  /**
   * False when entitlement should remain unchanged at the family level
   * even though the subscription state changed (e.g., a CANCELLATION
   * before EXPIRATION — Apple's grace window). The `subscriptions` row
   * still updates so caller-side state ("you cancelled") is visible to
   * the user immediately; the family flips to `free` only on EXPIRATION.
   */
  shouldUpdateFamily: boolean;
  auditAction: string;
}

interface ClassifyInput {
  type: string;
  is_trial_period?: boolean;
}

export function classifyEvent(event: ClassifyInput): ClassifiedEvent {
  switch (event.type as RcEventType) {
    case 'TRIAL_STARTED':
      return {
        subscriptionsStatus: 'trialing',
        familiesStatus: 'plus_trial',
        shouldUpdateFamily: true,
        auditAction: 'subscription.activated',
      };

    case 'INITIAL_PURCHASE':
    case 'NON_RENEWING_PURCHASE':
    case 'UNCANCELLATION':
      return {
        subscriptionsStatus: 'active',
        familiesStatus: event.is_trial_period ? 'plus_trial' : 'plus',
        shouldUpdateFamily: true,
        auditAction: 'subscription.activated',
      };

    case 'RENEWAL':
    case 'TRIAL_CONVERTED':
    case 'PRODUCT_CHANGE':
      return {
        subscriptionsStatus: 'active',
        familiesStatus: event.is_trial_period ? 'plus_trial' : 'plus',
        shouldUpdateFamily: true,
        auditAction: 'subscription.renewed',
      };

    case 'BILLING_ISSUE':
      return {
        subscriptionsStatus: 'grace',
        familiesStatus: 'plus_grace',
        shouldUpdateFamily: true,
        auditAction: 'subscription.renewed',
      };

    case 'CANCELLATION':
    case 'TRIAL_CANCELLED':
      return {
        subscriptionsStatus: 'cancelled',
        familiesStatus: 'free', // unused — shouldUpdateFamily=false
        shouldUpdateFamily: false,
        auditAction: 'subscription.lapsed',
      };

    case 'EXPIRATION':
      return {
        subscriptionsStatus: 'expired',
        familiesStatus: 'free',
        shouldUpdateFamily: true,
        auditAction: 'subscription.lapsed',
      };

    case 'SUBSCRIPTION_PAUSED':
    case 'TRANSFER':
    default:
      // Pause + transfer are rare and don't affect entitlement at v1.
      // Record the event but leave families alone.
      return {
        subscriptionsStatus: 'active',
        familiesStatus: 'plus',
        shouldUpdateFamily: false,
        auditAction: 'subscription.renewed',
      };
  }
}
