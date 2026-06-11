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

## PostHog key — FIXED (2026-06-11)

The old build used a **personal** API key (`phx_…` / "personal_api_key") → 401,
all client analytics silently failed. The correct **project** key
(`phc_CEDLsB…`, public/write-only) + host are now in **`eas.json`** production
env (`EXPO_PUBLIC_POSTHOG_API_KEY` / `EXPO_PUBLIC_POSTHOG_HOST`).

⚠️ **Local gradle builds read the SHELL env, not `eas.json`** — so for
`npm run release:android:apk`, also export them in your release env:
```
EXPO_PUBLIC_POSTHOG_API_KEY=phc_CEDLsBokrpgqiHYvWyzaHioSXnB5VvPDCfTjma9edPRe
EXPO_PUBLIC_POSTHOG_HOST=https://us.posthog.com
```
(EAS cloud builds pick them up from `eas.json` automatically.)

## Remote-refresh status (updated 2026-06-11)

The whole **server→Expo→FCM** path is now **fixed and verified** (ticket +
receipt both `ok`). The real fix was **`EXPO_ACCESS_TOKEN`** — the Expo project
has Enhanced Push Security on, so sends require an access token; it's now set
as a prod function secret. **FCM credential was fine.** (commit `e7f6469`.)

What v5 does NOT change: **Android's best-effort delivery of silent data-only
messages to a backgrounded app.** Even with ticket+receipt ok and the BLE
foreground service alive, the backgrounded app wakes only sometimes — an
Android platform limitation, not our code. See
`REMOTE_REFRESH_FIX_2026-06-10.md` §④.

> **2026-06-11 — silent-first remote refresh + visible fallback, now in v5.**
> A caregiver's pull-to-refresh stays SILENT (invisible to the wearer). If
> fresh data doesn't land within ~20s, the caregiver screen offers a calm
> "Send a reminder" row; only that deliberate tap sends a VISIBLE, tappable
> notification ("{name} would love to see your latest reading. Tap to sync
> your watch.") that the OS delivers reliably even in Doze. **So the wearer
> is invisible-synced when possible, reliably reachable when not, and never
> false-nagged.** Ships in the v5 client AND requires redeploying two edge
> functions to prod (deploy separately — the two keep different JWT
> settings):
> ```
> SUPABASE_ACCESS_TOKEN=<PAT> npx supabase functions deploy send-push \
>   --project-ref kqnzxjrpnjnczhgdwdqg --use-api --no-verify-jwt
> SUPABASE_ACCESS_TOKEN=<PAT> npx supabase functions deploy request-sync \
>   --project-ref kqnzxjrpnjnczhgdwdqg --use-api
> ```
> (`send-push` stays `verify_jwt=false` + internal-secret gated; `request-sync`
> keeps `verify_jwt=true`.) See `REMOTE_REFRESH_FIX_2026-06-10.md` §④.

**New prod secret to know about:** `EXPO_ACCESS_TOKEN` is now required by the
`send-push` function (set in Supabase → leiko-prod → Edge Functions → Secrets).
Keep it valid; rotate like any secret.

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
