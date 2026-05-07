# Sprint 7 — Caregiver Home

## Goal
The caregiver Home screen per D8 §4.5: Family Circle list of parents, each with most-recent reading and trend; weekly snapshot row; pull-to-refresh.

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

---

## Closeout — 2026-05-07

### What shipped

**Foundations (Phase 1, sequential):**
1. **TanStack Query v5** installed (`@tanstack/react-query@^5.100.9`) and wired at the root (`RootNavigator.tsx`) with a single `QueryClient` per app lifetime, `staleTime: 30s`, no disk persistence (MMKV remains the offline source of truth per `docs/01-data-model.md` "Sync strategy").
2. **Sync orchestrator** (`src/state/syncOrchestrator.ts`) — Zustand store on the **owning phone** (founder-approved Sprint 6 brainstorm; see `memory/sprint_7_architecture_intent.md`). Triggers: cold start, app foreground edge, BT_READY transition, manual force-sync, live 0x73 BP-ready notify. Yields to take-reading mutex; debounces back-to-back triggers (5s window, manual_force bypasses). Cursor-loop pull via the new `syncBacklogToCompletion` (`src/services/sync/syncBacklogToCompletion.ts`), which loops `syncBacklog` until the watch returns an empty page. Idle-disconnect after 45s. Started at boot from `RootNavigator`.
3. **Realtime read path** (`src/hooks/useFamilyReadings.ts` + `src/services/families/fetchParentSummaries.ts`) — TanStack Query keyed on `userId`, fetched via Supabase joins (`family_members → families → readings` newest-first, capped at 14 per family for sparkline buffer). Per-family `supabase.channel(...).on('postgres_changes', INSERT)` invalidates the query when a new reading lands.

**Phase 2:**
4. **Sparkline component** (`src/components/Sparkline.tsx`) — hand-rolled with `View` primitives (no SVG/Skia/Victory dependency; spec-stack-clean). Connected line segments + endpoint dot. `accessible={false}` so it stays out of the focus order; the parent ReadingCard owns the announced label.
5. **CaregiverHome screen** (`src/screens/Home/CaregiverHome.tsx`) — header (Leiko logo + Settings ⚙), anomaly banner (most-severe-wins, calm-concerned + confirmed-urgent variants), weekly snapshot row (static heuristic line, gated behind `FEATURE_TIER_C_SNAPSHOT` for Sprint 11 swap), `FlatList`-style parent cards with sparkline below, three empty-states (no parents → verified spec copy "Your family circle is quiet for now"; no readings + no paired device → "Pair watch" CTA; loading → skeleton). Pull-to-refresh hits `runSync('manual_force')` + invalidates the query. **Owning-phone freshness**: `mergeLocalLatest` prepends the local MMKV-latest into the first family if newer than the server's view, so a just-captured reading appears instantly without waiting on /sync.
6. **ParentReadingsList placeholder** (`src/screens/Home/ParentReadingsList.tsx`) — tap-on-card target. Minimal screen showing parent name + reading count. Full reading-list view ships in Sprint 9 per `docs/04-screens/reading-list.md`.

**Cleanup:**
- Removed `src/screens/Placeholders/CaregiverHomePlaceholder.tsx`.
- Renamed nav route `CaregiverHomePlaceholder` → `CaregiverHome`; added `ParentReadings: { familyId }` route.
- Added `ReadingRow` + `readings` to the typed `Database` schema (`src/types/database.ts`).
- 4 new analytics events: `sync_started`, `sync_completed`, `sync_skipped`, `sync_failed`, `reading_realtime_received` (counts/categories only — no PHI per CLAUDE.md data rule).

### Acceptance criteria — status

