# Start here — Sprint 18 mid-session pause (2026-05-22 PM)

Last touched: 2026-05-22 evening Lagos. Supersedes the 2026-05-22 AM
handoff (which was itself a fresh rewrite). Branch:
`claude/competent-goldberg-737194`. Latest tip: `e70d4ed` (check
`git log -1` for newer).

**Why we paused:** the previous session hit 92% context. All
state is preserved across the docs below; a new session should
read CLAUDE.md → this file → the linked briefs and resume cleanly.

## 60-second context

Sprint 18 closed 31 audit findings across 9 commits over 2026-05-21/22.
The v4 APK (`bnwdtRMddqpEgpRsKt9xpS.apk`, versionCode 4) was built end
of session and is ready to install on Phone 1. Founder paused
mid-install-flow to investigate **two newly-discovered issues that
must ship together as v5**:

1. **Sleep wake-time is always 9 AM in Lagos.** Root-caused: the
   U16PRO 0x07 sleep packet has no real wake time. The app
   synthesizes `sessionEnd = day_UTC_midnight + 8h = 08:00 UTC`,
   which formats as 09:00 in Lagos (UTC+1), 03:00 in NYC (UTC-5),
   etc. Same hardcoded-UTC pattern lives in 4-5 spots in
   `syncMultiVitals.ts`. Founder chose **Option B** (HR-derived
   wake inference + timezone consolidation). Full brief at
   **`plans/SLEEP_TIMEZONE_FIX_BRIEF.md`** — read this BEFORE
   touching code.

2. **App ships with no icon.** Five logo concepts were generated
   earlier this session (`branding/concepts/`). Founder is choosing
   between **Direction 1 — Two figures forming a heart** and
   **Direction 4 — Sankofa heart**. Icon-tuned finalists are
   rendered at all Android mipmap sizes + circular-mask preview in
   **`branding/finalists.png`**. Awaiting founder pick. Once picked:
   bake into `apps/mobile/android/app/src/main/res/mipmap-*` + add
   adaptive icon foreground + update `app.json`. **Do NOT run
   `expo prebuild`** — it stomps three load-bearing customizations
   (see `memory/expo_prebuild_android_drift.md`).

## v4 APK install state

