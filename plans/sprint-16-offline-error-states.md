# Sprint 16 — Offline + Error States (Multi-Vital)

## Goal
The polish sprint. Every screen has its empty state, error state, loading state, and offline state — **including all 5 vital detail screens, Daily Pulse hero, correlation cards, and AI surfaces**. Sync conflict resolution. Retry strategies for failed reads, failed pushes, failed PDF generation, **failed AI generation** (graceful fall-through to deterministic templates).

## Duration
~1 work-week.

## Hard dependencies
Sprints 5, 6, 7.5, 7.7, 8, 8.5, 9, 9.5, 12.5.

## Docs to load
All `docs/04-screens/*`, docs/_reference/D8a-self-buyer-mode.md (§14 Edge Cases), docs/_reference/D13-multi-vitals-constellation-spec.md (§6.6 staleness rules), docs/_reference/D14-ambient-ai-architecture.md (§12 output guard fallback).

## Deliverables
- Empty state component shared across screens (all 5 vital details + Trends + Home)
- Error state component
- Network status banner (when offline)
- Sync conflict resolution: server wins for vital readings, client wins for preferences (extended to all 5 vitals + correlations)
- Exponential-backoff retry for sync failures (per-vital cursors so partial failure doesn't block whole sync)
- **AI graceful degradation** per D14 §12 — if Tier-B times out or output guard rejects twice, fall through to Tier-A template. If Tier-A unavailable, fall through to deterministic copy. The user is never shown an AI error.
- **Stale vital handling** per D13 §6.6 — every vital ring/tile gracefully shows stale state with a calm caption
- Health Platform offline behaviour — if Apple Health / Health Connect is unreachable, queue writes for next opportunity
- Watch disconnect mid-reading: clean error path
- After 24h of failed `/sync`, calm reassurance banner (existing; preserved)

## Acceptance criteria
- **Offline E2E**: airplane-mode the device, take a reading, kill app, reopen, reading is still there. Restore network: BP, HR, SpO2 samples, sleep, activity all sync.
- Every screen renders correctly in airplane mode in both modes
- Every vital detail screen shows stale state correctly when its vital is stale per D13 §6.6 thresholds
- Failed PDF: shows error with retry
- Failed AI generation: never shows error to user; falls through to template
- Failed push token registration: silently retries on next launch
- Watch disconnect mid-reading: clean error path, no zombie state
- After 24h of failed `/sync`, calm reassurance banner: *"Your readings are saved. They'll sync when you're back online."*
- After 7 days of failed Apple Health write: silent retry continues; user not nagged
- All error copy passes voice gate (per D11 §3 — calm, friendly cause + suggested fix; no escalating language)

## Open prompt
Sprint 16 — Offline + Error States Multi-Vital. Read CLAUDE.md, then every `docs/04-screens/*.md`, plus docs/_reference/D13-multi-vitals-constellation-spec.md (§6.6) and docs/_reference/D14-ambient-ai-architecture.md (§12).

Propose:

1. Inventory: every (screen × state × vital) combination that needs handling
2. Shared empty/error/loading components vs per-screen
3. Sync conflict policy per vital (server-wins for readings, client-wins for prefs, vitals_other dedup behaviour)
4. AI fall-through cascade — Tier-B fail → Tier-A template fail → deterministic copy
5. Health Platform offline queue persistence

Wait for approval.

## Risk notes
- The combinatorics of (screens × vitals × states × modes × online/offline) are large. Plan a structured matrix in the proposal phase.
- AI graceful degradation is silent by design — but silent degradation must be observable in PostHog so we know how often Tier-B fails.
