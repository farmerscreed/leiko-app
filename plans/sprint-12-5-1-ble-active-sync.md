# Sprint 12.5.1 — BLE active-sync fix

## Goal
Fresh BP readings taken on the watch surface in the app within ≤10s of pressing the BP button — on both the Take-a-Reading flow and the Force Sync flow. Deferred from Sprint 12.5 close-out as a dedicated hotfix (post-12.5, pre-Sprint 8).

## Duration
1–2 sessions. Most of the cost is on-device tracing; the fix itself is small once the trace points the way.

## Hard dependencies
None. Watch + paired phone (the founder's Lagos dev kit) — already in place.

## Docs to load
`docs/06-ble-protocol.md` (full, especially §1 GATT profile + §5 failure-mode table + §1.1 TZ quirk), `docs/_reference/U16PRO_protocol_en.pdf` §4.5 (BP history) + §4.13 (0x73 watch-pushed notifications).

## Symptom
- User opens **Take a Reading**, presses the BP button on the watch, watch inflates + completes a measurement, app sits on `waiting_for_watch` until the 90s timeout fires. No new reading lands in the readings store.
- User presses **Force Sync** after a fresh on-watch reading, sync runs to "live" status, idle-window closes 45s later, still no new reading.
- Backlog sync (cursor-based, on cold start / foreground / BT_READY) was reported to pull old readings correctly in earlier sprints. Bug is specific to **the freshly-taken reading inside the live window**.

## Hypotheses (one of these is the bug)

| # | Hypothesis | Trace signal |
|---|---|---|
| H1 | Watch firmware never emits 0x73 0x02 on result-completion (only on certain triggers, or never) | Notify callback never fires for `cmd === 0x73` after the BP-button press |
| H2 | 0x73 arrives with a non-0x02 KIND byte (firmware variant or stale `KIND_BY_BYTE` mapping in `apps/mobile/src/services/ble/notify.ts:60-69`) | Notify callback fires with `cmd === 0x73` but classification routes to `onUnknown` |
| H3 | 0x73 arrives + `_onBPReady` runs, but `syncBacklog` returns `pulled: 0` — boundary/cursor bug at `apps/mobile/src/services/sync/syncBacklog.ts:205-237` | `[take-reading] backlog sync pulled 0 reading(s)` immediately after the BP-ready log |
| H4 | CRC failures silently drop 0x73 frames at `apps/mobile/src/services/ble/UrionDevice.ts:62-65` | `ble_crc_fail` console log spikes around the BP-button press |

## Plan

1. **Instrumentation pass — no behaviour change.** Temporary verbose logs (prefix `[ble-trace]`) at four sites: `UrionDevice.startNotify` (every packet's cmd + first 4 payload bytes), `subscribeToNotifications` (classified kind + raw byte), `syncBacklog` (entry cursor + pulled count + newest-seen), CRC failure (promote to `console.log` alongside existing PostHog event). All gated behind a const at the top of each file for one-pass cleanup.
2. **On-device trace, single guided pass.** Sideload, run `scripts/dev-phone-reconnect.ps1`, open Take-a-Reading, press the BP button, capture logcat. Repeat for Force Sync. Identify which hypothesis matches.
3. **Branch on the trace.** Pick the fix shape:
   - **H1 → polling fallback.** Add a `pollBacklog` loop (5s cadence) inside the wait windows of both flows. Gate to foreground / `manual_force` only so background-fetch doesn't spin the GATT link. Consistent with Sprint 6's "U16PRO has no remote-trigger" reality.
   - **H2 → update `KIND_BY_BYTE`** in `notify.ts`. Add an empirical-confirmation comment recording the new mapping + firmware variant.
   - **H3 → cursor fix.** Likely `sinceTimestampSec = lastSync - 1` to include the boundary, plus an audit of `setLastSyncSec` advancement. Add unit test covering the boundary case.
   - **H4 → packet parser fix** in `io.ts` (length, CRC algorithm, or payload-shape mismatch).
4. **Tests.** Unit test for whichever branch turned out true; integration test that takes a synthesised 0x73 → 0x14 sequence end-to-end through the BLE mock.
5. **On-device verification.** Take-a-Reading + Force Sync surface a fresh reading within ≤10s.
6. **Remove the instrumentation.** Strip the four `[ble-trace]` logs; commit the cleanup separately.
7. **Close-out.** Update `memory/sprint_12_5_close_out.md` (move BLE row Deferred → Resolved); move this card to `plans/done/`.

## Acceptance criteria
- Press BP button on watch with Take-a-Reading open → reading appears in the success view within 10s. Pulled count ≥ 1 in the log.
- Press BP button on watch, then tap Force Sync → reading appears on Home within 10s of the sync completing.
- Repeated takes (3 in 5 minutes) all surface; no off-by-one cursor regression.
- Backlog sync (cold start with N buffered readings on the watch, app closed for >1 day) still pulls every buffered reading. Regression-tested.
- No `ble_crc_fail` spike post-fix.
- The four `[ble-trace]` instrumentation logs are removed before the sprint card moves to `done/`.

## Verification matrix (on-device, Lagos)
| Scenario | Expected |
|---|---|
| BP button pressed during Take-a-Reading | Reading in success view ≤10s |
| BP button pressed, app backgrounded, foreground 30s later (triggers `app_foreground` sync) | Reading on Home ≤10s of foreground |
| BP button pressed twice in 60s during Force Sync live window | Both readings appear |
| Cold start with 5 buffered readings | All 5 pull in via `syncBacklogToCompletion` |
| Watch out of range → in range → BP button | Reading lands on the reconnect-triggered sync |

## Risk notes
- If H1 wins and we ship a polling fallback, the 45s `syncOrchestrator` live window becomes 9 BLE round-trips per Force Sync. Gate polling so it doesn't run for `background` trigger — battery cost on the watch is non-trivial.
- Don't regress the cursor: any change to `getLastSyncSec`/`setLastSyncSec`/`sinceTimestampSec` semantics needs the existing `syncBacklog` and `syncBacklogToCompletion` tests green AND the boundary unit test added in step 4.
- The TZ quirk (`watchTimestampToUtcSec`, `WATCH_FIRMWARE_OFFSET_SEC = 8h`) is orthogonal — do not touch it during this fix. Cursor stores raw watch seconds by design.

## What this sprint explicitly does NOT ship
- Server-side TZ reconciliation (still Sprint 7 follow-up, in backlog).
- `setUserParams` / `setGoals` writer stubs (Sprint 7.5 follow-up; depends on a working sync, which this sprint delivers).
- The Sprint 16 light-mode polish, expo-notifications scheduling, or any Tier-B / Tier-C work.
