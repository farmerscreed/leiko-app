# Remote-refresh investigation + fixes — 2026-06-10

**Owner:** founder + Claude (Opus 4.8) · **Backend:** leiko-prod `kqnzxjrpnjnczhgdwdqg`
**Outcome:** the silent remote-refresh push pipeline was broken at two
independent layers; both fixed (one shipped to prod), one last-mile item
remains. This doc is the authoritative record of what was found, what was
changed, and what's left.

> Context: started from the founder's suspicion that the "v4 AAB" (the
> `com.leiko.care` corporate build, versionCode 4) was "not done properly."
> v4 itself was fine; the investigation uncovered why remote-refresh never
> worked. See also `plans/DEVICE_MIGRATION_HANDOFF_2026-06-10.md`.

---

## TL;DR

Remote-refresh = a caregiver pulls-to-refresh → silent FCM push → the
watch-owner's phone wakes and syncs the watch over BLE, without them opening
the app. It never worked because:

1. **No device ever had a push token.** `push_tokens` was empty for every
   user — registration fired once at app mount and lost the race with auth
   hydration. **(Fixed in code: `usePushRegistration`.)**
2. **Even with a token, no push ever dispatched.** Every edge function that
   calls `send-push` was 401'd by `verify_jwt` (this project's new API keys
   mean the injected service key isn't a JWT). **(Fixed + deployed: `send-push`
   `verify_jwt=false` + internal shared secret.)**

After the fixes, the server pipeline is **proven end-to-end**:
`request-stale-syncs → send-push` returns `{scanned:1, requested:1}` and a
real `push.sent` audit row lands. Remaining: confirm the push actually
reaches the device + triggers a BLE sync (needs a connected watch).

---

## How it was found (evidence chain)

All verified against prod via the Management API (see
`docs/release/prod-db-access.md`).

- `push_tokens`: **0 rows, whole table.** Both test phones signed in today
  but neither registered. → registration bug.
- Cold-relaunched the app on the wearer (already signed in) → a valid
  `ExponentPushToken[…]` + FCM token appeared instantly. → the registration
  *logic* (projectId, FCM, RLS, upsert) all work; only the **timing** was
  wrong. The sole call site was `RootNavigator` mount (`void register…()`,
  deps = stable store actions → fires once, never after sign-in).
- Triggered the server path (contained, wearer-only): `request-stale-syncs`
  returned `{scanned:1, requested:0}` with **no `recordOutcome` audit row**.
  A **direct** `send-push` call (real JWT bearer) returned `{outcome:"sent"}`
  and wrote the `push.sent` row. → `send-push` is healthy; the **caller→
  send-push hop** is rejected before the handler runs.
- All of `send-push` / `request-sync` / `request-stale-syncs` have
  `verify_jwt=true`. The only difference between the failing and working
  calls was the **bearer**: the functions' auto-injected
  `SUPABASE_SERVICE_ROLE_KEY` (not a JWT under the new API-key scheme) vs the
  vault's legacy-JWT `service_role_key`. → `verify_jwt` 401.

Dead ends ruled out (do not re-investigate): RLS on `push_tokens` (policy is
correct), `audit_log` schema/identity (fine), Expo dispatch itself (works),
the `recordOutcome` writer (works when the handler runs).

---

## Fixes

### ① Registration lifecycle — `fix(push): register token on auth + foreground`
- New hook `apps/mobile/src/hooks/usePushRegistration.ts`: registers on the
  unauthenticated→authenticated transition and re-registers on `AppState`
  `active`. Idempotent (single in-flight promise). 5 unit tests.
- `RootNavigator` now calls `usePushRegistration(status === 'authenticated')`
  instead of the mount-only `registerForPushNotifications()`.
- **Status:** committed, merged to `main`. **Reaches devices only on a new
  build (v5).**

### ② send-push function-to-function auth — `fix(push): unblock send-push … (verify_jwt 401)`
- `send-push` deployed with **`verify_jwt=false`** and re-locked with an
  **internal shared secret**: `supabase/functions/_shared/internal-auth.ts`
  (`LEIKO_INTERNAL_PUSH_SECRET` function secret — set in prod, never in repo).
  Callers attach the `x-leiko-internal` header via `withInternalHeader()`;
  `send-push` rejects anything without it (`isAuthorizedInternal`, **fails
  closed** if the secret is unset). 4 unit tests.
- Updated all four callers: `request-sync`, `request-stale-syncs`,
  `detect-anomaly`, `manage-family-membership`. (This repairs **anomaly** and
  **family** pushes too — they shared the broken hop.)
- **Status:** committed, merged to `main`, **DEPLOYED to prod**, and
  **proven** (`requested:1` + `push.sent`).

### ③ "audit telemetry write" — NOT a bug
The earlier zero `push.*` rows were a symptom of ②. `recordOutcome` writes
correctly once the handler runs. Closed.

---

## Prod changes made 2026-06-10 (founder-authorized)

