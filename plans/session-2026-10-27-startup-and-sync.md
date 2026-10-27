# Session 2026-10-27 — "the app keeps loading", background sync, on-device round

Branch: `fix/startup-never-hangs` (off `main` @ 30d3e0e). Founder present,
testing on the Pixel 8 (`43230DLJH001YY`) from DEN airport Wi-Fi.
Companion doc for the first fix: `plans/STARTUP_HANG_FIX_2026-10-27.md`.

## TL;DR

| # | Finding | Status |
|---|---|---|
| 1 | Launch spinner could hang forever (no request timeout, no failure branch in `auth.hydrate`) | **Fixed** (commit 1) |
| 2 | Real-world "keeps loading": JS thread pegged ~100% for ~2.5 min after every cold start while the watch syncs; Home shows only its skeleton | **Mitigated + instrumented** (commit 2) — root hot spot still to confirm from `[leiko-perf]` logs |
| 3 | Background sync never uploads: app holds the watch link in the background but `/sync` is only called while the app is foreground | **Open — top priority** |
| 4 | Battery-optimization prompt's buttons clipped after pairing | **Fixed** (commit 3) |
| 5 | `compute-correlations` edge function returns 500 every hour | **Open** |
| 6 | Installed build on the Pixel was signed by an unknown key | **Resolved for testing** (reinstalled) — release signing still to sort |

## 1. Launch spinner hang — fixed

See `plans/STARTUP_HANG_FIX_2026-10-27.md`. Global 60 s fetch timeout on the
Supabase client, 10 s deadline per launch step, profile cached in encrypted
MMKV (`leiko.profile.cached`), new `'offline'` auth status rendered as a calm
"Try again" screen. 9 regression tests fail on the old `auth.ts`.

## 2. JS thread pegged during the cold-start watch drain

Evidence (release build v20, 2026-10-27 12:14–12:17 MDT):

- Supabase edge logs: every Home request (token → users → onboarding RPC →
  family_members → readings → vitals_other) returned 200 within 6 s of launch.
- Screen at 16 s and 60 s: header only, Home skeleton (`isLoading` stuck true).
- `top -H`: `mqt_v_js` at 100–129% CPU; 1m23s CPU in the first ~90 s; 12m48s
  by 12:58. ART log: ~200 MB Java heap churn every few seconds throughout.
- Home rendered the moment the BLE GATT session ended (~2.5 min after launch).

Changes (commit 2):

- Cold-start sync deferred: `InteractionManager.runAfterInteractions` + 6 s
  (`COLD_START_SYNC_DELAY_MS`), cancelled by `stop()`.
- `pendingVitalBuffer.removeByKeys` — one read/write for N keys. Previously
  hr/spo2/sleep/activity `acceptSyncResult` looped `removeByKey`, a full JSON
  parse/filter/stringify of the buffer PER key (O(keys × buffer)).
- §9 heartbeat `set()` throttled from every BLE packet to ≤ 1/s.
- `utils/perfTrace.ts`: `[leiko-perf]` logcat lines time each sync step
  (`sync.*`, `mv.*`, `home.fetchParentSummaries`) and a 250 ms JS stall
  detector logs `JS stall Nms during phase=<step>`.

**Next:** with the new build on the phone, `adb logcat -s ReactNativeJS` and
read the `[leiko-perf]` lines over one cold start. The stall lines name the
step that burns the thread. Other suspects noted while reading:
`fetchParentSummaries` reads ALL readings with no limit (keeps 30/family);
`rollingMinAverage` is O(n²) over HR samples; `useSeededLearnCard` selector
returns a fresh array each render.

## 3. Background sync does not upload — open, top priority

Evidence:

- Bluetooth GATT client history: Leiko connected to the watch at 11:01,
  11:18, 11:30, 11:43, 11:58 MDT (app not on screen), and held one link
  12:33:59–12:54:36 while backgrounded (founder's watch on wrist).
- Supabase function logs: `/functions/v1/sync` calls 16:03–16:43 UTC (app in
  use), then **none** 16:43–18:15 UTC, and none 18:38–18:53 UTC while
  backgrounded. On foreground at 18:53 UTC the backlog flushed (~10 new BP
  readings → `detect-anomaly`, plus HR chunks) until ~19:10 UTC.
- `dumpsys jobscheduler` / `dumpsys alarm`: **no Leiko job or alarm
  registered** (checked after a `force-stop` at 12:14, which clears alarms —
  but launches since did not restore it).
- `startBackgroundSync()` only calls `registerTaskAsync` when
  `isTaskRegisteredAsync` is false; TaskManager's persisted flag can say
  "registered" after the OS dropped the alarm, so it is never re-armed.
  Suspected; verify.
- The app is battery-whitelisted, standby bucket ACTIVE, FGS
  `LeikoBleForegroundService` running.

Hypothesis: while backgrounded the JS runtime is alive (FGS holds the
process) and the live-window link stays open, but the upload leg never runs —
either it waits on a JS timer that Android pauses for backgrounded RN apps
(cf. §9 in `BACKGROUND_SYNC_INVESTIGATION_2026-08-14.md`), or the pegged JS
thread starves it. Plan: one background cycle on the new build with
`[leiko-perf]` logging, then fix; always (re)register the background task on
launch.

## 4. Battery-optimization prompt — CTAs clipped (fixed)

Founder report after pairing: "Keep readings arriving…" sheet, button hidden.
Cause: `BottomSheet` `size="compact"` capped at 50% height with
`overflow: hidden`, no bottom safe-area inset under Android edge-to-edge
(targetSdk 36), and the prompt body had `flex: 1`. Fix in the shared
component (13 compact sheets): cap 85%, content scrolls past the cap, bottom
inset added (context read so it never throws outside a provider); prompt body
no longer `flex: 1`. Test asserts both CTAs render inside the sheet scroll.

## 5. `compute-correlations` — 500 every hour

Function logs show `POST | 500 | /functions/v1/compute-correlations` on every
hourly cron today (14:00–18:00 UTC). Personal findings / correlation matrix
will be stale. Not investigated yet — read its function logs next.

## 6. Signing, builds, install (Windows founder machine)

- The Pixel had v20 (`installerPackageName=null`, single base APK, no Play
  stamp) signed by cert SHA-256 `CF:65:9F:68:…:78:65` — matches neither the
  upload key in `apps/mobile/@lawone-apps__leiko.jks`
  (`84:13:9B:AF:…:27:28`, alias `c86e5bf811807360e52e3918eea1ed58`) nor the
  repo debug key (`FA:C6:17:45:…`). Probably built on another machine. A
  differently-signed build cannot update it.
- Founder approved uninstall. Before it, the old app was foregrounded and
  allowed to flush its pending uploads (verified in function logs).
- Test build installed 2026-10-27 13:38 MDT: `assembleRelease` without
  `LEIKO_RELEASE_*` → signed with the repo debug key, versionCode 1. Fine for
  sideload testing; **not** uploadable to Play. A Play build needs the upload
  key + passwords (`npx eas-cli credentials` → Android → production).
- Windows build recipe (PowerShell, `apps\mobile\android`):
  ```powershell
  $env:EXPO_NO_METRO_WORKSPACE_ROOT = "1"   # else Metro can't resolve ..\..\index.js
  .\gradlew assembleRelease
  ```
  `npm run release:android:apk` sets that var itself but requires the four
  `LEIKO_RELEASE_*` vars; PowerShell can't `source .env.release` (none exists).
- Local checkout note: the founder's Windows git uses `core.autocrlf=true`;
  from the Cowork Linux shell run git with `-c core.autocrlf=true` or every
  file shows as modified.

## On-device tooling used (founder's PC)

`D:\APP\tools\` (outside the repo): scrcpy 3.3.1 (official release, SHA-256
verified, includes adb) and `adb-bridge.bat`, which runs only adb commands
dropped into `tools\bridge\cmd.txt` and writes `out.txt`. Founder starts it;
close the window to stop it.

## Verification

- Jest: 246 suites / 2846 tests green. `tsc --noEmit` clean. eslint clean on
  touched files. copy-lint 0 hard.
- On device: new build launches to the welcome screen in < 8 s; sign-in and
  pairing done by the founder. Perf-log capture and background check pending.

## Next session, in order

1. Capture `[leiko-perf]` over a cold start on the Pixel; fix the named hot step.
2. Background upload (§3): one background cycle with logs, fix, verify the
   server receives `/sync` while the app is closed.
3. Always re-register the background fetch task on launch; confirm with
   `dumpsys jobscheduler` / `dumpsys alarm`.
4. `compute-correlations` 500s.
5. Release signing: get upload-key passwords, build an AAB, Play Internal
   testing; bump versionCode above 20 and versionName (1.1.0?).
