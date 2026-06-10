# Device-Migration Handoff — continue Leiko on another computer

**Written:** 2026-06-10 · **Repo:** `farmerscreed/leiko-app` · **Branch:** `main` @ `bc1b3a0`
**Purpose:** everything needed to pick up Leiko development on a *different machine* —
what's committed, what is NOT (and must be carried by hand), what's live in prod,
and what to do next.

> Read this top-to-bottom once. Then read the three memory files linked at the
> bottom. Then you're current.

---

## 0. TL;DR — where we are right now

- **`main` is clean and pushed** (synced with `origin/main`, nothing uncommitted that matters).
- We just finished the **"remote-refresh silent push"** feature (3 phases) + the
  **corporate-account / FCM migration**, and packaged it into the **v4 AAB**
  (versionCode 4, package `com.leiko.care`, corporate Play account).
- **Server side is fully LIVE** in prod (edge functions deployed, migrations applied,
  crons firing). **Client side ships in v4.**
- **The ONE thing still unproven:** does the silent push actually wake a
  backgrounded / killed wearer phone and trigger a BLE sync? That's the next
  validation. Everything is in place to test it.

---

## 1. Get the new machine ready

### 1a. Clone + install
```
git clone https://github.com/farmerscreed/leiko-app.git
cd leiko-app
npm install            # root (workspace)
# Expo CLI MUST run from apps/mobile — never repo root (metro serverRoot breaks)
cd apps/mobile && npx expo install
```

### 1b. Toolchain (match these — pins live in `docs/00-tech-stack.md`)
| Tool | This machine | Notes |
|---|---|---|
| Node | **24.15.0** | Active LTS, ADR-0001. Don't use 22. |
| npm | 11.12.1 | |
| Java/JDK | **17** (17.0.19) | Required for the Android Gradle build. |
| Expo SDK | **54** (CLI 54.0.23) | Bare workflow, New Architecture on. |
| EAS CLI | 2.98.x | `npm i -g eas-cli` then `eas login`. |
| Supabase CLI | via Scoop | for local stack + `functions deploy`. |
| Android SDK/NDK | — | install via Android Studio. |

### 1c. ⚠️ Windows-only gotcha (if the new machine is Windows)
**Enable Long Path Support before any `expo run:android` / gradle build** — it's a
silent killer for NDK install + gradle auto-SDK. Registry:
`HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1`.
(See memory `windows_android_setup`.)

### 1d. Secrets & files that do NOT come from git (carry these by hand)
These live **outside the repo** on this machine and are git-ignored. Without them you
can build the debug app but **cannot sign a release AAB or run prod-keyed flows.**

Located in `~/secrets/` on this machine:
| File | What it is | Where the master copy lives |
|---|---|---|
| `leiko-release.jks` | **Android release keystore** — signs every Play upload. Lose this = cannot update the app, ever. | 1Password: "Leiko Android Release Keystore" |
| `leiko-release.ps1` | Sets the release env vars (see below) — `source`/dot it before a release build. | recreate from the var list below + 1Password |
| `revenuecat-play-service-account.json` | RevenueCat ↔ Play service account | RevenueCat dashboard / 1Password |

`leiko-release.ps1` sets these env vars (values in 1Password, **not** here):
```
LEIKO_VERSION_CODE              <- the build number. BUMP before every upload.
LEIKO_RELEASE_STORE_FILE        <- path to leiko-release.jks
LEIKO_RELEASE_STORE_PASSWORD
LEIKO_RELEASE_KEY_ALIAS
LEIKO_RELEASE_KEY_PASSWORD
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_POSTHOG_API_KEY
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
```
`build.gradle` reads these via `System.getenv(...)` (release signing block, lines 125-142;
versionCode line 96). **No env = unsigned/wrong build.**

Also carry the local env files (git-ignored, ~300 bytes each):
- `apps/mobile/.env` and `apps/mobile/.env.local` — local Supabase / dev toggles.
  Rebuild from `apps/mobile/.env.example` + `.env.example` if you don't copy them.

### 1e. Account logins you'll need on the new machine
- **Expo/EAS:** account `primethebrain`, project `@primethebrain/leiko`
  (projectId `84da2214-28a4-4605-941b-64662d72c1bc`). `eas login`.
