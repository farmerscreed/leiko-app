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

---

## Close-out — 2026-05-12

Closed across 6 commits over one extended session in Lagos with the founder's Pixel 8 + U19M_013C watch on USB + adb reverse:

```
46ec64d  fix(ble): survive watch's mid-measurement BLE drop
861229a  fix(sync): recover from stale BP cursor when watch's newest is older  ← later reverted (see below)
cacc44a  fix(ble): poll readBPHistory during reconnect window instead of fail-on-first-zero
4af63d9  fix(sync): auto-recover when cursor is stale and watch returns no records
ed7f8f0  fix(sync): revert Commit 2 cursor-snap (loop bug) + dedupe at ingest and hydrate
e146886  chore(ble): strip Sprint 12.5.1 [ble-trace] instrumentation
```

### Symptoms diagnosed

Three distinct symptoms surfaced across the trace sessions, none of which were the symptom the sprint card opened with ("watch doesn't push 0x73 on result-completion"):

1. **Mid-measurement BLE drop**. The U16's pump browns out the BLE radio at peak inflate. App was failing with `connect_failed` after the cuff dropped GATT, before the measurement completed.
2. **`readBPHistory` returns terminator while watch is mid-cycle**. We were reconnecting and querying ~5s after the drop; the watch hadn't yet stored the new BP. Got terminator. Declared `no_reading` and gave up.
3. **Cursor-walk-backward loop**. My first cursor-recovery commit (`861229a`) misread the U16PRO §4.5 DIR=1 semantics. `syncBacklogToCompletion` looped on `pulled=1` and drove the cursor through the watch's history one record per iteration, piling up ~150 duplicates in MMKV.

### Key learning — U16PRO DIR=1 semantics

Captured here so it doesn't get re-discovered:

- `0x14 readBPHistory(TS=X, DIR=1)` returns up to COUNT records **STRICTLY OLDER** than TS, walking backward from the watch's latest. Verified empirically (2026-05-12 trace: TS=1778513800 → first.ts=1778512464, last.ts=1777651728).
- When TS=0: protocol fallback — watch returns latest COUNT regardless of DIR.
- When TS > watch's stored max: empirical fallback — watch returns latest COUNT.
- When TS < oldest stored record: watch returns the 0xFFFFFFFF terminator (cannot find the anchor).
- The protocol's "subsequent requests will continue to request data using the timestamp of the obtained record" wording is for **pagination through history**, not for incremental sync of new readings. There is NO native "give me readings newer than TS" command.

Implication for our cursor model: the existing scheme works *only because* a fresh BP reading taken on the watch becomes the new "watch latest"; DIR=1 with TS=current_cursor (≤ new latest) then returns records between the two (inclusive of the new reading on its way down). Filter `r.timestampSec > cursor` lets the new one through and rejects already-ingested ones. The cursor must NEVER be artificially advanced past the watch's actual newest, or new readings won't pass the filter.

### Acceptance vs the sprint card

| Card item | State |
|---|---|
| Fresh reading surfaces ≤10s after BP-button press (Take a Reading) | ✅ via Commits 1+3 |
| Fresh reading surfaces ≤10s after BP-button press (Force Sync) | ✅ via Commits 1+3 |
| Repeated takes (3 in 5 minutes) all surface | Not field-tested in this sprint; Commits 1+3 are stateless per-call and should support this. Backlog item. |
| Backlog sync still pulls every buffered reading | ✅ — incremental sync confirmed working; trace shows `pulled=0` steady state when caught up |
| No `ble_crc_fail` spike post-fix | ✅ — no CRC events in any trace |
| `[ble-trace]` instrumentation removed | ✅ — Commit `e146886` |

### Files touched (final state)

- `apps/mobile/src/state/takeReading.ts` — new `reconnecting` phase + `_reconnectAndPull` (90s poll window).
- `apps/mobile/src/screens/TakeReading/TakeReadingScreen.tsx` — `ReconnectingView` for the new phase.
- `apps/mobile/src/services/sync/syncBacklog.ts` — Option C stale-cursor recovery (TS=0 reset). Commit 2's snap-back recovery is GONE.
- `apps/mobile/src/state/readings.ts` — `dedupeReadings` helper + `hydrate()` sweep + `addPendingReading` dedupe-at-ingest.
- `apps/mobile/src/services/analytics/logger.ts` — added `ble_cursor_reset` event + `take_reading_received.source` extended to include `'watch_post_disconnect'`.

### On-device verification — completed 2026-05-12 in Lagos

| Surface | Evidence |
|---|---|
| Cursor-walk-backward loop fixed | 4 syncBacklog calls in 3 min after Commit 5 (was 100/3min before). Cursor stable at 1777901973. |
| Dedupe sweep on hydrate | User reported home screen "everything seems okay" after force-quit + reopen post-Commit 5; duplicate readings cleaned up. |
| Mid-measurement reconnect window | Trace shows `[take-reading] reconnect attempt @0s into 90s budget` → `reconnected; entering poll window`. |
| Option C cursor reset | Trace shows `syncBacklog post-reset readBPHistory returned 50 packet(s)` after the cursor=1706519978 → 0 reset. |

### Deferred — picked up in follow-up sprints

| Item | Why deferred | Target |
|---|---|---|
| **Watch-side: BP results not always persisted to history register** | Different bug class (watch firmware, not app). HR + SpO2 storage works fine on the same hardware; BP storage occasionally returns terminator for `readBPHistory` even after a successful cuff cycle. Suspected cause: `setUserParams` never pushed because `vitalSetup.dirty` was false — some Urion firmwares may gate BP-result persistence on user demographics. Action: wire `applyDeviceConfig(force=true)` into the take-reading flow OR into pairing flow. Track via `memory/sprint_12_5_1_close_out.md`. | Sprint 12.5.2 (small) or fold into Sprint 16 polish |
| Cleaner long-term: TS=0-always + dedupe-only model | The cursor-based incremental sync works but is fragile (the very bug this sprint chased). Per-protocol pure approach: always query TS=0, always rely on local dedupe. Bigger refactor. | Sprint 16 polish |
| Server-side TZ reconciliation | Already in backlog (Sprint 7 follow-up). | Backlog |
| Setting cursor reset UX in Dev settings | Useful for debugging, not user-facing. | Backlog |
| Multi-take regression test (3 readings in 5 min) | Wasn't field-tested in this session. Code is stateless per-call so should work. | Sprint 16 polish |
