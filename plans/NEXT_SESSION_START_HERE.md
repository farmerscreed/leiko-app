# Start here — Sprint 18 handoff (2026-05-22 PM)

Last touched: 2026-05-22 Lagos. Supersedes the 2026-05-20 handoff.
Branch: `claude/competent-goldberg-737194`. Latest tip: `316301a`
(check `git log -1` for newer).

## 90-second context

Sprint 18 has been in motion for ~48 hours. **All engineering work is
done**; the gating items are now founder-ops + bench verification.

### What's shipped in source on this branch

**Day 1 — SEC-1 (MMKV encryption at rest)** — `7d0455e`

**Day 2 — Founder ops blitz** — completed end-to-end via founder + me:
- OPS-1 migrations applied to prod (`kqnzxjrpnjnczhgdwdqg`)
- OPS-2 pg_cron config via Supabase Vault (migration `0023` replaced
  the GUC-based config that hosted Supabase blocked; `0d6d228` /
  `19e1ea8`)
- OPS-11 6 Edge Function secrets set (Anthropic / Resend / PDF×2 /
  AI_TIER flags)
- OPS-12 EAS production profile pointed at prod Supabase (`794d9f3`)
- 17 Edge Functions deployed; `ai-tier-b` smoke-curl 200
- Block 5 GitHub Actions secrets + `production` environment with
  required-reviewer gate
- Block 3 AAB built (versionCode 2, `5n4GUMxhcrLa5Z6Cgz9Cqr.aab`)
- Block 4 APK built (versionCode 3, `kQ5uMNfwz7P6517WuvkAbW.apk`),
  installed on Phone 1, signup walked end-to-end

**Day 2-3 — Bench bugs surfaced + fixed in source** — 9 buckets:

| # | What broke | Commit |
|---|---|---|
| 1 | SelfBuyerHome had no inline "Pair your watch" CTA — sparse-tracker users dead-ended | `8d8000b` |
| 2 | ReadingDetail back/close trap (3 separate root causes: tiny text Back, in-scroll, push-not-replace) | `6de2632` |
| 3 | Settings → Profile showed `—` for everything because `useAuth.profile` wasn't refreshed after onboarding DB writes | `e41745d` |
| 4 | **SleepDetail audit** — 6 findings (loading/error, fresh-label guard, chart width, history-aware copy, correlation placeholder) | `ff4ece8` |
| 5 | **HRDetail audit** — 9 findings (loading/error, date-aligned correlation, label clarity, "Last 24h" caption, history-aware copy, stable nowSec) | `d53a66f` |
| 6 | **BPDetail audit** — 6 findings (loading/error, freshness gate on 'now', share-row wiring, no-readings-today placeholder, hero/row time formatting) | `a4ac261` |
| 7 | **SpO2Detail audit** — 3 findings (loading/error, correlation date-pair, Lowest single-source) | `1662ca8` |
| 8 | **ActivityDetail audit** — 1 finding (loading/error) | `8b28165` |
| 9 | **Production-readiness audit** — ParentDashboard loading/error + removed 3 ghost buttons on ReadingDetail | `316301a` |

**31 separate audit findings closed across 9 commits.** Every code-side
launch-readiness bug discoverable from desk-side review is fixed.

### Also done

- `plans/LAUNCH_ARTIFACTS.md` — single source of truth for build URLs +
  store submission state
- `plans/LAUNCH_DAY2_CHECKLIST.md` — tick-as-you-go founder runbook
  (corrected for the Vault path; was originally GUC-based)
- `plans/FOUNDER_OPS_PLAYBOOK.md` — long-form CLI reference (same
  correction)
- `branding/` — 5 logo concept directions + Hearth Tender philosophy
  (waiting on founder pick before final icon export)

## Bench state right now

- **Phone 1** (Pixel 8, `43230DLJH001YY`) — running APK v3 (versionCode
  3). Signed up as `tawokels@gmail.com` (the Resend-account-owning
  email; needed because the sandbox `onboarding@resend.dev` sender
  can only deliver to the account owner until DNS-verified). All
  Sprint 18 source fixes are NOT on this APK — they're queued for
  the next build cycle.
- **Phone 2** (OnePlus Nord N30, `8fae80bc`) — untouched today.

## What the next session needs to do

The user just kicked off a new EAS `production-apk` build at the close
of the 2026-05-22 session. The branch tip is `316301a`. When the build
completes:

1. **Update LAUNCH_ARTIFACTS.md** with the new APK URL + versionCode
   (will be 4 if it auto-incremented from the v3 we built earlier).
2. **Install on Phone 1** — uninstall the v3 APK first (SEC-1 will
   migrate the encrypted MMKV; the SEC-1 migration is the test case
   for users with existing data, but Phone 1 only has prod data so
   the migration should be a clean upgrade).
