# Battery-optimization exemption (Android) — draft

**Status:** DRAFT on branch `feat/battery-optimization-exemption` (not merged).
**Why:** Android throttles silent FCM data messages to battery-optimized apps,
which is why the remote-refresh "sync now" push only wakes a backgrounded phone
inconsistently (`plans/REMOTE_REFRESH_FIX_2026-06-10.md` §④). Letting the wearer
exempt Leiko from battery optimization makes background delivery reliable.

## What's in this draft

| Piece | File |
|---|---|
| Native module (`NativeModules.LeikoPower`) | `android/app/src/main/java/com/leiko/care/power/LeikoPowerModule.kt` |
| Module registration | `…/ble/LeikoBleForegroundServicePackage.kt` |
| Permission | `app.json` + `android/app/src/main/AndroidManifest.xml` (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) |
| JS service | `apps/mobile/src/services/power/batteryOptimization.ts` |
| Gating hook | `apps/mobile/src/hooks/useBatteryOptimizationPrompt.ts` |
| Prompt UI (BottomSheet) | `apps/mobile/src/components/BatteryOptimizationPrompt.tsx` |
| Tests | hook (5) · service (2) · component (4) — all green |

The native module exposes `isIgnoringBatteryOptimizations()` and
`requestIgnoreBatteryOptimizations()` (shows the system "Allow Leiko to ignore
battery optimization?" dialog; falls back to the battery-optimization settings
list if the direct dialog can't open). The hook only surfaces the prompt on a
phone that **has a paired watch** (the device that actually syncs — a remote
caregiver never sees it), when **not already exempt**, and **until dismissed
once** (persisted in MMKV); it re-checks status on every app foreground.

## Wired in: post-pairing (founder-chosen 2026-06-11)

`<BatteryOptimizationPrompt />` is rendered on the **`success` phase of
`PairingScreen`** — the moment the watch connects and background sync starts to
matter. It self-gates (no-op if already exempt / dismissed / not Android), and
this placement avoids colliding with the home-screen
`HealthPlatformPermissionPrompt` BottomSheet.

## ⚠️ Remaining decision for the founder before merge

1. **Play Console declaration.** `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` is a
   flagged permission. Leiko qualifies under the **"app needs to keep a
   persistent connection to a companion device"** acceptable-use case (it
   already declares `FOREGROUND_SERVICE_CONNECTED_DEVICE` for the BP watch).
   The Play Console Data-safety / permissions declaration must state this.
   If you'd rather avoid the declaration, drop the permission and the module
   still works via the settings-list fallback (worse UX — a list instead of a
   one-tap dialog).

## Note

This improves reliability; it does not make background delivery a guarantee
(Android never promises that for data messages). It's the highest-leverage
single change for remote-refresh reliability short of a visible/hybrid push.
