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

---

## Close-out — 2026-05-12 (substantially complete; verification deferred)

Closed across 3 commits over one extended session in Lagos. The original watch-side BP-persistence fix is in place, but on-device verification surfaced two blocking gaps that required the Settings UI to be redesigned mid-sprint:

```
a2e7cb1  fix(ble): force applyDeviceConfig on take-reading connect so the watch has user params
3224697  feat(settings): per-field profile editor with cm/ft + kg/lbs toggles + keyboard avoidance
2bb2f98  fix(settings): show row values + clear placeholders + Android keyboard avoidance
```

### What shipped

- `applyDeviceConfig(device, { force: true })` is now called inside `useTakeReading.begin()` between `connectToUrion` and `syncBacklog`. Failures are non-fatal — the take-reading flow continues even if the config flush errors.
- A full per-field profile editor in Settings:
  - Year of birth, Gender, Height (cm ↔ ft+in toggle), Weight (kg ↔ lbs toggle), Timezone — each row tappable, each opening its own focused BottomSheet with only the relevant input.
  - Each save patches a single field via `updateProfile`. No "fill all four together."
  - Keyboard avoidance fixed at the shared `BottomSheet` component level so it applies everywhere in the app.
  - Row values render on the Settings face — users see "Not set" vs the actual value without tapping in.
  - Placeholder text uses `text.tertiary` (distinctly lighter) so empty fields don't look filled.
- `useLastSyncDisplay` no longer shows "NaN d ago" — fixed by routing through `getLastSyncSec` + `watchTimestampToUtcSec` instead of multiplying the (now-object) cursor by 1000.
- The Photo row was removed pending an image-picker integration (separate scope).

### Acceptance vs the card

| Card item | State |
|---|---|
| `applyDeviceConfig` called once per take-reading session with `force: true` | ✅ Unit-tested |
| A `setUserParams` failure does NOT abort the take-reading flow | ✅ Unit-tested |
| Reading appears in the app's home center ring within the 90s poll window after a fresh BP measurement | 🟡 **NOT VERIFIED ON-DEVICE** — see deferrals below |
| No regression on the cursor-stable steady state from 12.5.1 | ✅ Verified (530 tests across BLE + sync + state + Settings all pass) |

### Deferred to "BLE sync hardening" backlog (carry-over to final holistic pass)

The user-facing flow STILL has gaps that this sprint could not close in-session. Captured in detail at `memory/ble_sync_open_issues.md`. Summary:

| Item | Symptom | Why deferred |
|---|---|---|
| Force Sync button doesn't actually sync new data | User tapped Force Sync after fresh measurement; trace showed sync ran but data didn't surface on Home. | Likely related to the cursor model — Sprint 12.5.1 fixed the walk-backward loop but the "I just took a reading, pull it now" path is still flaky. Needs another tracing session. |
| Most-recent reading from the watch still doesn't always reach Home | The Sprint 12.5.1 mid-measurement reconnect window catches *some* completions but not all. | The watch may not be storing every BP measurement to its history register (see `memory/sprint_12_5_1_close_out.md` deferral on watch-side BP persistence — same root cause). |
| On-device verification of `applyDeviceConfig(force: true)` actually fixing the persistence | Couldn't get to a clean BP cycle in this session to confirm. | Founder time + multiple cycles required. |

Per founder request 2026-05-12: hold these for the final **holistic test pass** at the end of the sprint sequence. Don't burn a sprint on them now — Sprint 15 is the higher-priority work.

### Files touched (final state)

- `apps/mobile/src/state/takeReading.ts` — added `applyDeviceConfig({ force: true })` call.
- `apps/mobile/src/screens/Settings/SettingsScreen.tsx` — per-field profile editor (replaces the old read-only Profile section + DemographicsSheet).
- `apps/mobile/src/components/BottomSheet.tsx` — Android keyboard avoidance fix.
- `apps/mobile/src/components/ListRow.tsx` — `select` variant now renders `value`.
- `apps/mobile/src/screens/Settings/__tests__/SettingsScreen.test.tsx` — 10 new tests for the per-field editor.
- `apps/mobile/src/state/__tests__/takeReading.test.ts` — 3 new tests for `applyDeviceConfig` wire-up.

### Test counts (cumulative)

530 tests pass across BLE + sync + state + Settings + components.