- ✅ **Card per parent in family_members** — one `ReadingCard` (`ownerVariant='parent'`) per family the user is a member of, sorted by most-recent reading (parents with no readings sink to the bottom).
- ✅ **Latest reading + classification chip + trend indicator** — chip via `tierChipText`/`tierPillVariant`; trend via the new sparkline.
- ✅ **Tap routes to parent's reading list** — `ParentReadings` route + placeholder screen.
- ✅ **Empty state with verified copy** — `"Your family circle is quiet for now"` + `"Add a family member to start sharing care."` exactly matching `docs/04-screens/caregiver-home.md` lines 33–36.
- ✅ **Pull-to-refresh re-syncs** — `RefreshControl` → `runSync('manual_force')` + `queryClient.invalidateQueries`.
- ✅ **Anomaly banner appears for at least one calm_concerned + one confirmed_urgent fixture** — `pickAnomaly` unit-tested (most-severe wins) + screen-level test renders both banner variants.
- ✅ **Voice gate** — every new user-visible string scanned against the forbidden list. One violation caught + fixed during sprint close ("Their latest reading is high" → "Their latest reading was above their usual range" — per `docs/05-voice-and-claims.md` "never 'high' or 'low' without context").
- ✅ **Component + integration tests** — 12 new tests across the cursor loop, orchestrator state machine, fetchParentSummaries, and CaregiverHome (empty / populated / calm-concerned / confirmed-urgent / no-readings states + pure helpers). Full suite: **358 passing** (was 184 at sprint start). Lint + typecheck clean.

### Decisions made (founder approved "best judgement" 2026-05-07)

1. **List shape — one card per parent** (spec-canonical), not the chronological reading-feed shape from the architecture intent memo (that shape is for Sprint 8 self-buyer hero / reading detail).
2. **No FAB on caregiver home** — D8a §6.5 callout: "caregivers don't take readings — parents do, on the watch". The "Invite family" FAB is also skipped this sprint because the actual invitation flow lives in Sprint 10; flagged in commit message + here. `docs/04-screens/caregiver-home.md` line 23's FAB description stands as Sprint 10's deliverable.
3. **Tier-C snapshot copy gated** behind `FEATURE_TIER_C_SNAPSHOT = false`. Sprint 7 ships a static heuristic ("Mum's average is 124/79. In line with last week."). Sprint 11 wires the Tier-C call by flipping the flag.
4. **Sparkline hand-rolled** in `View` primitives — avoided adding `react-native-svg` to keep the locked stack untouched; Victory Native XL (the locked chart lib) is overkill for an inline sparkline and lands properly in Sprint 9 trends.

### Deferred to backlog

Both items from the architecture intent's edge-case list, plus the FAB. Filed in `plans/backlog.md` with rationale + restart conditions:

- **Server-side timezone reconciliation** (intent §5) — Sprint 6's device-side fix in `services/sync/syncBacklog.ts` is verified working; moving without a focused sprint risks regressing live timestamps.
- **"Watch already paired to another phone" UX** (intent §6.1) — needs the canonical write of `devices.paired_by_user_id` at pairing time before the read-side flow can be honest. Wire alongside the parent-side install flow.
- **Invite-family FAB** — Sprint 10 owns the actual invitation flow. Adding a non-functional FAB would be vapor.

### Major gap surfaced (not Sprint 7's job to solve, but founder-flagged 2026-05-07)

The watch captures **BP, HR, SpO2, sleep, steps, and calories**. The data model (`docs/01-data-model.md` `vitals_other`) and BLE protocol doc (`docs/06-ble-protocol.md` §3 — 14 commands) account for all of these. The current implementation ships **only `readBPHistory` + the BP write path**. The other 10 BLE wrappers don't exist; `vitals_other` is empty in production; `/sync` Edge Function only accepts a `ReadingPayload`. **No sprint card in the current 1–17 plan funds this work.** Founder confirmed end of Sprint 7: this is a separate-session redesign, not a Sprint 7 deliverable. See `plans/backlog.md` "Multi-vitals ingest gap" + `memory/multi_vitals_gap.md` for the full handoff context.

### What "next session" inherits

- Sprint 7 closed and committed. Caregiver home renders cleanly on the dev phone.
- Sprint 8 (self-buyer home) as currently written is **BP-only**. The redesign session should decide whether to rewrite Sprint 8 to include the multi-vitals constellation OR insert a "Sprint 7.5 — Multi-vitals ingest" plumbing sprint before Sprint 8.
- The four new BLE wrappers (`readHRHistory 0x15`, `readSpO2History 0x2D`, `readActivity 0x12`, `readSleep 0x12/0x13`) are spec'd in `docs/06-ble-protocol.md` §3 — implementation is the lift.
