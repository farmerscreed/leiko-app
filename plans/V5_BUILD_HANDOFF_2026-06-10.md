# v5 build handoff — build from the machine that has the keystore

**Date:** 2026-06-10 · **Branch:** `main` (all work merged + pushed to
`origin/main`) · **Build this on the computer that has the release keystore.**

This Linux dev box has **no release keystore** (it didn't travel with the
machine migration), so v5 must be built where `leiko-release.jks` lives.
Everything else is committed and pushed — just pull and build.

---

## What v5 ships (already on `origin/main`)

- **① Push-token registration fix** — `usePushRegistration` registers on
  auth + foreground instead of once at mount. This is the **only client-side
  change that needs a build to take effect.** (commit `4bf0e62`)
- versionCode single-source reconciliation, the prod-DB runbook, and the
  send-push edge-function fix (already deployed to prod, code on main).

Full story: `plans/REMOTE_REFRESH_FIX_2026-06-10.md` + `docs/_adr/0010-…`.

## Build steps (on the keystore machine)

```bash
git pull origin main          # gets ①, ②, docs, versionCode fix
cd apps/mobile && npx expo install

# Source your release-signing env (keystore + passwords + runtime keys).
# On Windows PowerShell, use $env: form — see docs/release/android-release.md.
source ~/secrets/leiko-release.env

# versionCode: bump to 5 (vc4 is the current corporate build).
export LEIKO_VERSION_CODE=5

# Sideload APK for the bench phones (upgrade-installs over vc4):
LEIKO_RELEASE_ACK=yes npm run release:android:apk
#   → apps/mobile/android/app/build/outputs/apk/release/app-release.apk
# Play Store AAB:
LEIKO_RELEASE_ACK=yes npm run release:android:aab
```

Install on the connected phones **without uninstalling** (preserves state +
the already-registered push token):
```bash
adb install -r app-release.apk
```

`LEIKO_VERSION_CODE` is the single source of truth for the Android
versionCode (`docs/release/android-release.md`); `app.json:android.versionCode`
is decorative for local builds.

## ⚠️ Fix BEFORE/IN the v5 build — PostHog key

On-device logcat shows `PostHog … 401 … API key is not valid:
personal_api_key`. The build's `EXPO_PUBLIC_POSTHOG_API_KEY` is a **personal**
API key (wrong type) → all client analytics silently fail. Set the correct
PostHog **project** key (`phc_…`) in the release env before building v5, so
analytics (and the push-registration telemetry) actually report.

## ⚠️ v5 does NOT fix remote-refresh delivery

The remote-refresh **server** path is fixed + live (proven). But the silent
push is **not reliably reaching/​waking the device** — leading hypothesis is
the Expo project's **FCM V1 credential for `com.leiko.care`** is wrong/missing
(Expo accepts the ticket, FCM never delivers). This is an **Expo dashboard**
fix (`primethebrain`), independent of the v5 build — see
`REMOTE_REFRESH_FIX_2026-06-10.md` §④. Do that, then a backgrounded refresh
should wake the phone.

## Post-build retest (with the watch connected)

1. `adb install -r` v5 on both phones.
2. Confirm ① auto-registers: sign in → prod `push_tokens` gets a row for the
   wearer with no relaunch hack (verify via `tools/prod-sql.py`, see
   `docs/release/prod-db-access.md`).
3. After the Expo FCM fix: take a fresh reading on the watch, background the
   app, fire a refresh → a new `readings` row should appear (don't rely on
   `devices.last_sync_at` — it's a dead field).

## State snapshot

- `origin/main` @ `5409eed` — clean, everything pushed.
- Prod edge functions deployed: `send-push` v13 (`verify_jwt=false`),
  `request-sync`/`request-stale-syncs` v3, `detect-anomaly`/`manage-family-membership` v12.
- Function secret `LEIKO_INTERNAL_PUSH_SECRET` set in prod.
- Corporate Play ledger: vc2 (open test, live) · vc3 (superseded) · vc4
  (current) → **next upload is vc5.**