- **Supabase:** prod project `kqnzxjrpnjnczhgdwdqg` (`supabase login` for CLI deploys).
- **Google Play Console:** the **corporate** account (com.leiko.care). NOT the old
  personal `lawone-apps` account.
- **FCM:** V1 service-account key already uploaded to Expo under `com.leiko.care`.

---

## 2. What the v4 AAB contains (the work we just did)

> ⚠️ **Naming-collision warning:** there's an OLD "v4 APK" (versionCode 4,
> package `com.leiko.app`, personal account, ~2026-05-22) logged in
> `plans/LAUNCH_ARTIFACTS.md`. That is a DIFFERENT, unrelated build. The
> `LAUNCH_ARTIFACTS.md` log is **stale** — it never recorded the corporate-account
> rebuilds. The **v4 we care about** is below.

**v4 AAB = remote-refresh silent push + corporate/FCM migration.**
versionCode 4 · `com.leiko.care` · built 2026-06-10 (local `gradlew bundleRelease`).

### Workstream A — corporate account & FCM (commits)
- `777f26f` rename `com.leiko.app` → `com.leiko.care` (both platforms)
- `7195184` scrub stale `com.leiko.app` references
- `1f6789d` fix `assetlinks.json` SHA fingerprints for the new package
- `18d0ee5` wire FCM via `google-services` for `com.leiko.care`
- `76569b8` + `aea14ce` versionCode → single env-driven source of truth (`LEIKO_VERSION_CODE`)

### Workstream B — remote-refresh silent push (the headline feature)
- `a390af3` **Phase 1 (server):** edge fns `request-sync`, `request-stale-syncs`,
  + `send-push` silent `sync_refresh` branch
- `fa90c5c` **Phase 2 (client):** `remoteRefreshTask.ts` bg receiver → `runSync('remote_refresh')`
- `d2b0f8d` **Phase 3 (UI):** caregiver pull-to-refresh on `ParentDashboard`
- `50364cf` link Expo project, set `extra.eas.projectId` — **root-cause fix** for push
  never working (`push_tokens` table was EMPTY because `getExpoPushTokenAsync()`
  had no project to resolve against)
- `bc1b3a0` vault-based stale-sync cron invoker + **enable `pg_net`**

**Feature in one line:** a remote caregiver taps pull-to-refresh → silent FCM push
wakes the watch-owner's phone → it pulls from the watch over BLE and uploads,
*without the wearer opening the app*. Built to fix the real gap where Android Doze
kills background sync (a test account synced on setup day then went ~23h dark).

**Flow:**
```
caregiver pull-to-refresh → requestRemoteRefresh(familyId) → request-sync
   (authz: caller ∈ family; owner = devices.paired_by_user_id) ─┐
pg_cron every 3h → request-stale-syncs (families_needing_refresh) ─┤
                                                                   ├→ send-push
  data-only {type:'sync_refresh'} silent push (no PHI, _contentAvailable, priority high)
  → Expo → owner phone → remoteRefreshTask OR foreground listener
  → useSyncOrchestrator.runSync('remote_refresh') (bypasses 5s debounce)
  → BLE pull → /sync → Supabase → caregiver sees it via Realtime
```

---

## 3. Backend state — what is LIVE in prod (independent of the app build)

✅ All deployed/applied to `kqnzxjrpnjnczhgdwdqg`:
- 3 edge fns deployed: `send-push` (updated), `request-sync` + `request-stale-syncs` (new)
- Migration `0048` applied — cron `request-stale-syncs-3h` active (every 3h)
- Migrations `0049` (vault-based cron invoker) + `0050` (`create extension pg_net`)
- Expo project linked + FCM V1 key uploaded under `com.leiko.care`

⚠️ **Side effect to know:** installing `pg_net` (it was never installed → every cron
had been silently dying with `schema net does not exist`) also **revived all
previously-dead crons** — `detect-anomaly-nightly`, `compute-correlations`
weekly/monthly. They now fire on schedule for the first time. Watch for unexpected
anomaly pushes / correlation runs.

---

## 4. Local-only state on THIS machine (won't transfer via git)

If you want a *perfect* mirror, also carry these. None are critical to continue, but
noted so nothing is silently lost:
- **Stash** `stash@{0}` on branch `claude/consolidated-build` — "wip edge-function
  edits (vital-types, sync)" — adds `sync.invalid_sample` audit-log rows. Not applied,
  not committed. Founder said leave it.
