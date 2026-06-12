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
>
> **✅ DEPLOYED 2026-06-11** — `send-push` **v20** (`verify_jwt=false`) +
> `request-sync` **v5** (`verify_jwt=true`) are live in prod (verified via the
> Management API). The server is ready; the client orchestration ships in v5.
> Design record: `docs/_adr/0011-silent-first-remote-refresh.md`; spec:
> `docs/11-push-notifications.md` §10.

**New prod secret to know about:** `EXPO_ACCESS_TOKEN` is now required by the
`send-push` function (set in Supabase → leiko-prod → Edge Functions → Secrets).
Keep it valid; rotate like any secret.

## Post-build retest (with the watch connected)

> **✅ PASSED on device 2026-06-12.** vc5 built (Linux, JDK 17, signed),
> installed on wearer Pixel `43230DLJH001YY` + caregiver OPPO `c4f40da1`.
> Push-token registration, silent dispatch, the §④ no-wake on a backgrounded
> Pixel, the "Send a reminder" fallback, the visible `sync_nudge` delivery, and
> the caregiver acknowledgement ALL verified. Full results + the Play upload
> steps + signing-key check: **`plans/V5_RELEASE_2026-06-12.md`**. (Note: vc5
> signature differs from the Play-installed vc4 → had to uninstall to sideload;
> consistent with Play App Signing — confirm the upload key before uploading.)

Two phones: **W** = wearer (watch owner), **C** = caregiver. `adb install -r`
v5 on both (upgrade-install — preserves state + the registered token; do NOT
uninstall). Verify DB facts via `tools/prod-sql.py` (`docs/release/prod-db-access.md`).

### A. Push-token registration (commit ①)
1. On **W**, sign in. Without any relaunch hack, prod `push_tokens` gets a row
   for the wearer (`select user_id, platform, last_seen_at from push_tokens`).
2. On **C**, grant notifications when prompted; confirm a row for the caregiver
   too (needed for anomaly/family pushes, not for remote refresh).

### B. Remote refresh — SILENT path (the hoped-for invisible case)
This is the experiment never run before v5: token registration +
`EXPO_ACCESS_TOKEN` + battery-opt exemption now coexist.
3. On **W**, grant the battery-optimization exemption at the post-pairing
   prompt (or Settings → Battery → unrestricted). Connect the watch; take a
   fresh reading so there's something new to sync.
4. **Background W** (go to launcher — verify it's not foreground; ideally let
   it sit so it's idle). Phone awake, not airplane mode.
5. On **C**, open the wearer's ParentDashboard → pull-to-refresh.
6. **Success (silent):** within ~20s a new `readings` row appears server-side
   and **C**'s dashboard updates via Realtime — and **W showed nothing**. If
   this happens consistently, silent is good enough on this device; the nudge
   never appears.
   - Audit trail: `audit_log` has `push.sent` with `metadata.category='sync_refresh'`.

### C. Remote refresh — VISIBLE fallback (when silent doesn't surface data)
7. If §B does not produce fresh data within ~20s, **C**'s dashboard shows a
   calm **"Haven't heard back from {name}'s phone yet." + "Send a reminder"**
   row (`testID=parent-dashboard-refresh-nudge`).
8. Tap **Send a reminder** on **C**. Expect:
   - `audit_log` `push.sent` with `metadata.category='sync_nudge'`.
   - On **W**, a visible notification: *"{caregiverName} would love to see your
     latest reading. Tap to sync your watch."*
   - **C** shows "Reminder sent to {name}."
9. On **W**, tap the notification → app opens → BLE sync runs → a new
   `readings` row appears → **C**'s dashboard updates (and its nudge row clears).

### D. Edge / regression checks
10. **Quiet hours:** repeat §C inside the wearer's quiet window → `sync_nudge`
    is held (`push.suppressed`, `outcome='suppressed_quiet_hours'`); the silent
    `sync_refresh` still fires.
11. **No false-nag:** with no new watch data, the silent attempt produces no
    fresh data and the reminder is *offered* but never auto-sent — confirm **W**
    gets nothing unless **C** taps.
12. **Cron untouched:** `request-stale-syncs` (3-hourly) still sends only the
    silent `sync_refresh` — no visible notification ever from the cron.

(`devices.last_sync_at` is a dead field — do NOT use it as a signal; use new
`readings` rows + `audit_log` instead.)

## State snapshot

- `origin/main` @ `4dd3dfc` — clean, everything pushed (silent-first remote
  refresh merged 2026-06-11).
- Prod edge functions: **`send-push` v20** (`verify_jwt=false`),
  **`request-sync` v5** (`verify_jwt=true`), `request-stale-syncs` v6,
  `detect-anomaly`/`manage-family-membership` v13.
- Function secrets in prod: `LEIKO_INTERNAL_PUSH_SECRET`, `EXPO_ACCESS_TOKEN`.
- Corporate Play ledger: vc2 (open test, live) · vc3 (superseded) · vc4
  (current) → **next upload is vc5.**
- Docs: `docs/_adr/0011-silent-first-remote-refresh.md`,
  `docs/11-push-notifications.md` §10, `REMOTE_REFRESH_FIX_2026-06-10.md` §④.