The user downloaded the v4 APK (`leiko-v1.0.0-vc4.apk`, 99.7 MB) to
`%USERPROFILE%\Downloads\`. They ran:
- `adb devices` → `43230DLJH001YY device` ✓
- `adb install -r leiko-v1.0.0-vc3.apk` → Success (re-installed v3
  from the prior session — possibly accidental; v3 has all the
  audit bugs)
- Downloaded v4

They have NOT yet run `adb install -r leiko-v1.0.0-vc4.apk` to put
v4 on the device. They paused the install flow to investigate the
sleep bug instead.

**If you resume the v4 install path:** the command is
`adb -s 43230DLJH001YY install -r $env:USERPROFILE\Downloads\leiko-v1.0.0-vc4.apk`.
`-r` reinstalls keeping data; same keystore so the upgrade is
in-place.

**But the better plan** (founder agreed): hold v4 install until v5
is built — that way Phone 1 jumps straight from v3-with-bugs to
v5-with-everything (audit fixes + sleep fix + icon) in one cycle,
not two.

## What the next session does

In this order:

### 1. Get the founder's icon pick

If they haven't responded, gently re-ask using the finalist sheet
(`branding/finalists.png`). Two finalists: Direction 1 (Two
figures) vs Direction 4 (Sankofa).

### 2. Read the sleep brief in full

`plans/SLEEP_TIMEZONE_FIX_BRIEF.md` — contains:
- Exact line numbers for the synthesis bug
- Where the display formatters also need fixing
- Audit confirmation that the user's tz IS captured + stored (just
  not consulted at the sync ingest path)
- Full scope for the one-commit fix
- Acceptance criteria
- 6 test cases to write

### 3. Execute the sleep fix in source

Estimated 3-4 hours. One commit on `claude/competent-goldberg-737194`.
Don't merge to main yet.

### 4. Execute the icon work in source

~30-60 minutes once direction is picked. Replace 5 mipmap PNGs +
add adaptive icon XML + update app.json. Commit separately.

### 5. Kick the v5 APK build

`cd apps/mobile && npx eas-cli build --platform android --profile production-apk`

Auto-increments to versionCode 5. Update `plans/LAUNCH_ARTIFACTS.md`
with the URL when it lands.

### 6. Phone 1: install v5, retest

Walks `SPRINT_18_VERIFICATION.md` tests 1-5 + regression-checks the
9 audit-pass buckets + verifies the sleep wake time is now correct
+ confirms the icon renders.

## What's done (don't redo)

| Item | Commit | Status |
|---|---|---|
| Day 1 SEC-1 — MMKV encryption | `7d0455e` | ✅ shipped |
| Day 2 OPS-1 migrations to prod | (founder) | ✅ |
| Day 2 OPS-2 pg_cron via Vault | `0d6d228` + `19e1ea8` | ✅ |
| Day 2 OPS-11 Edge Function secrets | (founder) | ✅ |
| Day 2 OPS-12 EAS prod profile | `794d9f3` | ✅ |
| Day 2 17 Edge Functions deployed | (founder) | ✅ |
| Day 2 Block 5 GH Actions secrets | (founder) | ✅ |
| Day 2 Block 3 AAB build | `5n4G...` | ✅ Play upload pending |
| Day 2 Block 3 APK v3 build | `kQ5u...` | ✅ installed on Phone 1 (with bugs) |
| 31 audit findings — 9 commits | `8d8000b → 316301a` | ✅ source-only |
| Doc sweep + handoff | `2919a71` | ✅ |
| v4 APK build | `bnwdtRMddqpEgpRsKt9xpS` | ✅ downloaded; NOT installed |

## What's still pending after v5

- **Block 6.1** Apple Developer entitlements (HealthKit + Background
  + Push + Associated Domains) — 24-72h Apple clock
- **Block 6.2** App Store Connect listing + 2 IAPs — 1-3 day approval
- **Block 6.3** Play Console listing + 2 subscriptions — 1-3 day
- **Block 6.4** DNS for `leiko.app` + `pair.leiko.app` + AASA +
  assetlinks hosting — 1-24h propagation
- **Block 6.5** Resend domain verification (post Block 6.4) — replaces
  `onboarding@resend.dev` sandbox with `noreply@leiko.app`; removes
  the per-account sender restriction
- **iOS** `expo prebuild --platform ios` + APNs/FCM upload (needs Mac)
- **RevenueCat** signup + IAP wiring (gated on Apple/Play IAP approval)
- **SPRINT_18_VERIFICATION.md** tests 1-5 on real hardware

## Bench environment

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

Re-apply adb reverses every USB unplug/replug:
```
adb -s 43230DLJH001YY reverse tcp:8081 tcp:8081
adb -s 43230DLJH001YY reverse tcp:54321 tcp:54321
adb -s 43230DLJH001YY reverse tcp:54324 tcp:54324
adb -s 8fae80bc       reverse tcp:8081 tcp:8081
adb -s 8fae80bc       reverse tcp:54321 tcp:54321
adb -s 8fae80bc       reverse tcp:54324 tcp:54324
```

Metro (the env var is non-negotiable):
```
cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client
```

Edge Functions:
```
supabase functions serve --env-file supabase/functions/.env
```

## Bench state

- **Phone 1** (Pixel 8, `43230DLJH001YY`) — running APK v3 (versionCode
  3) signed up as `tawokels@gmail.com`. All Sprint 18 audit fixes
  are NOT on this APK. v4 downloaded but NOT installed (paused
  pending v5 to do single upgrade cycle).
- **Phone 2** (OnePlus Nord N30, `8fae80bc`) — untouched this session.

## Hard rules carried forward

1. **`expo prebuild` stomps three Android customizations** —
   `minSdkVersion=26` in build.gradle, `xmlns:tools` + BLUETOOTH_SCAN
   neverForLocation in manifest, `bluetooth_le` uses-feature. Plus
   it adds a malformed `data-generated="true"` attribute on the
   autoVerify filter. **Do not run prebuild for the icon bake.**
   Manually edit the mipmap directories instead. See
   `memory/expo_prebuild_android_drift.md`.
2. **Sleep timestamps are synthesized as 08:00 UTC** — that's the
   bug we're fixing. Don't reproduce the pattern anywhere else.
3. **`profile.timezone` is the source of truth for display
   formatting** — never use `[]` as the locale arg to
   `toLocaleTimeString()`. Use the new `useUserTz()` helper.
4. **Two FK-embed traps** — `family_members` has two FKs to
   `users` (`user_id` + `invited_by`). Always disambiguate to
   `users!family_members_user_id_fkey(...)`.
5. **audit_log INSERT requires service_role** — client `authenticated`
   role can READ but never INSERT. Audit emits go through Edge
   Functions.
6. **pg_cron config is in Supabase Vault, not GUCs** — migration
   0023. `functions_base_url` is the project ROOT
   (`https://<ref>.supabase.co`), NOT `.../functions/v1`.
7. **`onboarding@resend.dev` sandbox sender can only deliver to
   `tawokels@gmail.com`** until Block 6.5 lands real domain
   verification.
8. **Dark mode is the default**; **`account_type` is immutable**.

## Memory close-out from this session

- `memory/sprint_18_audit_pass_close_out.md` — full AP1–AP10 catalogue
  + single-source-of-truth template for the caregiver-scoped
  load/error pattern. Read this BEFORE adding any new vital-detail
  screen or correlation strip or comparative copy.

## Open prompt for the new session

> Sprint 18 mid-session pause at 92% context. Branch tip `e70d4ed`.
> Read CLAUDE.md, then `plans/NEXT_SESSION_START_HERE.md` (this
> file), then `plans/SLEEP_TIMEZONE_FIX_BRIEF.md` in full.
>
> Two pieces of work to land in source for v5 APK:
> 1. **Sleep wake-time fix** — Option B (HR-derived inference) +
>    timezone consolidation. ~3-4h. Brief is fully scoped at
>    plans/SLEEP_TIMEZONE_FIX_BRIEF.md including acceptance
>    criteria + test cases.
> 2. **Logo icon bake** — founder picks Direction 1 vs Direction 4
>    from branding/finalists.png; then replace 5 mipmap PNGs +
>    add adaptive icon + update app.json. DO NOT RUN PREBUILD.
>    ~30-60 min once direction is picked.
>
> Once both land in source, kick the v5 APK build, update
> plans/LAUNCH_ARTIFACTS.md with the URL, hand off to founder for
> Phone 1 install + retest.
