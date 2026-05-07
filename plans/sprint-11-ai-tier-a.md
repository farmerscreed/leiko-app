# Sprint 11 — AI Tier-A Multi-Vital Intent Router

## Goal
Build the multi-vital Tier-A intent classifier per D14 §9.1 + §3.3. Pattern-matching against ~50 intent classes (BP + HR + SpO2 + Sleep + Activity + correlation + DEFER + out-of-scope). Plus the **narration template library** (~30 templates per D14 §3.3) that drives the Daily Pulse narration line for free users and Tier-A-routable cases. **No LLM calls in this sprint** — all local pattern-matching and templates.

## Duration
~1 work-week.

## Hard dependencies
Sprint 6, Sprint 7.5 (data shapes for narration), Sprint 13 (Learn articles must exist for citation).

## Docs to load
docs/_reference/D14-ambient-ai-architecture.md (§3, §9, §10), docs/_reference/D11-brand-repositioning.md (§3 voice rules), docs/_reference/D9-editorial.md (§7), docs/08-learn-module.md.

## Deliverables
- `apps/mobile/src/services/ai/intentRouter.ts` — pattern-matching classifier for ~50 intents per D14 §9.1
- `apps/mobile/src/services/ai/__fixtures__/intents.ts` — 5+ examples per intent for tests
- `apps/mobile/src/services/ai/narrationTemplates.ts` — ~30 template library per D14 §3.3
- Tier-A response renderer (renders Learn article inline in chat thread)
- Tier-B placeholder ("I'm not sure how to answer that yet — try rephrasing") — Sprint 12 swaps this in cleanly
- Voice-lint CI step that scans every template + intent response for forbidden vocabulary per D11 §3.2 + §3.3
- Card-matcher index for Learn cards (`cards_embeddings` table population) per D14 §10
- DEFER trigger templates per D14 §13 / docs/07-ai-assistant.md §4 (specific-medication, symptom, pregnancy, paediatric, mental-health-crisis, generic)

## Acceptance criteria
- All ~50 intents covered with > 95% accuracy on the fixture library
- Multi-vital intents (HR / SpO2 / Sleep / Activity / correlation) all route to the correct response
- Every template passes voice-lint
- Daily narration generates a valid template for every reachable state combination (5 vital classifications × 4 central-value priorities = 20 combinations minimum, all tested)
- DEFER trigger fixture (e.g. "should I take more BP medicine") returns the specific-medication template, not the generic
- Pregnancy + paediatric + mental-health-crisis fixtures all DEFER correctly
- Unknown question falls through to Tier-B placeholder
- No external network calls in this sprint

## Open prompt
Sprint 11 — AI Tier-A Multi-Vital Intent Router. Read CLAUDE.md, then docs/_reference/D14-ambient-ai-architecture.md (§3, §9, §10).

Propose:

1. Matching strategy: pure keyword? lightweight embedding (Llama-on-Hetzner)? both? confidence threshold
2. Mapping file format and where it lives in the repo
3. Voice-lint CI integration (Jest custom matcher? separate ESLint plugin?)
4. Template selection algorithm — decision tree vs scored ranking
5. How Tier-B placeholder is wired so Sprint 12 swaps in cleanly

Wait for approval.

## Risk notes
- Template voice drift is the highest-probability failure here. Voice-lint must run pre-commit, not just in CI.
- The narration template library is consumed by Sprint 8 (Self-Buyer Home) and Sprint 7.7 (Caregiver Home). Coordination needed.
- The 50-intent count is the v1.0 floor. New intents will surface during beta — leave room for additions.

## What this sprint explicitly does NOT ship
- Tier-B LiteLLM client (Sprint 12)
- The narration generator that picks templates and substitutes parent_label / vital values (Sprint 12.5 — wires both Tier-A and Tier-B paths)
- Real card-discovery embeddings beyond keyword (Sprint 12 wires the cosine-similarity stage)