3. **Walk SPRINT_18_VERIFICATION.md again** with the new APK in hand.
   FUN-7 / FUN-8 / QUA-1 / QUA-2 / QUA-3 each get a PASS/FAIL row.
4. **Re-test the 31 source fixes** — at minimum the 5 vital-detail
   screens (load/error states, range pills, correlation strips,
   history-aware copy), the SelfBuyerHome pair-watch prompt, the
   ReadingDetail Back+Done flow, Settings Profile populating after
   onboarding, the ghost buttons being gone.
5. **Catch any remaining bench bugs** the v3 round of testing missed.

## Still pending (NOT engineering)

| Item | Driver | ETA |
|---|---|---|
| Resend domain verification | Founder | When `leiko.app` DNS is up (Block 6.4) |
| Apple Developer HealthKit + Background + Push entitlements | Founder | 24-72h Apple clock after enabling |
| App Store Connect listing + 2 IAPs | Founder | 1-3 day approval |
| Play Console listing + 2 subscriptions | Founder | 1-3 day approval |
| DNS: `leiko.app` + `pair.leiko.app` + AASA + assetlinks hosting | Founder | 1-24h propagation |
| iOS `expo prebuild --platform ios` | Founder (needs a Mac) | Day 3+ |
| RevenueCat signup + IAP wiring | Founder | Blocked on Apple/Play IAP approval |
| Logo pick + icon export | Founder taste + me | Whenever you decide |

## Bench environment

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

Re-apply adb reverses on every USB unplug/replug:
```
adb -s 43230DLJH001YY reverse tcp:8081 tcp:8081
adb -s 43230DLJH001YY reverse tcp:54321 tcp:54321
adb -s 43230DLJH001YY reverse tcp:54324 tcp:54324
adb -s 8fae80bc       reverse tcp:8081 tcp:8081
adb -s 8fae80bc       reverse tcp:54321 tcp:54321
adb -s 8fae80bc       reverse tcp:54324 tcp:54324
```

Metro launch (the env var is **non-negotiable**):
```
cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client
```

Edge Functions:
```
supabase functions serve --env-file supabase/functions/.env
```

## Hard rules carried forward

1. **expo prebuild stomps 3 Android customizations** — `minSdkVersion=26`
   in build.gradle, `xmlns:tools` + `BLUETOOTH_SCAN
   neverForLocation` in manifest, `bluetooth_le` uses-feature.
   Restore by hand after every prebuild. Plus the malformed
   `data-generated="true"` on autoVerify filters needs pruning.
   See `memory/expo_prebuild_android_drift.md`.
2. **Two FK-embed traps** — listMembers + listCaregivers both burnt us
   with PGRST201 because `family_members` has two FKs to `users`
   (`user_id` + `invited_by`). Disambiguate to
   `users!family_members_user_id_fkey(...)` every time.
3. **audit_log INSERT requires service_role** — client-side
   `authenticated` role can READ but never INSERT. Audit emits go
   through an Edge Function.
4. **Visibility enforcement requires BOTH layers** — server RLS
   (migration 0022) AND client purge hook (`useEnforceVisibility`).
5. **Dark mode is the default** — don't reintroduce `'system'`.
6. **`account_type` is immutable** — two-phone testing requires two
   real accounts.
7. **`onboarding@resend.dev` sandbox sender can only deliver to the
   Resend-account-owning email** — for now `tawokels@gmail.com`.
   Switching to `noreply@leiko.app` is gated on Block 6.4 DNS + Resend
   domain verification.
8. **pg_cron config is in Supabase Vault, not GUCs** — hosted
   Supabase denies `ALTER DATABASE postgres SET app.settings.*`
   with 42501. Migration 0023 switched the four cron helpers to
   read from `vault.decrypted_secrets`. `functions_base_url` is the
   project ROOT (`https://<ref>.supabase.co`), NOT `.../functions/v1`
   — the helpers append the path themselves.

## Background processes

If the next session starts cold, restart both:
- Metro: `cd apps/mobile && EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo start --dev-client`
- Edge Functions: `supabase functions serve --env-file supabase/functions/.env`

## Open prompt (what to say to the next session)

> Sprint 18 audit-pass complete. APK v4 build was kicked off at end of
> last session. Read CLAUDE.md, then this file. Then check
> `plans/LAUNCH_ARTIFACTS.md` for the new APK URL (founder will paste
> when the build finishes).
>
> Next: install on Phone 1, walk SPRINT_18_VERIFICATION.md, retest the
> 31 source fixes from the 9 audit commits, surface any remaining
> bench bugs. After that, the gating items are all external-clock
> founder-ops (Apple, Play, DNS, RevenueCat) — see the
> Still-pending table in this file.
