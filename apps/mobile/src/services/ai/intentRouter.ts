// AI module — intent router. Sprint 11 task 4.
//
// Pure pattern-matching classifier. Walks the INTENTS registry in
// declared order; the first intent whose patterns match the question
// wins. Returns the intent + the rendered response mode, or
// `responseMode: 'TIER_B_PLACEHOLDER'` when nothing matches.
//
// No LLM, no network, no embeddings. Everything is local regex.
// Sprint 12 layers Tier-B (LiteLLM/Haiku) over the placeholder for
// questions the router can't classify.
//
// Sourced from:
//   docs/_reference/D14-ambient-ai-architecture.md §9 (intent router)
//   docs/07-ai-assistant.md §3 (intent classes baseline)
//
// Design notes:
//   - The router is order-sensitive. INTENTS in services/ai/intents.ts
//     places OOS + DEFER first so a "should I take more lisinopril"
//     question matches `defer.medication-bp` before the broader FAQ
//     patterns can fire.
//   - Pre-processing is intentionally minimal: lowercase + trim. We
//     don't strip punctuation or stem words — patterns are written
//     to handle real phrasing ("?"), and over-aggressive normalisation
//     creates false matches.

import { INTENTS } from './intents';
import type { IntentMatch } from './types';

/**
 * Classify a user-typed question into one of the v1.0 intent classes.
 * Returns `IntentMatch` with the matched intent + responseMode, or
 * `responseMode: 'TIER_B_PLACEHOLDER'` when nothing in INTENTS matched.
 */
export function classifyIntent(question: string): IntentMatch {
  const normalized = (question ?? '').trim();
  if (normalized.length === 0) {
    return {
      intent: null,
      matchedPattern: null,
      responseMode: 'TIER_B_PLACEHOLDER',
    };
  }

  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      if (pattern.test(normalized)) {
        return {
          intent,
          matchedPattern: pattern.source,
          responseMode: intent.responseMode,
        };
      }
    }
  }

  return {
    intent: null,
    matchedPattern: null,
    responseMode: 'TIER_B_PLACEHOLDER',
  };
}

/**
 * Convenience wrapper for tests + analytics: returns just the intent
 * id (or null when no match).
 */
export function classifyIntentId(question: string): string | null {
  return classifyIntent(question).intent?.id ?? null;
}
