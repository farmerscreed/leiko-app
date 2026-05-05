# Sprint 16 — Offline + Error States

## Goal
The polish sprint. Every screen has its empty state, error state, loading state, and offline state. Sync conflict resolution. Retry strategies for failed reads, failed pushes, failed PDF generation.

## Duration
~1 work-week.

## Hard dependencies
Sprints 5, 6, 7/8.

## Docs to load
All docs/04-screens/*, docs/_reference/D8a-self-buyer-mode.md (§14 Edge Cases).

## Deliverables
- Empty state component shared across screens
- Error state component
- Network status banner (when offline)
- Sync conflict resolution: server wins for readings, client wins for preferences
- Exponential-backoff retry for sync failures

## Acceptance criteria
- **Offline E2E**: airplane-mode the device, take a reading, kill app, reopen, reading is still there. Restore network: it syncs.
- Every screen renders correctly in airplane mode
- Failed PDF: shows error with retry
- Failed push token registration: silently retries on next launch
- Watch disconnect mid-reading: clean error path, no zombie state
- After 24h of failed `/sync`, calm reassurance banner: *"Your readings are saved. They'll sync when you're back online."*
- All error copy passes voice gate (friendly cause + suggested fix per docs/05-voice-and-claims.md)

## Open prompt
Sprint 16 — Offline + Error States. Read CLAUDE.md, then every docs/04-screens/*.md, plus docs/_reference/D8a-self-buyer-mode.md (§14 Edge Cases).

Propose:

1. Inventory: every (screen, state) combination that needs handling
2. Shared empty/error/loading components vs per-screen
3. Sync conflict policy (server-wins for readings, client-wins for prefs)
4. Retry policy for which operations

Wait for approval.
