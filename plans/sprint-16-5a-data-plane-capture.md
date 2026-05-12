# Sprint 16.5a — Data Plane Foundation, Phase A (Forensic Capture)

## Context
First card of a 5-phase data-plane reliability rebuild that slots between Sprint 16 (offline + error states) and Sprint 17 (launch). The "holistic test pass" the founder flagged in `memory/ble_sync_open_issues.md` — expanded from BP-only to full-vital surface (BP + HR + SpO2 + sleep + activity) per the multi-vital scope confirmation. Subsequent phases:

- **16.5b** — Truth encoding. Convert captured byte streams into `tools/ble-mock` fixtures + scenario tests.
- **16.5c** — Architectural rebuild. Config-reconciliation, pairing-time bundle, background continuity strategy, intra-day richness wire-up.
- **16.5d** — On-device validation. Per-vital acceptance matrix over ~1.5 weeks.
- **16.5e** — Production data-quality surface (Settings → Diagnostics + PostHog telemetry).

This card is **Phase A only**. Pure forensic observation; no production fixes ship.

## Goal
Produce a byte-level evidence base of what the Urion U19M_013C firmware actually does, across every vital, under every trigger condition (foreground, background, cold-quit, varying profile state). The captured traces become the source of truth for all subsequent phases — no architectural choice in 16.5c is made without trace evidence to back it.

## Duration
One desk session to land instrumentation + a tiny dev-only capture-status surface, then **one ~3-hour bench session** to run the matrix, then one short desk session for first-pass interpretation. ~2 calendar days end-to-end.

