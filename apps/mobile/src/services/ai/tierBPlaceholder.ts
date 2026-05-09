// AI module — Tier-B placeholder. Sprint 11 task 9.
//
// Pure function returning the user-facing copy when the local intent
// router can't classify a question. Sprint 12 swaps the body for a
// real LiteLLM/Haiku call.
//
// Per the Sprint 11 card: "I'm not sure how to answer that yet — try
// rephrasing".
//
// The router never decrements quota for the placeholder — that
// behaviour is part of Sprint 12's Tier-B integration. The
// `tier_b_placeholder_hit` analytics event lets us see how often
// users land here while building the router.

export const TIER_B_PLACEHOLDER_TEXT =
  "I'm not sure how to answer that yet — try rephrasing.";

export interface TierBPlaceholderResult {
  text: string;
  /** Analytics event name to fire — caller decides whether to fire. */
  analyticsEvent: 'ai_tier_b_placeholder_hit';
}

export function tierBPlaceholder(): TierBPlaceholderResult {
  return {
    text: TIER_B_PLACEHOLDER_TEXT,
    analyticsEvent: 'ai_tier_b_placeholder_hit',
  };
}
