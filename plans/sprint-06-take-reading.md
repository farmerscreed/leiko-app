# Sprint 6 — Take Reading + Reading Detail

## Goal
User can trigger a reading from the app, the watch performs the oscillometric measurement, the result is stored locally and synced to Supabase, and the user lands on the Reading Detail screen with classification, anchors, and Learn integration points (anchors are wired but explainer comes in Sprint 13).

## Duration
~1 work-week.

## Hard dependencies
Sprint 5.

## Docs to load
docs/04-screens/take-reading.md, docs/04-screens/reading-detail.md, docs/06-ble-protocol.md, docs/01-data-model.md (§ readings), docs/10-anomaly-logic.md, docs/05-voice-and-claims.md.

## Deliverables
- Take-a-Reading FAB / sheet flow
- Reading Detail screen: BP value, status chip, HR + SpO2 mini-stats, trend indicator, "Why this reading?" anchor (button only — explainer in Sprint 13), anomaly badge if applicable
- Reading classification logic per D6 §4.7 (Normal / Elevated / Stage 1 / Stage 2)
- Migration: readings table per docs/01-data-model.md
- MMKV-first save, then Supabase sync (best-effort)
- ReadingCard component per docs/03-components/reading-card.md (used by Sprints 7/8)

## Acceptance criteria
- User taps FAB, follows on-screen instructions ("stay still", etc.), watch inflates and measures, app receives reading
- Reading is saved to MMKV before any sync attempt (test with airplane mode)
- Reading appears on Reading Detail with correct classification chip
- Reading syncs to Supabase when network is available; works offline if not
- Anchors render as button.ghost but tapping them does nothing yet (no-op until Sprint 13)
- Reading values NEVER appear in PostHog events (verify with synthetic event)

## Open prompt
Sprint 6 — Take Reading + Reading Detail. Read CLAUDE.md, then docs/04-screens/take-reading.md, docs/04-screens/reading-detail.md, docs/10-anomaly-logic.md.

Propose:

1. The reading state machine: idle → prompting → measuring → result → saved
2. MMKV save path before sync — confirm it's atomic
3. Anchor placeholder strategy (button shows but doesn't open anything)
4. Classification logic location — pure function in utils/, tested independently

Wait for approval.
