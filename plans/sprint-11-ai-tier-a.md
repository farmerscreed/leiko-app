# Sprint 11 — AI Tier-A Intent Router

## Goal
Build the intent classifier from D9 §8.3: incoming question → keyword + embedding match against a published mapping file → if matched, return the relevant Learn article inline; if not, escalate to Tier-B (placeholder until Sprint 12). **NO LLM calls in this sprint.**

## Duration
~1 work-week.

## Hard dependencies
Sprint 6, Sprint 13 (Learn articles must exist as MDX assets in the bundle).

## Docs to load
docs/07-ai-assistant.md, docs/08-learn-module.md, docs/05-voice-and-claims.md.

## Deliverables
- apps/mobile/src/services/ai/intentRouter.ts — the matcher
- Question → article mapping JSON file (from D9 §8.3 table)
- Tier-A response component (renders Learn article inline in chat thread)
- Tier-B placeholder ("I'm not sure how to answer that yet — try rephrasing")

## Acceptance criteria
- Each question pattern in D9 §8.3 routes to the correct article in tests
- Unknown question routes to Tier-B placeholder
- No external network calls in this sprint
- DEFER triggers (medication / symptom / pregnancy / mental-health-crisis / generic-out-of-scope) return correct DEFER template per docs/07-ai-assistant.md §4

## Open prompt
Sprint 11 — AI Tier-A Intent Router. Read CLAUDE.md, then docs/07-ai-assistant.md, docs/08-learn-module.md.

Propose:

1. Matching strategy: pure keyword? embedding? both? confidence threshold
2. Mapping file format and where it lives in the repo
3. Test cases derived from D9 §8.3 table
4. How Tier-B placeholder is wired so Sprint 12 swaps in cleanly

Wait for approval.
