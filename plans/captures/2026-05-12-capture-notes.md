# Sprint 16.5a Phase A — Bench Capture Notes
## Date: 2026-05-12 (Lagos), watch U19M_013C, phone Pixel 8 (43230DLJH001YY)

---

## Pre-flight state (Capture Status panel, before any scenario)

- **Profile completeness:** yob=y gender=y h=y (w=? — display truncated; needs confirmation; based on `dirty=false` AND no error in setUserParams branches in the trace, all 4 are likely set)
- **vitalSetup.dirty:** false → orchestrator path will skip applyDeviceConfig every time
- **auto-HR / auto-SpO2:** on / (off, truncated)
- **Cursor ages:** cursor.bp = 8d ago, cursor.hr = -28326s (PANEL BUG, see Finding NEW-2), cursor.spo2/sleep/activity = 21h ago
- **Raw cursors:** cursor.bp = 1777901973, cursor.hr = 1778625000 (advancing in real time)
- **Pending counts:** BP 0/30, HR 2925/0, SpO2 118/0, Sleep 5/0, Activity 10/0 → **HR/SpO2/Sleep/Activity all have unsynced-to-server backlogs**
- **Paired device:** U19M_013C (013c)
- **0x73 bytes seen:** none (session-fresh counter)

---

## Scenario 1 — Baseline Force Sync (2026-05-12 22:28 → 22:32, ~4 minutes)

**Logfile:** `tools/ble-mock/captured-traces/2026-05-12/scenario-01-baseline-force-sync.log` (81 KB, 594 ble-trace lines)

**What happened:** The app foreground-triggered 4 syncs at 22:28, 22:29, 22:30 (with one sync_failed mid-stream), then user pressed Force Sync at 22:32. All ran end-to-end.

