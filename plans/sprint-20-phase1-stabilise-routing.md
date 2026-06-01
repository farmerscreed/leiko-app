# Sprint — Phase 1: Stabilise family-routing (ADR-0006)

**Status:** Proposed — awaiting founder go-ahead before any code.
**Branch:** `claude/consolidated-build` (continues the investigation work).
**ADR:** `docs/_adr/0006-unified-caregiver-self-buyer-model.md` (Phase 1 of 5).
**Depends on:** `clientDeviceId` (stable per-install identity) — already
shipped on this branch in commit `859bc0f`.

## Why this sprint exists

The 2026-06-01 investigation found that watch data routes to a
**non-deterministic family**: `sync/index.ts` resolves the wearer's circle
with `family_members … limit(1)` and **no `.order()`**. For any user in
>1 circle, data scatters run-to-run (the original "caregiver shows 0
steps" report — real vitals split 3/14 across two families).

Phase 1 is the **safe, model-agnostic** slice of ADR-0006: it stops the
bleeding **without** the big UI/onboarding redesign. It ships
independently and is correct under both today's binary model and the
future unified model. No user-visible surface changes; this is data-path
correctness only.

## Goals (in scope)

1. **Device-authoritative, deterministic sync routing.** A watch's data
   goes to the circle its (stable) device is bound to — not "whichever
   family the syncing user is in first."
2. **`create_family` idempotency guard** for the self-circle, closing the
   duplicate-family race (`useEnsureSelfBuyerFamily` check-then-create).
3. **Finish the one-time live-data cleanup** — the founder's real vitals
   still partly stranded in the orphaned `NaHim/uncle` test family.

## Non-goals (explicitly deferred to later ADR-0006 phases)

- Unified constellation home / "You" node / urgency reordering (Phase 2).
- Onboarding fork removal + merged intro + in-flow pairing (Phase 3).
- Settings → two role-aware family sections (Phase 4).
- Two-direction invites + pending-invite plumbing + deep links (separate,
  larger work — depends on Phase 3).
- Making `account_type` inert / `create_family` self-circle-only refactor
  (Phase 3 — it changes call sites). Phase 1 only adds a guard; it does
  **not** remove the account_type branch yet.

## Ordered tasks

Each task is one commit. Tests land with the task (per CLAUDE.md testing
standard). Pause for founder review after Task 1 (the behavioural core)
before proceeding.

### Task 1 · Device-authoritative family resolution in `sync`

**File:** `supabase/functions/sync/index.ts`

Today (lines 105–137): resolve `familyId` from membership `limit(1)` →
pass into `ensureDeviceRow`. Flip the order:

1. Resolve the **device first** by its globally-unique `client_device_id`
   (independent of family). If a non-unpaired device row exists, use **its**
   `family_id` as the authoritative route. Refresh `mac_address` as today.
2. **Fallbacks** (only when no device match):
   - Legacy clients with no `clientDeviceId`: match active device by MAC
     (existing path), use its `family_id`.
   - Genuinely new device: resolve family from membership, but
     **deterministically** — add `.order('joined_at', { ascending: true })`
     (oldest circle = the user's own self-circle, created at onboarding),
     and `.eq('role', 'family_owner')` so a *follower* membership can never
     capture a wearer's watch. Then create the device bound to that family.
3. **Verify membership** of the syncing user in the resolved family before
   accepting data (defence: a device's family must include the caller).

**Why this is safe under both models:** binding follows the device, which
already carries the correct `family_id` from when it was first paired.
A multi-circle user's watch can no longer leak into a circle it doesn't
belong to.

**Verification / tests** (`supabase/functions/sync/__tests__` or the
shared test harness used by sibling functions):
- device-match wins over membership (multi-family user → routes to bound
  family, not `limit(1)`).
- new device + multi-family user → routes to oldest `family_owner` circle,
  deterministically across repeated calls.
- follower-only membership never captures a new device.
- legacy (no clientDeviceId) MAC path still resolves.
- caller-not-member-of-device-family → rejected.

### Task 2 · `create_family` self-circle idempotency guard

**Files:** new migration `supabase/migrations/00XX_create_family_idempotent.sql`;
no client change required (the hook already no-ops on existing membership —
this closes the *race* window server-side).

- In the `self_buyer` branch, before insert: if the caller already
  `family_owner`s a circle where `parent_user_id = caller` and
  `removed_at IS NULL`, **return that existing `family_id`** instead of
  creating a second. Makes the RPC idempotent for the self-circle.
- Caregiver branch unchanged in Phase 1 (its refactor to self-circle-only
  is Phase 3).

**Verification / tests** (`supabase/tests/` pgTAP, matching
`0003`/`0004` test style):
- two rapid self_buyer calls → one circle, same id returned twice.
- caller with an existing self-circle → returns it, no new row.
- a fresh caller → creates exactly one.

### Task 3 · One-time live-data cleanup (founder's project)

**Not code — a reviewed SQL runbook** the founder executes against prod
(same pattern as the earlier cleanups). Consolidates the founder's real
vitals out of the orphaned `NaHim/uncle` family (`1f9b7a9c…`) into the
real `Lawrence/self` circle (`21b057bb…`), deletes the 3 misrouted BP
readings (immutable → delete chosen earlier), retires the orphaned device.

- Provided as preview + transaction with a rollback path.
- Must run **after** Task 1 deploys, so a later sync can't re-scatter.
- Verification query confirms: uncle family empty, self circle whole, one
  active device with `client_device_id` set.

## Acceptance criteria

1. A multi-circle user's watch data lands deterministically in the bound
   circle, verified by test + by re-running the founder's sync and
   checking all step-days sit in one family.
2. Repeated `create_family` self calls yield exactly one self-circle.
3. Founder's prod data: `NaHim/uncle` empty; `Lawrence/self` holds the
   full history; one active device.
4. All new tests green in CI; existing sync + family tests still green.
5. No user-visible UI change (Phase 1 is data-path only).

## Risk notes

- **Edge-function tests aren't runnable in this container** (no Deno).
  Task 1/2 tests are authored + reviewed by inspection; CI is the
  backstop. Flag any deploy-time surprise back to the founder.
- **Migration ordering** (Task 2) and **deploy-before-cleanup** (Task 3)
  are sequencing hazards — the card states the order explicitly.
- Task 1 changes the *meaning* of family resolution; the post-Task-1
  review pause exists so the founder confirms behaviour before 2 & 3.
