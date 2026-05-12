# Sprint 12.5.2 — Watch BP persistence (force user params on take-reading connect)

## Goal
Fix the watch-side BP-persistence symptom flagged in Sprint 12.5.1: `readBPHistory` occasionally returns the 0xFFFFFFFF terminator after a successful cuff cycle. Suspected cause: `setUserParams` was never pushed because `vitalSetup.dirty` defaults to `false` and the take-reading flow never calls `applyDeviceConfig`. Some Urion firmwares gate BP-result persistence on having valid demographics.

## Duration
1 session. Single small wire-up + test + commit + on-device verification.

## Hard dependencies
None. `applyDeviceConfig(device, { force: true })` already exists at `apps/mobile/src/services/sync/applyDeviceConfig.ts:75` — it just isn't called from the take-reading flow.

## Docs to load
`docs/06-ble-protocol.md` §3 (command inventory), `apps/mobile/src/services/sync/applyDeviceConfig.ts` (the existing wrapper), `apps/mobile/src/state/vitalSetup.ts` (dirty-flag model), `memory/multi_vitals_gap.md` (Sprint 7.5 close-out — the "setUserParams stubbed" deferral).

## Symptom (the bigger story carried from 12.5.1)
Same hardware (Pixel 8 + U19M_013C) persists HR + SpO2 history fine. BP history occasionally returns terminator for `readBPHistory(TS=0, DIR=1)` even after the user completed a full cuff inflate-measure-deflate cycle and the watch's display showed a number. The 2026-05-12 Lagos trace caught this red-handed across 13 distinct queries.

## Plan
1. **Wire `applyDeviceConfig(device, { force: true })` into `useTakeReading.begin()`** — after `connectToUrion` succeeds, before the existing `syncBacklog` call. Failures are non-fatal: log, continue. The watch keeps whatever previous params it had if anything fails.
2. **No-op when the user's profile lacks demographics** — `applyDeviceConfig` already short-circuits `setUserParams` when gender / year_of_birth / height_cm / weight_kg aren't all populated (the `hasDemographics(profile)` check at `applyDeviceConfig.ts:104`). So the change is safe for users mid-onboarding.
3. **Test**: assert `applyDeviceConfig` is called once during `begin()` with `{ force: true }`. Also assert that a failure inside `applyDeviceConfig` does NOT block the rest of the flow.
4. **On-device verification**: take a new BP reading on the watch. Confirm it now persists to `readBPHistory` and surfaces in the app via the Sprint 12.5.1 reconnect-and-poll path.

## Acceptance criteria
- After paired user takes a fresh BP reading on the watch:
  - The reading appears in the app's home center ring within the 90s poll window from Sprint 12.5.1 Commit 3.
  - `readBPHistory` returns the new reading (not a terminator).
- `applyDeviceConfig` is called once per take-reading session with `force: true`. (Verified by unit test.)
- A `setUserParams` failure (e.g. user has incomplete profile) does NOT abort the take-reading flow — the BP measurement still works, the result still surfaces, just without user params having been refreshed.
- No regression on the cursor-stable steady state from Sprint 12.5.1 (`pulled=0, cursor unchanged` on repeated syncs).

## Risk notes
- If the persistence issue is NOT caused by missing user params, this commit won't fix it. Falsifiable on-device. Backup theories captured in `memory/sprint_12_5_1_close_out.md`.
- Forcing `applyDeviceConfig` adds ~400ms (4 BLE writes + acks) to every take-reading connect. Acceptable — the user has already tapped the FAB and is staring at "Reaching the watch."
- `vitalSetup.dirty` clearing logic stays the same — `applyDeviceConfig` clears `dirty` on success regardless of whether `force` was set. That's fine; the next non-forced sync just skips as before.

## What this sprint explicitly does NOT ship
- A Settings UI prompt for missing demographics (the underlying recovery — "user has no profile data so watch BP doesn't work"). Demographics flow is part of onboarding; if a user got past onboarding without filling them in, that's a separate bug. This sprint takes whatever's in the profile and pushes it; nothing more.
- Forcing `applyDeviceConfig` in the orchestrator's runSync. Existing dirty-based behaviour stays; this sprint touches only the take-reading hot path.
- The TS=0-always sync refactor (Sprint 16 polish).