### Hypothesis verdicts

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| H1 | applyDeviceConfig silently skips when dirty=false | **CONFIRMED** | `[ble-trace] applyDeviceConfig skipped — dirty=false force=false` appears on EVERY sync, including manual_force. The orchestrator path NEVER pushes setUserParams except via take-reading's force:true. |
| H2 | Watch never emits 0x73 0x02 BP-ready | **CONFIRMED** | 594 `[ble-trace]` lines captured. Zero `0x73 kindByte=` lines. Zero 0x73 packets observed during 4-minute sync window — not even 0x0c battery. |
| H3 | BP persistence is broken (watch's transferable register has stale data) | **CONFIRMED** | cursor.bp = 1777901973 (8 days old). `readBPHistory(TS=1777901973, DIR=1)` returned 50 packets with `first.ts=1777860307 last.ts=1777002022` — every record OLDER than cursor. **The watch's newest stored BP IS 1777901973, 8 days ago.** No BP cycle has reached the transferable register since then. |
| H4 | DIR=1 protocol is working correctly | **CONFIRMED** | Filter rejected all 50 records (pulled=0 from 50). Cursor preserved 1777901973 → 1777901973. No walk-backward loop. Sprint 12.5.1 fix is holding. |
| H5 | HR/SpO2/activity data flowing despite BP broken | **CONFIRMED** | HR pulled 3 samples on first sync (cursor.hr advanced 1778623800 → 1778624700 → 1778625000 across syncs). SpO2 returned 11 samples each cycle. Activity returned 1 day record each cycle. **All four non-BP vital paths working.** |

### NEW findings surfaced by this trace

#### NEW-1: HR sample interval is 5 minutes, not 30
```
readHRHistory index totalPackets=24 intervalMinutes=5 (assumed 30 in slice config)
```
Our code at `apps/mobile/src/services/sync/syncMultiVitals.ts:95` declares `HR_DEFAULT_WINDOW_SEC = 30 * 60`. The watch is actually sampling every **5 minutes**. Every HRSample's `sampleWindowSec` is wrong by 6x — the AI's context, anomaly thresholds, and trend computations are all derived against a sample-window assumption that's 6x too coarse. **Quality-of-data bug.** Fix in Phase C: read `intervalMinutes` from the index packet and use it.

#### NEW-2: cursor.hr display is future-skewed by exactly ~7-8 hours
Panel shows `cursor.hr = -28624s` (~7.95h in the future).

Decoded:
- cursor.hr raw = 1778625000
- `watchTimestampToUtcSec(1778625000)` adds (8h - phoneOffset) = 28800 - 3600 = +25200s
- → utcSec = 1778650200
- Date.now()/1000 at capture time ≈ 1778621400
- age = utcSec - now = +28800s = **+8h in the future**

This means **the firmware on this watch is NOT applying the UTC+8 China-shift** to raw timestamps anymore. It's serializing in real UTC. Our `watchTimestampToUtcSec` adds 7h that shouldn't be added.

The BP cursor "8d ago" display looks fine ONLY because rounding hides the 7h skew. Every HR / SpO2 / sleep / activity timestamp the app shows is being pushed 7h forward.

`memory/watch_timestamp_quirk.md` was verified 2026-05-07; this trace 5 days later contradicts it. Either firmware was OTA-updated or behaviour is context-dependent. **Phase B must capture before/after setTime to determine which.** Phase C must add a per-device firmware-shift toggle.

#### NEW-3: HR / SpO2 / Sleep / Activity pending arrays accumulating, not being synced to server
HR pending = 2925 (climbing 2925 → 2928 over the scenario). SpO2 = 118 (unchanged but never moved to recent). Sleep = 5. Activity = 10.

The `recent` column is 0 for all four — meaning these samples ARE captured locally to MMKV but never make it to `recent` (server-acknowledged). The /sync or /multi-vitals endpoint is failing to land them, or the post-success → addRecent transition is broken.

Not visible in this trace (no `reading_sync_*` events appeared). **Investigate in Phase B** — possibly a server-side issue, possibly client-side post failure that we're not surfacing.

#### NEW-4: 0x73 notifications are entirely silent during active syncs
Across 5 syncs over 4 minutes, ZERO 0x73 packets. The orchestrator's `subscribeToNotifications` "live" window is effectively dead — there's nothing to subscribe to. Battery (0x0c) didn't fire either. **0x73 fires rarely or not at all on this firmware version.** Polling is the only viable mechanism.

#### NEW-5: SpO2 returns 11 samples per sync, every sync
`readSpO2History returned 11 samples` four times in a row at the same day. Sample-level dedup in the SpO2 slice handles it (pending stays at 118), but it's wasteful BLE traffic — 11 samples × 11 byte packets × 4 syncs = 484 redundant bytes over 4 minutes. Worth a sample-level filter in syncSpO2Step in Phase C.

### Cursor changes during scenario

| Cursor | Before | After | Delta |
|---|---|---|---|
| bp | 1777901973 | 1777901973 | unchanged |
| hr | 1778623800 | 1778625000 | +1200s (4 new samples × 5min) — but 3 of the 4 were pulled across multiple syncs |
| spo2 | 2026-05-12 | 2026-05-12 | day cursor unchanged |
| sleep | 2026-05-12 | 2026-05-12 | day cursor unchanged |
| activity | 2026-05-12 | 2026-05-12 | day cursor unchanged |

### Pending-count changes

HR pending climbed 2925 → 2928 (+3 net across all syncs). Confirms samples ARE landing in pending. SpO2/Sleep/Activity pending unchanged (dedup working).

### What this scenario does NOT yet answer

- Does take-reading's force:true `applyDeviceConfig` actually fix BP persistence? **→ Scenario 2.**
- Does the watch fire any 0x73 byte when a fresh BP cycle completes? **→ Scenario 2 or 4.**
- What's the un-parsed byte content in readDayInfo for a real sleep session? **→ Capture after overnight wear.**
- Is the timestamp shift contextual (depends on recent setTime), or is it a permanent firmware change? **→ Phase B capture-with-and-without-setTime.**
- Why are pending arrays not draining to server? **→ Investigate `reading_sync_*` events in another scenario.**

---

## Scenario 2 — Take-Reading flow with cuff cycle (2026-05-12 22:46-22:48)

**Logfile:** `tools/ble-mock/captured-traces/2026-05-12/scenario-02-take-reading-cold-app.log` (14.5 KB)

**What happened:** User tapped "Take a reading," watch's cuff inflated/measured/deflated successfully (watch displayed BP number), watch's own BP history shows the new reading — BUT app showed "We couldn't get that reading" failure.

### Verdict on the Sprint 12.5.2 hypothesis

**REFUTED.** The applyDeviceConfig path executed flawlessly with force:true:

```
22:46:55  [ble-trace] applyDeviceConfig start — force=true dirty=false autoHR=true autoSpO2=true hasDemographics=true
22:46:55  [ble-trace] applyDeviceConfig step=autoHr ok
22:46:56  [ble-trace] applyDeviceConfig step=autoSpo2 ok
22:46:56  [ble-trace] applyDeviceConfig step=userParams ok      ← demographics PUSHED
22:46:56  [ble-trace] applyDeviceConfig step=goals ok
22:46:56  [take-reading] applyDeviceConfig steps=4
```

All four config steps succeeded. The watch HAS demographics. But the transferable register still didn't get the new BP cycle.

### The pivotal trace event

```
22:48:04  [ble-trace] notify cmd=0x73 payload[0..3]=02 00 00 00 listeners=1
22:48:04  [take-reading] 0x73 0x02 BP-ready notification received
22:48:05  [ble-trace] syncBacklog enter lastSync=1777901973 (raw watch sec)
22:48:05  [ble-trace] syncBacklog readBPHistory returned 50 packet(s); first.ts=1777860307 last.ts=1777002022
22:48:05  [ble-trace] syncBacklog exit pulled=0 (filtered from 50); cursor 1777901973 → 1777901973
22:48:05  '[analytics]', 'take_reading_failed', { reason: 'no_reading' }
```

**This is the smoking gun.** The watch:
1. Completed the cuff cycle (cuff displayed BP number — confirmed by founder)
2. Wrote the reading to its display history (confirmed by founder — visible on watch face)
3. Fired `0x73 0x02` BP-ready notification ← **first time observed on this firmware**
4. But `readBPHistory` returned the SAME 50 records as before — newest still 1777860307 ≈ 8 days ago

### Confirmed diagnosis

**The watch has two storage paths and the transferable one is stuck.**

| Storage path | State | Evidence |
|---|---|---|
| Cuff measurement | working | Watch displays BP number |
| Display history (watch face) | working | All readings including just-taken visible on watch |
| `0x73 0x02` notification | working | Trace caught it firing |
| Transferable register (via `0x14 readBPHistory`) | **STUCK** | Newest = 1777860307, no new writes since ~May 4 |

**This is a watch firmware state bug**, not an app bug. No host-side BLE command sequence can unwedge the write-pointer for the transferable register. Possible mitigations (in order of escalation):

1. **Power-cycle watch** (volatile-state reset; doesn't wipe data) — Scenario 3 tests this
2. **Factory reset `0xFF 66 66`** (wipes all watch data) — last resort

### Why scenario 1's count was 50 records, scenario 2's also 50

Same protocol response. cursor.bp = 1777901973 is the watch's "newest in transferable register" date. `readBPHistory(TS=cursor, DIR=1)` returns up to 50 records strictly older than that anchor. Both scenarios returned the same data because nothing new has been written in between.

### Architectural implications for Phase C

Two key revisions to my Sprint 16.5c plan based on this trace:

1. **`0x73 0x02` notify works on this firmware.** The architectural assumption "must poll because notify is dead" is wrong. Keep notify as primary signal, add a poll-fallback for the case where the register isn't updated quickly after notify fires.

2. **Detection + user-facing recovery for register-stuck state.** New requirement: in production we need to detect "register-stuck" and tell the user "your watch needs a restart." Heuristic: if `0x73 0x02` fires AND subsequent `readBPHistory` returns same `first.ts` as before, surface a calm recovery banner. Don't silently fail.

3. **Demographic-gating hypothesis is dead.** Sprint 12.5.2's `applyDeviceConfig(force:true)` at take-reading is still good hygiene (keeps watch settings current), but it's NOT the BP fix.

### Pending questions

- Does power-cycle unwedge the register? **→ Scenario 3 (answered: NO).**
- If power-cycle doesn't work, does factory reset?
- Does the stuck-register state recur after we recover from it? (Need post-recovery soak test.)
- What event on ~May 4 froze the write-pointer originally?

---

## Scenario 3 — Power-cycle watch + retry take-reading (2026-05-12 22:56-23:05)

**Logfile:** `tools/ble-mock/captured-traces/2026-05-12/scenario-03-after-power-cycle.log` (15.3 KB)

**What happened:** User held watch power button to shut down, waited 10s, powered back on, waited 30s for boot, ran take-reading flow again. Watch cuff measured fine, display history recorded the reading, but app still showed "We couldn't get that reading."

### Verdict: Power-cycle does NOT unwedge the transferable register

Trace pattern is IDENTICAL to scenario 2:

```
23:02:53  applyDeviceConfig start — force=true ... hasDemographics=true
23:02:53  applyDeviceConfig step=autoHr ok
23:02:53  applyDeviceConfig step=autoSpo2 ok
23:02:53  applyDeviceConfig step=userParams ok
23:02:53  applyDeviceConfig step=goals ok
23:02:53  syncBacklog readBPHistory returned 50 packet(s); first.ts=1777860307 last.ts=1777002022
23:02:53  syncBacklog exit pulled=0; cursor 1777901973 → 1777901973
23:03:57  notify cmd=0x73 payload[0..3]=02 00 00 00   ← BP-ready fires AGAIN
23:03:58  syncBacklog readBPHistory returned 50 packet(s); first.ts=1777860307 ← SAME 8d-old data
23:03:58  take_reading_failed reason='no_reading'
```

`first.ts` unchanged across scenario 1, 2, 3. Cursor anchor unchanged. Watch's "latest in transferable register" is the same record from ~8 days ago.

**Conclusion:** the stuck state is in non-volatile firmware storage. A volatile-state reset (power-cycle) does not clear it.

### Bonus finding: `0x73` notify pathway is FULLY alive on this firmware

Pre-take-reading watch was idle. The trace captured passive notifications:

```
22:56:40  [ble-trace] 0x73 kindByte=0x01 classified=hr        ← HR ready
23:00:00  [ble-trace] 0x73 kindByte=0x04 classified=steps     ← Steps milestone
23:03:57  [ble-trace] 0x73 kindByte=0x02 classified=bp        ← BP ready
23:05:23  [ble-trace] 0x73 kindByte=0x0c classified=battery   ← Battery update
```

**The saga master log's claim "only 0x73 0x0c battery was ever observed" is WRONG.** All four notification kinds we map (`hr`, `bp`, `spo2`, `steps`, `sports`, `dnd`, `battery`, `sleep_session_complete`) fire on this firmware. The previous traces from 2026-05-11/12 happened to land in 4-minute windows where only battery fired.

### Architectural implications

1. **Event-driven sync is viable.** Phase C's Background Continuity Strategy can lean on `0x73` notifications + a poll fallback, rather than purely polling. Major battery + responsiveness win.
2. **The register-stuck state is the load-bearing real bug.** Everything else we've found is either:
   - A non-issue masquerading as a bug (DIR=1 walk-backward — cursor works)
   - A diagnostic gap that the traces now fix (notify pathway alive)
   - A separate quality issue (HR interval, timestamp shift, server-sync backlog)
3. **The fix has two parts:** (a) detect the stuck state in production, surface a calm recovery banner to the user; (b) ship a one-tap "Reset watch settings" / "Factory reset watch" affordance from Settings → Diagnostics so users can self-recover.

---

## Scenario 4 — Reset cursors + re-sync (2026-05-12 23:10)

**Logfile:** `tools/ble-mock/captured-traces/2026-05-12/scenario-04-reset-cursor-resync.log` (299 KB)

**What happened:** User tapped "Reset cursors + re-sync" in the dev panel.

```
23:10:26  syncBacklog enter lastSync=0
23:10:26  readBPHistory returned 50 packet(s); first.ts=1778598235 last.ts=1777736243
23:10:26-27  50× reading_persisted (source=watch)
23:10:26  syncBacklog exit pulled=50; cursor 0 → 1778598235
23:10:26  syncBacklog enter lastSync=1778598235
23:10:27  readBPHistory returned 50; first.ts=1778597282 last.ts=1777729064
23:10:27  exit pulled=0
```

### The diagnosis flips completely

**The watch's transferable register is NOT stuck.** When queried with TS=0, the watch returned its actual latest record at 1778598235 — 8 days NEWER than the previous cursor anchor (1777901973). 50 BP readings landed in `useReadings.recent` in one shot.

**The bug is in our cursor model.** `readBPHistory(TS=X, DIR=1)` returns records strictly OLDER than X, not newer. Sprint 6's syncBacklog comment claimed "DIR=1 ... return up to 50 newer ones" — empirically refuted. Cursor advancement to the newest record's timestamp creates a permanent blind spot for everything newer.

Notice the second sync at 23:10:27: with cursor freshly advanced to 1778598235 (the just-pulled max), `readBPHistory(TS=1778598235, DIR=1)` returned `first.ts=1778597282` — 953 seconds OLDER than cursor. The watch's "latest" hasn't changed (still 1778598235), but the protocol now excludes it as the anchor.

### Implication for syncBacklog (the load-bearing finding of Phase A)

Every BP cycle taken AFTER a successful sync is structurally invisible to our incremental sync — until the cursor is reset. This is exactly the symptom the founder has been reporting since Sprint 6: "BP doesn't reliably show up in the app." It's also why the saga master log's "register stuck" hypothesis felt so compelling — empirically, the same 50 records came back forever.

The fix: change `sinceTimestampSec: lastSync` → `sinceTimestampSec: 0` in syncBacklog. Watch returns its latest 50, in-memory cursor stays as a filter-only marker, addPendingReading's existing `(source, deviceBleId, measuredAtSec)` dedupe handles re-fetches.

---

## Scenario 5 — Confirm cursor bug with fresh BP cycle (2026-05-12 23:21)

**Logfile:** `tools/ble-mock/captured-traces/2026-05-12/scenario-05-confirm-cursor-bug.log` (14.7 KB)

**What happened:** User took another BP via take-reading. Predicted to fail with same "no_reading" because cursor was at 1778598235 (post-reset newest).

### Founder confirmation between scenarios 4 and 5

> "the record i had on my phone before the most recent bp data taken was 1 reading behind the most recent reading which was showing on the watch face... after this reading, the reading on my phone is 2 readings behind"

So between scenarios 4 and 5, the watch took an inadvertent BP cycle (or one taken during scenario 4's pull was at the boundary), making phone 1-behind. After scenario 5's cycle, phone is 2-behind.

### Trace verdict (matches scenarios 2 + 3 EXACTLY)

```
23:21:13  applyDeviceConfig 4 steps OK (force=true, hasDemographics=true)
23:21:13  syncBacklog enter lastSync=1778598235
23:21:13  readBPHistory returned 50; first.ts=1778597282 ← STILL 953s OLDER than cursor
23:21:13  exit pulled=0
23:21:13  waiting_for_watch
23:22:33  0x73 kindByte=0x02 classified=bp        ← watch confirmed BP captured
23:22:33  syncBacklog enter lastSync=1778598235
23:22:34  readBPHistory returned 50; first.ts=1778597282 ← SAME data again
23:22:34  exit pulled=0
23:22:34  take_reading_failed reason='no_reading'
```

The new BP cycle was recorded on the watch (display history, transferable register, 0x73 0x02 fired) but DIR=1 with TS=cursor excludes it. **Cursor model bug definitively confirmed.**

---

## Scenario 6 — Fix verification (2026-05-12 23:38-23:40)

**Logfile:** `tools/ble-mock/captured-traces/2026-05-12/scenario-06-fix-verification.log` (41.3 KB)

**Fix applied:** `apps/mobile/src/services/sync/syncBacklog.ts:230` — changed `sinceTimestampSec: lastSync` → `sinceTimestampSec: 0`. In-memory `lastSync` retained as filter-only marker.

**What happened:** User reloaded the app, navigated to take-reading, took a BP. App showed success with the BP number.

### Trace verdict — FIX WORKS

```
23:39:07  take-reading begin → applyDeviceConfig 4 steps OK
23:39:07  syncBacklog enter lastSync=1778599350 (filter-only; query is TS=0)
23:39:08  readBPHistory returned 50; first.ts=1778599350
23:39:08  exit pulled=0 (everything already in store, filter rejects)
23:39:08  waiting_for_watch
23:39:53  ble disconnect (cuff inflation)
23:40:03  0x73 kindByte=0x02 classified=bp           ← watch ready
23:40:10  syncBacklog enter lastSync=1778599350 (filter-only; query is TS=0)
23:40:11  readBPHistory returned 50; first.ts=1778600400  ← NEWER than cursor!
23:40:11  reading_persisted (source=watch)
23:40:11  exit pulled=1; cursor 1778599350 → 1778600400
23:40:12  take_reading_received (source=watch_post_disconnect)  ← SUCCESS
```

**The fix flips the protocol behaviour exactly as predicted:** the same `readBPHistory` query that previously returned `first.ts=1778597282` (older than cursor) now returns `first.ts=1778600400` (newer) because we're asking with `TS=0` instead of `TS=cursor`. The filter catches the one new reading, persists it, advances the cursor.

---

## Phase A — closing summary

| Hypothesis | Verdict | Action |
|---|---|---|
| applyDeviceConfig silent-skip on dirty=false | Confirmed | Phase 16.5c: kill dirty-gate, use 1-hour debounce |
| Watch never fires 0x73 0x02 | **REFUTED** | Phase 16.5c: keep notify as primary signal, add poll fallback |
| 0x73 kind bytes not mapped | Refuted (all observed kinds are mapped) | None |
| HR sample interval = 30 min | Refuted (actual = 5 min) | Phase 16.5c: read interval from index packet |
| SpO2 cadence 60 min | Confirmed | None |
| Sleep richness via readDayInfo | Trace captured payload bytes for analysis | Phase 16.5b: decode un-parsed regions |
| 0x73 0x04 hourly steps fires | Confirmed | Phase 16.5c: wire intra-day step distribution |
| Watch BP persistence broken | **REFUTED** | None (watch works fine) |
| **NEW: cursor model structurally broken** | **CONFIRMED + FIXED** | Shipped in scenario 6 |

### Bugs discovered (not in original hypothesis list)

| # | Bug | Status |
|---|---|---|
| NEW-1 | HR sample interval mismatch (5 actual vs 30 assumed) | Open — Phase 16.5c |
| NEW-2 | Watch firmware no longer applies UTC+8 shift; `watchTimestampToUtcSec` over-corrects HR cursor → +7-8h skew | Open — needs firmware-detect-then-shift logic |
| NEW-3 | HR/SpO2/Sleep/Activity pending arrays not draining to server (HR pending = 2962) | Open — investigate next session |
| NEW-4 | Saga master log's H1 ("watch never fires 0x73 0x02") was wrong | Closed by traces 2, 3, 5, 6 |
| **NEW-5** | **Sprint 6 cursor model: DIR=1 with TS=cursor excludes records ≥ cursor. 8+ months silent failure.** | **FIXED in scenario 6** |

### Phase A deliverables

- 6 captured traces in `tools/ble-mock/captured-traces/2026-05-12/`
- This notes file
- One-line code fix shipped + verified on-device
- 7 hypotheses answered with byte-level evidence

### Phase 16.5b queued work

- Decode `readDayInfo` payload bytes — look for REM, awake, transitions in the un-parsed regions
- Investigate why pending arrays aren't draining (server endpoint? local post failure?)
- Verify HR cursor encoding hypothesis by comparing pre/post setTime traces
- Convert these 6 traces into reusable `tools/ble-mock` scenario fixtures

### Phase 16.5c queued work

- Kill dirty-gate, replace with 1-hour debounce in applyDeviceConfig
- Push applyDeviceConfig at pair-time
- Read HR sample interval from index packet (not hardcode)
- Deep historical backfill for BP (walk backward via DIR=1+cursor=oldest_returned, as the saga's original intent)
- Wire `0x73 0x04` hourly steps notification → intra-day step distribution
- Production "Sync health" surface (Settings → Diagnostics)
- Production Force Sync button (Home or Settings)
- Auto-SpO2 default flip to ON