- **Untracked files** (founder said leave untracked, do NOT commit):
  - `.env.local.dev-only-backup`
  - `plans/db_inventory_2026_05_24.sql`
  - `plans/play-review-demo-seed.sql`
- **3 git worktrees** under `.claude/worktrees/` — disposable, don't carry.
- **Branch `fix/vitals-data-completeness`** was **deliberately HELD** from main by the
  founder. Do not merge it. (`vitals-followups` likewise.)

---

## 5. Open work / direction (do this next, in priority order)

1. **On-device validation of remote-refresh (the #1 unproven thing).**
   Install v4 on a wearer phone, sign in as the test account
   `okpokiribifi@gmail.com` (self_buyer, family `142ad1d0…` — note the `bi` in
   okpokiri**bi**fi, easy to mistype). From a caregiver account in that family, pull
   to refresh on ParentDashboard → confirm the wearer phone syncs.
   **The real risk:** background-wake-from-*killed* (foreground-service-alive is solid;
   fully-killed is best-effort; iOS content-available is throttled).
2. **Confirm v4's install + Play upload status.** Was vc4 actually installed on a
   phone? Was it uploaded to the Play corporate track, or is vc2 (open test,
   2026-06-09) still the live build? Bump `LEIKO_VERSION_CODE` to **5** before the
   next build (vc3 was superseded — no projectId/receiver; vc4 is current).
3. **Reconcile the versionCode story.** `app.json` says `versionCode: 21` but
   `build.gradle` ignores that and reads `LEIKO_VERSION_CODE` env (local gradle builds
   use the env; EAS with `appVersionSource:"local"` would use app.json's 21). These can
   silently disagree — decide one source of truth before the next upload.

---

## 6. Key files map (where everything lives)

**Remote-refresh feature:**
- `supabase/functions/send-push/index.ts` (`sync_refresh` branch) + `_shared/silent-push.ts`
- `supabase/functions/request-sync/`, `supabase/functions/request-stale-syncs/`
- `supabase/migrations/0048_pg_cron_stale_sync_refresh.sql` (+ 0049, 0050)
- `apps/mobile/src/services/notifications/remoteRefreshTask.ts`
- `apps/mobile/src/services/sync/requestRemoteRefresh.ts`
- `apps/mobile/src/services/sync/syncOrchestrator.ts` (`'remote_refresh'` trigger)
- `apps/mobile/src/screens/.../ParentDashboard.tsx` (pull-to-refresh wiring)

**Build / release:**
- `apps/mobile/android/app/build.gradle` (versionCode L96, signing L125-142)
- `apps/mobile/app.json` (projectId L202, versionCode L123, owner=primethebrain)
- `apps/mobile/eas.json` (profiles; `appVersionSource: local`)
- `~/secrets/leiko-release.ps1` (env vars — off-repo)

**Process docs:**
- `CLAUDE.md` — operating manual (read first every session)
- `plans/LAUNCH_ARTIFACTS.md` — build log (⚠️ stale for corporate account)
- `plans/NEXT_SESSION_START_HERE.md` — prior handoff
- `docs/00-tech-stack.md` — version pins (deviations = ADR)

---

## 7. Repo / branch state snapshot (2026-06-10)

- `main` @ `bc1b3a0` — clean, pushed, **newest commit in the repo**.
- All local feature branches are fully pushed (0 unpushed).
- Big "unmerged" commit counts on old branches are **squash-merge artifacts** —
  their content is already on main; they're stale snapshots, safe to ignore.
- `flamboyant-albattani-db1d82` (local-only, no origin) is 0-unmerged vs main —
  fully on main, disposable.

---

## 8. Read these next (persistent memory — same on the new machine)

The memory dir travels with your Claude config, not the repo. Key files for this work:
- `remote_refresh_silent_push.md` — the feature's full activation status & test account.
- `package_rename_corporate_account.md` — package rename, FCM, versionCode, Play account.
- `leiko_studio.md` / `leiko_operator.md` — adjacent in-flight workstreams (ads + ops agent).

**One-line orientation for the next session:** v4 is built and the backend is live;
the job is to validate remote-refresh on a real device and confirm the Play upload —
then bump `LEIKO_VERSION_CODE` to 5 for the next build.