## Hard dependencies
- Physical Urion U16/U19 watch, fully charged at session start.
- Android dev phone (founder's Pixel 8). Per `memory/running_on_phone.md` — USB + `adb reverse` is the reliable path; LAN is fragile in the Lagos test environment.
- Watch unpaired from any other phone (the Urion stock app on the founder's phone must be force-stopped — per `memory/ble_saga_master_log.md` Trace #1 confirmations).
- ~3 hours of founder bench time. The capture matrix mixes worn / active / idle / asleep states; some scenarios require real elapsed time.

## Docs to load
- `docs/06-ble-protocol.md` (full).
- `docs/_reference/U16PRO_protocol_en.pdf` §4.1 setTime, §4.4 setUserParams, §4.5 readBPHistory + §4.5.5 timezone, §4.6 readHRHistory, §4.7 readSpO2History (if numbered there — verify), §4.3 readDayInfo, §4.13 0x73 notifications.
- `memory/ble_saga_master_log.md` (the canonical end-to-end).
- `memory/urion_dir1_protocol_semantics.md` (the DIR=1 trap).
- `memory/watch_timestamp_quirk.md` (the UTC+8 shift — load-bearing for cursor interpretation in traces).
- `memory/running_on_phone.md` (USB + adb reverse cookbook).

## Premise — what we already know vs what we don't

### Already known (from Sprint 12.5.1/12.5.2 close-outs + 2026-05-11/12 traces)
- BLE drops mid-cuff during inflation are firmware-deliberate; reconnect window in `takeReading._reconnectAndPull` handles it.
- DIR=1 returns records strictly older than TS-anchor, walking backward from latest. Do not invent recovery branches that snap cursor backward.
- The watch returns 0xFFFFFFFF terminator when cursor < oldest-stored OR when the queryable BP register is empty.
- Across all 2026-05-11/12 traces, the watch emitted `0x73 0x0c` (battery) only — never `0x73 0x02` (BP-ready). HR + SpO2 + activity flowed in the same session BP was empty, so the persistence gap is BP-specific.
- Cursor is per-device per-vital (`VitalSyncCursor { bp, hr, spo2, sleep, activity }`); BP and HR are timestamp-second cursors, day-vitals are 'YYYY-MM-DD' strings.

### Unknown — to be answered by this sprint's traces
1. Does `applyDeviceConfig(force:true)` actually fix BP persistence on this firmware? (Sprint 12.5.2's central claim, never verified on-device.)
2. Does the watch ever emit a `0x73` byte we don't currently map (`0x05`, `0x06`, `0x08`, `0x0A`, `0x0B`)? Our current `KIND_BY_BYTE` may be missing a BP-complete signal.
3. What is the actual HR sample cadence with Auto-HR on? (Code assumes 30 min — `HR_DEFAULT_WINDOW_SEC` in `apps/mobile/src/services/sync/syncMultiVitals.ts:95`.)
4. With Auto-SpO2 toggled on, what cadence does the watch emit `0x2D` packets at? Does it sample overnight?
5. Does `readDayInfo` (0x07) expose richer sleep fields than we currently parse — REM, awake periods, stage transitions? (Sprint 7.5 synthesized boundaries — verify against actual reply.)
6. Does the watch emit `0x73 0x04` notifications during high-activity periods? If yes, intra-day step distribution can be wired in 16.5c. If no, day-totals are the protocol ceiling.
7. What does the `0x07` sports-records reply contain when a walk session completes? Currently observed but not ingested.
8. **Background path**: when the app is force-quit and a BP reading is taken on the watch alone, does the watch later transfer the reading on the next BLE handshake? Or does it require the BP register to have been recently written to (which would imply demographics-on-watch is a persistence prerequisite, not just a sync prerequisite)?
9. **10-day eviction**: are old readings ever evicted from the watch's queryable register, or does it ring-buffer at exactly 10 days as the protocol claims?

## Plan

### Step 1 — Instrumentation pass (one desk session, no production behaviour change)

Land `BLE_TRACE` instrumentation at the following sites. All gated behind `const BLE_TRACE = __DEV__` at the top of each file. Output goes to `console.log` with a `[ble-trace]` prefix so the founder can `adb logcat | grep ble-trace`.

1. **`apps/mobile/src/services/ble/UrionDevice.ts`** — inside `startNotify`'s monitor callback: log every packet's `cmd` byte + first 4 payload bytes + listener count.
2. **`apps/mobile/src/services/ble/UrionDevice.ts`** — CRC fail handler: log to console alongside the existing `ble_crc_fail` analytics event.
3. **`apps/mobile/src/services/ble/notify.ts`** — inside `subscribeToNotifications`: log every `0x73` packet's raw KIND byte + classified kind (NEVER suppress the unknown branch — that's how we miss un-mapped BP-complete bytes).
4. **`apps/mobile/src/services/sync/syncBacklog.ts`** — three sites: enter (cursor value), post-readBPHistory (count + first/last timestampSec), exit (pulled + new cursor + did we trip the Option C reset).
5. **`apps/mobile/src/services/sync/applyDeviceConfig.ts`** — log every step that runs AND every step that skips, including `setUserParams` skipped-because-hasDemographics-false (today this fails silently).
6. **`apps/mobile/src/services/sync/syncMultiVitals.ts`** — at each per-vital step: log "starting `<vital>` step for days `<list>`" and "completed `<vital>` step pulled=`<n>`".
7. **`apps/mobile/src/services/ble/commands/readHRHistory.ts`** + **`readSpO2History.ts`** + **`readDayInfo.ts`** — log raw packet count + first/last sample for each call.
8. **`apps/mobile/src/state/takeReading.ts`** — keep the existing `[take-reading]` logs (already in place).

Also extend `apps/mobile/src/dev/VitalsDebugPanel.tsx` with a "Capture Status" section showing — paired bleId, profile completeness (yob / gender / height / weight all set?), per-vital cursor with humanised "Nd ago", `vitalSetup.dirty`, last-known battery, count of `0x73 <byte>` seen per byte over this session. Read-only; no buttons. Helps the founder confirm context per scenario without parsing logcat live.

**No commits in this step.** All instrumentation is workspace-local until after the bench session.

### Step 2 — Bench session (one ~3-hour window)

Pre-flight checklist:
- Watch at >80% battery.
- Phone tethered USB, `adb devices` shows the Pixel.
- `adb logcat -c` to clear buffer.
- `adb reverse tcp:8081 tcp:8081` for the metro bundler.
- App built with `BLE_TRACE = true`.
- Capture mode on: `adb logcat -v time | grep --line-buffered -E '\[ble-trace\]|\[take-reading\]|\[sync-backlog\]|\[sync-mv\]|applyDeviceConfig|device_config|ble_cursor_reset|ble_crc_fail' > capture-2026-05-13_<scenario>.log` — one file per scenario.
- Urion stock app force-stopped (a paired stock app silently steals notifications).

Capture matrix — run in order, save each as a separate logfile:

| # | Scenario | Bench time | Trace tag |
|---|---|---|---|
| 1 | Profile **incomplete** (only yob filled). Take a BP reading via in-app take-reading flow. Observe whether `applyDeviceConfig` step-list includes `userParams`. | 5 min | `bp-profile-incomplete` |
| 2 | Profile **complete** (all 4 demographics). Force-quit app. Re-open. Take a BP reading via in-app take-reading flow. Observe full cycle. | 8 min | `bp-take-reading-cold-app` |
| 3 | With app still open, take a 2nd BP reading within 5 min of #2. Verify both reach Home. | 5 min | `bp-take-reading-back-to-back` |
| 4 | Force-quit app. Take a BP reading on the watch alone (no app interaction). Wait 2 min. Re-open the app. Observe whether the cold-start sync surfaces the reading. | 8 min | `bp-watch-alone-cold-quit` |
| 5 | App backgrounded (home button, NOT force-quit). Take a BP reading on the watch. Wait 5 min. Foreground the app. | 10 min | `bp-watch-alone-bg-foreground` |
| 6 | With Auto-HR ON (default) and watch worn, leave for 1 hour idle on desk, then 30 min walk, then 30 min idle. App foregrounded throughout. Capture all `0x15` reads + `0x73` notifications. | 2 hours (overlaps with later scenarios) | `hr-passive-2h` |
| 7 | Toggle Auto-SpO2 ON in Settings → Vital Streams. Wait 1 hour with watch worn. Foreground app; trigger sync. Examine `0x2D` reply. | 1 hour (overlaps) | `spo2-toggle-on-1h` |
| 8 | At a calm moment, manually trigger `readDayInfo` for yesterday via the dev panel (or just force-sync after midnight). Save the raw reply packets — we want every byte, not just what `readDayInfo.ts` currently parses. | 5 min | `dayinfo-yesterday-raw` |
| 9 | Walk vigorously for 5 min carrying the phone with `adb logcat` running. Capture every `0x73` notification. Look specifically for `0x73 0x04` (the hypothetical hourly-step byte). | 10 min | `notify-during-walk` |
| 10 | Idle period: leave phone+watch worn but stationary for 15 min while watching `adb logcat`. Catalog every `0x73 <byte>` observed and at what cadence. Confirms whether we're missing notify bytes outside the active-test windows. | 15 min | `notify-idle-15min` |
| 11 | Drain or simulate <20% battery and capture the `0x73 0x0c` cadence + the battery byte itself. (Skip if can't drain in-session — non-blocking; we have prior trace evidence.) | optional | `battery-low` |
| 12 | Unpair the watch (Settings → Forget Device). Re-pair from scratch. Observe everything sent on the pairing reconnect: setTime only? setUserParams? Anything else? | 10 min | `pair-handshake-raw` |
| 13 | After scenario 12, take a BP reading on the watch (no in-app take-reading flow). Foreground app. Does the reading surface? | 8 min | `bp-fresh-pair-watch-alone` |

Scenarios 6 + 7 + 10 run in the background of the active-test scenarios — start them early, let them accumulate while you're running the others.

**Take a real sleep session.** That night (or the night after), wear the watch overnight, then capture next morning:
| 14 | Sync after a full night of wear. Capture readDayInfo reply for that day. Compare totalMinutes to perceived sleep. Examine raw packet for any byte regions we're not parsing. | morning after | `sleep-overnight` |

### Step 3 — First-pass interpretation (one short desk session, no code)

For each scenario, write findings to `plans/captures/2026-05-13-capture-notes.md` — one section per scenario. Each section answers:
- What was the trace's headline byte-flow shape?
- Did the expected `0x73 <byte>` appear?
- Did `readBPHistory` return data or terminator? What was the cursor at?
- Did `applyDeviceConfig` step-list include every step? Any silent skips?
- Did the sample timing match the assumed cadence (HR @ 30min, SpO2 @ 60min)?

Mark each hypothesis (1-9 in "Unknown" above) as **Confirmed / Rejected / Inconclusive**, with trace-line citations.

This document is the artifact Phase B (16.5b) consumes.

### Step 4 — Strip instrumentation, commit pattern preserved

Per `memory/ble_saga_master_log.md` hard rule #6: `BLE_TRACE = true` does NOT ship. Strip the trace sites in a separate commit. Preserve the patterns inline in a comment block at the top of `apps/mobile/src/dev/BLE_TRACE_HOWTO.md` (new file) so future re-introduction is a paste-job. Capture-Status section of `VitalsDebugPanel` stays (it's already dev-only).

Captured logfiles get committed to `tools/ble-mock/captured-traces/2026-05-13/` so they're under version control. They're plain text, small, and become the source of truth for 16.5b.

## Acceptance criteria

- All 13+1 capture scenarios attempted. Each produces a non-empty logfile or a noted reason ("scenario 11 skipped — couldn't drain battery in session window").
- A `plans/captures/2026-05-13-capture-notes.md` exists with one findings block per scenario.
- Every hypothesis (1-9 in "Unknown") is marked Confirmed / Rejected / Inconclusive with trace citations. Inconclusive is acceptable for some — Phase B can re-capture targeted edges.
- The `BLE_TRACE_HOWTO.md` reference doc is created; all `BLE_TRACE` constants set back to `false` before commit.
- Captured logfiles committed under `tools/ble-mock/captured-traces/2026-05-13/`.
- A short Sprint 16.5b card is drafted with concrete Phase B work that the findings reveal as necessary. (If findings reveal Phase B can be skipped entirely — e.g. all hypotheses confirmed cleanly — note that here.)

## Risk notes

- **`BLE_TRACE` left on by accident in a shipped build** is the highest-frequency footgun per Sprint 12.5.1 close-out. Use `__DEV__` not `true`; verify in the strip commit that `grep -r "BLE_TRACE = true" apps/mobile/src` returns no results before pushing.
- **A bench session that runs short** will leave scenarios un-captured. If <2.5h is available, prioritise scenarios 2, 4, 5, 9, 10, 12, 13 in that order — these are the highest-signal for the architectural rebuild in 16.5c. Skip 6-7 if necessary; the 30-min HR cadence assumption is a quality-of-data question, not a "does the app work" question.
- **Profile state contamination across scenarios.** Some scenarios require the profile to be in a specific state (complete vs incomplete). Use the dev `account_type` bypass pattern from `memory/dev_account_type_bypass.md` if needed, but DON'T modify profile mid-scenario — finish the trace first.
- **Watch firmware doesn't drop BLE during cuff every time.** Per the 12.5.1 saga, drops happen "5-30 seconds into inflate." If a cycle completes without a BLE drop, the take-reading flow's `_reconnectAndPull` doesn't fire — that's fine, but note it. The capture should reveal whether non-drop cycles surface the reading via the original onBP handler (probably never, per H1).

## What this sprint explicitly does NOT ship

- Any production fix. No changes to `syncOrchestrator`, `syncBacklog`, `applyDeviceConfig`, `takeReading`, pairing, or background-sync wiring.
- Voice-rule passes on any new string. The only new strings are dev-panel labels (no user-visible production strings touched).
- The `MockWatchFirmware` simulator. That's Phase 16.5b.
- The architectural rebuild — pairing-time config bundle, dirty-flag removal, foreground service, etc. All Phase 16.5c.

## Voice rule check
This sprint touches one user-visible surface: the extended `VitalsDebugPanel` Capture Status section. That panel is dev-only (`apps/mobile/src/dev/`) and never appears in production builds. Voice rules apply nonetheless for habit — no "patient", "diagnose", no fear language, even in dev tooling.

---

## Close-out (filled after the bench session)

_To be completed after Step 4. Move card to `plans/done/` once filled._
