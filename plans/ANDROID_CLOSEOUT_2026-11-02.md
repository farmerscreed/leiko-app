# Android close-out — 1.1.0 release (2026-11-02)

Continues `plans/RELEASE_AUDIT_2026-10-30.md`. Read that first for the
audit itself; this file records what happened after it and what is left.

## Builds on Play (`com.leiko.care`)

| versionCode | Track | Contents | Result |
|---|---|---|---|
| 23 | — | PRs #30–#35 | Rejected by Play: Billing Library 7.1.1 (Play requires ≥ 8) |
| 24 | Internal | + PR #38 (react-native-purchases 9.15.3, Billing 8.0.0) | Installed from Play 2026-10-31. **Background sync dead on fresh install**: `[leiko-bg] storage not ready — skipped` every wake (memoised migration status) |
| 25 | Internal | + PR #39 (live migration status in `storageReady`) | Installed from Play 2026-11-02 11:03 CST. Task fires, but the **freezer stops the process ~10 s after every wake** before the foreground service starts → no upload (see below) |
| 26 | Internal | + PR #40 (hold foreground service first) | **Background sync verified** 13:49 CST: wake → FGS allowed → timers held → session ok → watch read → HR uploaded, no freeze |
| 27 | Internal | + PR #42 (Health Connect) | Permission screen works (delegate fix); history copy: BP/HR/SpO2 in HC, steps/calories/sleep missing |
| 28 | Internal | + skip invalid records, salvage batches, hidden=null rows | Copy 5,637 written / 0 rejected; day records 6 PM→6 PM (UTC day key) |
| 29 | Internal → **promote to Production** | + local-midnight day windows | Copy 5,648 / 0 rejected; steps & calories on the right dates; privacy link → leiko.health/privacy ✅ |

Verified in 25's AAB: Play upload-key signer `CF:65:9F…78:65`, PostHog
`phc_` only (no `phx_`), RevenueCat `goog_` key, prod Supabase ref,
Billing 8.0.0.

## The background-sync root cause (PR #40)

Device log, build 25, Pixel 8, app battery-exempt, standby bucket 5:

```
12:02:46.117 Start proc 18296:com.leiko.care for broadcast TaskBroadcastReceiver
12:02:46.758 TaskService: Handling intent 'leiko.sync.backgroundFetch'
12:02:49.951 ReactNativeJS: [leiko-bg] task fired          (3.2 s JS boot)
12:02:52.977 ReactNativeJS: [leiko-bg] js timers PAUSED
12:02:56.851 ActivityManager: freezing 18296 com.leiko.care (10 s after start)
```

The foreground service — the only freezer exemption, and the thing that
keeps JS timers running — was started inside `runWatchSync`, *after*
`storageReady()` (several keystore reads). A cold wake never got there.
The 11:32 run in a warm process did the same (`task fired` → frozen 10 s
later). PR #40 starts the service as the first await in the task body and
runs the storage gate + sync inside it; `ble/foregroundService` now loads
analytics lazily so it can be imported before the MMKV key.

Also seen: at 11:44 Android **killed the warm process for excessive CPU**
(8.8 s CPU in 5 min while cached, limit 2 %). Something in the UI process
keeps running in the background after the app is left. Not the cause of
the missing uploads, but a battery/perf bug to chase — suspects: Realtime
reconnect loop, a JS interval kept alive by the timer hold, Home polling.

## Verify build 26 (exact steps)

1. Founder: build with `LEIKO_VERSION_CODE=26` from the PR #40 branch
   (clean build — delete `android/app/build`, `android/app/.cxx`,
   `android/build`, `%TEMP%\metro-*`, `%TEMP%\haste-map-*`), upload to
   Internal testing as `1.1.0 (26)`, update the phone from Play.
2. adb: `dumpsys package com.leiko.care` → versionCode 26, installer
   `com.android.vending`.