| Change | Detail |
|---|---|
| Function secret set | `LEIKO_INTERNAL_PUSH_SECRET` (random 32-byte hex; value only in Supabase) |
| `send-push` redeployed | **v13, `verify_jwt=false`** + internal-auth gate |
| `request-sync` redeployed | v3 (verify_jwt=true) — sends `x-leiko-internal` |
| `request-stale-syncs` redeployed | v3 (verify_jwt=true) — sends `x-leiko-internal` |
| `detect-anomaly` redeployed | v12 — sends `x-leiko-internal` |
| `manage-family-membership` redeployed | v12 — sends `x-leiko-internal` |

No migrations were added. `pg_net` + the `request-stale-syncs-3h` cron were
already live.

---

## ④ Device delivery + background wake — NOT CONFIRMED (inconsistent)

**Honest status after rigorous testing.** Server side is solid: every fire
returns `{scanned:1, requested:1}` and writes `push.sent` (Expo accepts the
message). But on-device **background wake is not reliably reproduced**:

| Run | App state | Result |
|---|---|---|
| 71 | **foreground** | BLE sync activity +4s — ambiguous (foreground syncs anyway) |
| 73 | backgrounded (unverified) | GC + `GATT_Register` +1s — looked like a wake |
| 74 | **focus NOT verified** (founder had opened the app) | GC + full BLE connect/discover/notify +2s — looked like a wake, but app may have been foreground |
| 75, A, B | backgrounded, **launcher-focus verified**, phone **ACTIVE (not Doze)**, clean baseline (≈quiet) | **NO wake** — 0 app activity within ~40–60s |

Three controlled tests with a verified quiet baseline showed **no** wake, so
the earlier "wakes" (73/74) are most likely **foreground / coincidental
orchestrator sync**, not the push. Net: **the silent push is not
demonstrably waking the backgrounded phone.**

This is the original "#1 unproven thing" (handoff §5.1) and it is **still
unproven**. Leading hypothesis: **Expo accepts the ticket but FCM does not
deliver it to the device** — i.e. the Expo project's **FCM V1 credential for
`com.leiko.care` is wrong/missing**. No FCM-receive log line for `leiko` was
ever observed across any capture, which is consistent with non-delivery.

**To resolve (needs the Expo dashboard / `primethebrain`):**
1. Check the Expo push **receipt** (not the ticket) for a recent send — look
   for `DeviceNotRegistered`, `MismatchSenderId`, or an FCM-credential error.
2. Verify the **FCM V1 service-account key** is uploaded + valid for
   `com.leiko.care` in the Expo project's credentials.
3. As a delivery sanity check, send a **visible** push to the wearer; if no
   banner appears either, FCM delivery is broken project-wide (not just the
   silent path).

Only after FCM delivery is confirmed can the full chain (push → background
wake → BLE pull → new reading) be proven. Use a **fresh unsynced reading on
the watch** as the success signal (`devices.last_sync_at` is a dead field —
see below).

### Side-findings during ④
- **`devices.last_sync_at` is a dead field** — 0 of 2 devices ever have it
  set; the sync path never writes it. Do not use it as a signal; use new
  `readings` rows instead. (Candidate cleanup: populate it on `/sync`, or drop it.)
- **PostHog is 401'ing on device** — logcat shows `API key is not valid:
  personal_api_key`. The build's `EXPO_PUBLIC_POSTHOG_API_KEY` is a *personal*
  API key (wrong type) → all client analytics silently fail, which is also why
  `logger.track` push events were never observable. Separate bug to fix
  (correct project API key) on the next build.

---

## Branch / merge / build state

- All work merged to local `main` (4 merge commits): versionCode
  single-source, prod-db-access runbook, ① registration, ② send-push auth.
  **`main` is ahead of `origin/main` — not yet pushed.**
- **Prod is running ② from the branch/merge, so `main` must be pushed** to
  keep the repo and prod in sync.
- **v5 build is blocked on this machine: no release keystore.** It lives in
  1Password ("Leiko Android Release Keystore") as `~/secrets/leiko-release.jks`
  and does not travel with a machine migration (handoff §1d). To build v5:
  restore the keystore + signing env, set `LEIKO_VERSION_CODE=5`, then
  `npm run release:android:apk` (sideload) or `:aab` (Play). See
  `docs/release/android-release.md`.

## Retest plan (once v5 is built)

1. `adb install -r leiko-…-vc5.apk` on both phones — **upgrade-install**
   (release-signed, same keystore) so state + the registered token survive.
   Do **not** uninstall.
2. Verify ① automatically: sign-in (no relaunch hack) should populate
   `push_tokens` for the wearer (and the caregiver once notifications are
   granted on that phone — currently denied).
3. Connect the watch to the wearer. Caregiver → tap the wearer's node →
   `ParentDashboard` → pull-to-refresh.
4. Watch `audit_log.push.sent`, `devices.last_sync_at`, and a new reading.
   Server path is already proven; this confirms ④ (device delivery + sync).

## How to verify any of this
`docs/release/prod-db-access.md` + `tools/prod-sql.py` (Management API + PAT).
Memory: `edge-fn-verify-jwt-new-api-keys`, `supabase-prod-backend`.
