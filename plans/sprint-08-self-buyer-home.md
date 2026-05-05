# Sprint 8 — Self-Buyer Home

## Goal
The self-buyer Home screen per D8a §6: hero card with the user's most-recent reading (large numeric), mini trend, weekly snapshot, Take-a-Reading FAB. Seven hero card states (no readings, normal, elevated, stage 1, stage 2, anomaly, stale).

## Duration
~1 work-week.

## Hard dependencies
Sprint 6.

## Docs to load
docs/04-screens/self-buyer-home.md (D8a amendments), docs/03-components/reading-card.md, docs/02-design-tokens.md, docs/01-data-model.md.

## Deliverables
- SelfBuyerHome.tsx with hero card
- Hero card sub-component supporting all 7 states
- Mini trend chart (last 7 days)
- Weekly snapshot row (shared with caregiver home if patterns match)

## Acceptance criteria
- Each of the 7 hero card states renders correctly
- Hero card uses `type.numeric-xl` per D8a §6.1
- Mini trend chart shows last 7 days, marked stale if last reading >36h ago
- FAB always present, position per spec

## Open prompt
Sprint 8 — Self-Buyer Home. Read CLAUDE.md, then docs/04-screens/self-buyer-home.md, docs/03-components/reading-card.md.

Propose:

1. Hero card state-selection logic (which of the 7 states applies given the latest reading + age)
2. Mini-trend chart library choice (we want lightweight — confirm against stack)
3. Components shareable with Sprint 7 caregiver home

Wait for approval.