3. Leave the app in the background, watch near. Stream
   `logcat -v time ReactNativeJS:V ActivityManager:D TaskService:V *:S`.
   Expect within 15–30 min: `task fired` → `js timers held` → `session
   ok=true` → `task result=ran`, **no** `freezing … com.leiko.care` until
   the service stops, and a `POST /functions/v1/sync` in Supabase
   function_edge_logs.
4. Pass → founder merges #40, promotes 26 to Production (and Open
   testing). Fail → read the breadcrumbs; next suspect is a denied
   background FGS start (`ble_fg_start_failed`).

## Health Connect — DONE in build 29 (PR #42)

Verified on device: all 9 permissions granted via the in-app flow;
history copy (2 y, HR 30 d); BP/HR/SpO2/steps/calories from Leiko at the
right times; re-copy replaces, never duplicates; privacy-policy link
works (Android 14 VIEW_PERMISSION_USAGE alias). Diagnostics:
`[leiko-hc] backfill rows …` in logcat.

Known limitation: Leiko writes ONE steps record per day (the watch's
hourly split isn't read yet), so Health Connect's cross-app dedup can
double count against phone/Fitbit minute data. Users fix it by putting
Leiko first in Data sources and priority → Steps, or turning off "Share
steps". Follow-up: read the watch's hourly steps and write hourly records.

## Health Connect — original gaps (2026-11-02 morning, now fixed)

Already built (Sprint 9.5, ADR-0005, `src/services/health-platform/`):
writes BP, HR, SpO2, sleep (with stages), steps, active calories after
every successful `/sync`; reads weight, height, blood glucose (30-day
first backfill). Off by default; Settings → Health Connect → master +
per-vital toggles. Hidden for `account_type = caregiver` by design
(D13 §12.6: never write Mum's data into the caregiver's store).

Gaps for "everything in one central place":
1. **No history export.** Writes are forward-only; turning the toggle on
   does not copy existing Leiko history into Health Connect. Proposed:
   one-time backfill on enable (from local + server history, paged,
   idempotent via `clientRecordId`), with progress in Settings.
2. **Hybrid users.** A caregiver who also wears their own watch gets no
   Health Connect at all. Proposed: allow writes for the family where
   `parent_user_id = me` (relationship `self`), never for others.
3. **Play declaration.** Production review requires the Health Connect
   permissions declaration in Play Console (each permission justified).
   Prepare before promoting to Production.
4. Not yet device-verified on the Play build (open Health Connect app →
   App permissions → Leiko; data → Blood pressure → source Leiko).

## Still open (Android)

- **Play Console: create subscriptions `com.leiko.app.plus.monthly` and
  `com.leiko.app.plus.annual` for com.leiko.care** — RevenueCat logs
  PRODUCT_NOT_FOUND; the paywall is empty for new users. Release blocker
  for revenue.
- Play Console Health Connect declaration (`docs/release/play-health-connect-declaration.md`);
  confirm leiko.health/privacy covers Health Connect.
- Server BP duplicates: the same reading stored ~3× one hour apart
  (time-zone shift while travelling) — needs a read-only prod count, then
  a dedupe migration + a client fix.
- Background flush of saved readings uploads one by one (122 s for a
  backlog on 11-02) — batch it.

- PR #37 security migration — founder confirms content machine uses the
  service_role key, then "merge 37".
- PostHog: revoke the old `phx_` personal key.
- `D:\APP\_to_delete_leiko\` awaits founder deletion.
- Ask Leiko over-defers generic questions (guard threshold, ADR-0013).
- Doctor PDF: "Generated" date breaks onto its own page.
- First-sync JS stalls (`mv.hrAcceptChunk`, day-info reads).
- BP measurement test with the second watch; paywall test with a
  non-Plus account.
- Background CPU kill (above).

## Next big thing

US launch + iPhone app: `plans/US_LAUNCH_PLAN_2026-11-02.md` — to be run
in a fresh session.
