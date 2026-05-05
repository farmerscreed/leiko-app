# Sprint 7 — Caregiver Home

## Goal
The caregiver Home screen per D8 §4.5: Family Circle list of parents, each with most-recent reading and trend; weekly snapshot row; Take-a-Reading FAB; pull-to-refresh.

## Duration
~1 work-week.

## Hard dependencies
Sprint 6.

## Docs to load
docs/04-screens/caregiver-home.md, docs/03-components/reading-card.md, docs/02-design-tokens.md, docs/01-data-model.md.

## Deliverables
- CaregiverHome.tsx with Family Circle list
- Parent card sub-component (uses reading-card pattern with caregiver variant)
- Weekly snapshot row component
- Empty state ("Add your first parent" or "Pair the watch")

## Acceptance criteria
- Home shows a card per parent in family_members
- Each card shows the most-recent reading with classification chip and trend indicator
- Tap on parent card → routes to that parent's reading list (placeholder OK; full screen in later sprint)
- Empty state shows when no parents added (per docs/05-voice-and-claims.md verified empty-state copy)
- Pull-to-refresh re-syncs from Supabase

## Open prompt
Sprint 7 — Caregiver Home. Read CLAUDE.md, then docs/04-screens/caregiver-home.md, docs/03-components/reading-card.md.

Propose:

1. The query strategy for "most-recent reading per parent"
2. How offline state is handled (cached MMKV reading vs nothing)
3. Empty-state logic ordering (no watch → no parent → no readings)

Wait for approval.
