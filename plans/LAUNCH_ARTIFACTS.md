# Launch Artifacts Log

Authoritative record of build artifacts produced for v1.0.0 launch.
Each entry captures: artifact URL, build profile, version code, target
backend, and what it gets used for. Sensitive creds (keystore
password / alias / key password) live in 1Password as
"Leiko Android Release Keystore" — never in this file.

Update this log every time a new build artifact is produced.

---

## Android

### v1.0.0 (versionCode 2) — production `.aab` for Play Console

| Field | Value |
|---|---|
| **Artifact URL** | https://expo.dev/artifacts/eas/5n4GUMxhcrLa5Z6Cgz9Cqr.aab |
| **EAS profile** | `production` |
| **Build type** | `app-bundle` (Android App Bundle) |
| **versionName** | `1.0.0` |
| **versionCode** | `2` (auto-incremented from `1`) |
| **EAS credentials slot** | `Build Credentials 5ZIwDWM1fJ` (default) |
| **Built** | 2026-05-20 |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Anon key (in binary)** | `eyJ...8aSY` (last 4 chars — full key in `eas.json` production env, public by design) |
| **Status** | Awaits upload to Play Console → Internal Testing track |
| **Used for** | Submitting to Play Store via `eas submit` or manual upload. Not directly installable on a phone — `adb install` rejects AAB. |

### v1.0.0 (versionCode 3) — production-apk `.apk` for bench install

| Field | Value |
|---|---|
| **Artifact URL** | https://expo.dev/artifacts/eas/kQ5uMNfwz7P6517WuvkAbW.apk |
| **Build logs** | https://expo.dev/accounts/lawone-apps/projects/leiko/builds/a0941b42-c9bf-47ac-b2b7-6c64d59acf0a |
| **EAS profile** | `production-apk` (extends `production`, overrides `buildType: apk`) |
| **Build type** | `apk` (single-file install) |
| **versionName** | `1.0.0` |
| **versionCode** | `3` (auto-incremented after the AAB's `2`) |
| **EAS credentials slot** | Same as the AAB above |
| **Built** | 2026-05-20 |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Status** | Built; installed on Phone 1; signup walked end-to-end. **Superseded** by v4 below (containing the 9 audit-pass fix buckets). |
| **Used for** | First-pass smoke test on Phone 1. Revealed 9 buckets of bench bugs, all closed in commits `8d8000b` → `316301a`. |

### v1.0.0 (versionCode 11) — production-apk `.apk` with Block 8 onboarding-recovery hotfix

| Field | Value |
|---|---|
| **Artifact URL** | ⏳ Build in progress |
| **Build logs** | https://expo.dev/accounts/lawone-apps/projects/leiko/builds/fae73445-d485-4e6a-b0cb-736b1288aaed |
| **Build ID** | `fae73445-d485-4e6a-b0cb-736b1288aaed` |
| **EAS profile** | `production-apk` |
| **Build type** | `apk` |
| **versionName** | `1.0.0` |
| **versionCode** | `11` (auto-incremented from `10`) |
| **Built** | 2026-05-24 evening (queued) |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Branch tip when built** | `ba90a1d` |
| **Bundles** | Carries everything in v7 (vc10) plus: Block 8 onboarding-recovery hotfix (checkOnboardingState now uses get_user_onboarding_state() SECURITY DEFINER RPC instead of direct family_members query; bypasses RLS timing / supabase-js quirks; also seeds MMKV.currentFamilyId from the server so the user lands in the right family on fresh install) |
| **Migration dependency** | `0026_get_user_onboarding_state.sql` MUST be applied to prod first — applied 2026-05-24 evening |
| **Used for** | Phone 1 fresh-install retest (replaces v7 install which was stuck routing through onboarding for lawonecloud) |

### v1.0.0 (versionCode 10) — production-apk `.apk` bundling Sprint 19 close-out + doctor PDF v2

| Field | Value |
|---|---|
| **Artifact URL** | ⏳ Build in progress |
| **Build logs** | https://expo.dev/accounts/lawone-apps/projects/leiko/builds/6d59adad-530b-42c1-b53a-2e72015afe50 |
| **Build ID** | `6d59adad-530b-42c1-b53a-2e72015afe50` |
| **EAS profile** | `production-apk` |
| **Build type** | `apk` |
| **versionName** | `1.0.0` |
| **versionCode** | `10` (auto-incremented from `9`) |
| **EAS credentials slot** | Same as v3 / v4 / v5 / v6 |
| **Built** | 2026-05-24 (queued) |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Branch tip when built** | `bcde4f9` |
| **Bundles** | Carries everything in v6 (vc9) plus: Android Share.share URL-in-message fix (PDF link actually shares to Android targets now); doctor PDF v2 — all 10 founder-review items (activity steps bug fix, sufficiency flags, per-vital clinical-context paragraphs, cover Executive Summary, BP-flag chips, cross-vital sufficiency footnote, running page header, layout density, reference footnotes, structured clinical-context fields on the For Your Doctor screen) |
| **Migration dependency** | None new (`0024_caregiver_relationship_label.sql` + `0025_storage_reports_bucket.sql` already applied to prod) |
| **Edge Function dependency** | `generate-doctor-pdf` already deployed at v13 carrying the v2 template + rasterizer X-API-Key fix |
| **Used for** | Phone 1 in-place upgrade — bench-test the redesigned doctor PDF end-to-end (generate, share to Android target, open the PDF, verify Executive Summary + clinical-context paragraphs + flag chips render with real data) |

### v1.0.0 (versionCode 9) — production-apk `.apk` bundling Sprint 19 (multi-account + caregiver model)

| Field | Value |
|---|---|
| **Artifact URL** | https://expo.dev/artifacts/eas/25T2boRd5neco7rDC2gYDN.apk |
| **Build logs** | https://expo.dev/accounts/lawone-apps/projects/leiko/builds/08c78e5e-f17b-4122-8419-8ce434659c18 |
| **Build ID** | `08c78e5e-f17b-4122-8419-8ce434659c18` |
| **EAS profile** | `production-apk` |
| **Build type** | `apk` |
| **versionName** | `1.0.0` |
| **versionCode** | `9` (EAS ledger advanced 6 → 9 across retries for transient GraphQL errors before the queue succeeded; vc7 + vc8 never produced artifacts) |
| **EAS credentials slot** | Same as the AAB / APK v3 / APK v4 / APK v5 |
| **Built** | 2026-05-23 |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Branch tip when built** | `ed0179f` |
| **Bundles** | Sprint 18 audit fixes (v4) + Sprint 18 sleep wake-time fix (v5) + Halo Ember icon (v5) + Sprint 19 Blocks 1-7: SELF-label hidden, +Add owner-gate, Care-for-another-person flow, Edit-family-details, Account switcher, Per-caregiver relationship label (with prod migration `0024_caregiver_relationship_label.sql` applied), real APP_VERSION + leiko.health URLs |
| **Migration dependency** | `0024_caregiver_relationship_label.sql` MUST be applied to prod before install — verified 2026-05-23 via SQL probe (column exists, type=text, nullable=YES) |
| **Edge Function redeploy** | `accept-family-invite` SHOULD be redeployed so v6's `caregiverRelationshipLabel` body field is honored; pending founder ops |
| **Used for** | Phone 1 in-place upgrade install; Phone 2 retest of caregiver invite flow with the relationship-label chip |

### v1.0.0 (versionCode 6) — production-apk `.apk` bundling sleep fix + Halo Ember icon

| Field | Value |
|---|---|
| **Artifact URL** | https://expo.dev/artifacts/eas/4VVXDDJ94EJagv53T1ymbw.apk |
| **Build logs** | https://expo.dev/accounts/lawone-apps/projects/leiko/builds/1fd316e9-0e6f-4e1d-9daf-bd157d5aea92 |
| **EAS profile** | `production-apk` |
| **Build type** | `apk` |
| **versionName** | `1.0.0` |
| **versionCode** | `6` (EAS remote ledger bumped from `5` — an interim build burned vc5 between v4 and this one; ledger advances even for cancelled / failed builds) |
| **EAS credentials slot** | Same as the AAB / APK v3 / APK v4 |
| **Built** | 2026-05-22 |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Status** | Queued. Two source commits on `claude/competent-goldberg-737194`: `8959347` (sleep wake-time fix via HR-derived inference) + `49a65fa` (Halo Ember launcher icon + Android adaptive icon). |
| **Branch tip when built** | `49a65fa` |
| **Why we're skipping v4 install** | Phone 1 is on v3; jumping straight to v5 lets us upgrade in one cycle (v3 → v5) instead of two (v3 → v4 → v5). v4 APK was downloaded by founder but never installed. |
| **Bundles** | All 31 audit findings from v4 + Sprint 18 sleep wake-time fix (HR-inferred wake + tz-aware display + Option-B historical backfill) + Halo Ember launcher icon (legacy mipmaps × 5 densities + Android adaptive icon layers + descriptors) |
| **Used for** | Phone 1 in-place upgrade install; full regression of 5 vital detail screens + the 9 audit-pass buckets + sleep wake-time spot-check + launcher icon eyeball |

### v1.0.0 (versionCode 4) — production-apk `.apk` with audit-pass fixes — superseded by v5

| Field | Value |
|---|---|
| **Artifact URL** | https://expo.dev/artifacts/eas/bnwdtRMddqpEgpRsKt9xpS.apk |
| **Build logs** | https://expo.dev/accounts/lawone-apps/projects/leiko/builds (find by tip `316301a`) |
| **EAS profile** | `production-apk` |
| **Build type** | `apk` |
| **versionName** | `1.0.0` |
| **versionCode** | `4` (autoIncrement from previous v3) |
| **EAS credentials slot** | Same as the AAB / APK v3 |
| **Built** | 2026-05-22 |
| **Target backend** | prod Supabase `kqnzxjrpnjnczhgdwdqg.supabase.co` |
| **Status** | Built; **NOT installed** — founder chose to skip ahead to v5 to bundle the sleep wake-time fix + icon in one upgrade cycle. APK file lives at `%USERPROFILE%\Downloads\leiko-v1.0.0-vc4.apk` on the founder's machine in case v5 has issues and we need to fall back. |
| **Branch tip when built** | `316301a` (audit-pass complete; next commit was `2919a71` docs only) |
| **Bundles 31 audit findings** | SelfBuyerHome pair-watch · ReadingDetail back/close · Settings refresh · Sleep/HR/BP/SpO2/Activity full audits · ParentDashboard load/error · ghost-button removal |
| **Used for** | Block 4 re-smoke-test on Phone 1 + full regression of the 5 vital detail screens; if clean, this is the artifact that goes to internal-beta testers via Drive link. |

---

## iOS

_No iOS builds yet — Block 6.1 Apple Developer entitlements + `expo prebuild --platform ios` (needs a Mac) must land first. Track on next addition._

---

## Submission state

| Store | Track / Tier | Status | First submission |
|---|---|---|---|
| Play Store | Internal Testing | ⏳ Not yet uploaded | TBD |
| Play Store | Closed Testing (Alpha) | ⏳ Not yet | TBD |
| Play Store | Production | ⏳ Not yet | TBD |
| App Store | TestFlight Internal | ⏳ Awaits iOS build | TBD |
| App Store | TestFlight External | ⏳ Awaits iOS build | TBD |
| App Store | Production | ⏳ Not yet | TBD |

---

## Notes

- **AAB vs APK:** Play Store wants AAB (smaller install footprint, per-device APK splitting). adb wants APK (single-file install). Same keystore signs both — they're equivalent artifacts from a signing-identity perspective.
- **Auto-increment behaviour:** `eas.json` has `cli.appVersionSource = remote` and `production.autoIncrement = true`. Every prod build bumps versionCode by 1 in EAS's remote ledger. Don't manually edit `android/app/build.gradle:96` versionName — `app.json:5` (currently `1.0.0`) is the source of truth and EAS propagates it.
- **Anon key in binary is fine:** `EXPO_PUBLIC_SUPABASE_ANON_KEY` ships in every APK; it's a public client key, RLS is the actual security boundary. Service role key, DB password, third-party API keys never enter the binary — they're in supabase secrets (server-side) + GitHub Actions secrets (CI).
- **Keystore loss = nuclear:** If `Build Credentials 5ZIwDWM1fJ` is lost AND the 1Password backup is gone, the app can never be updated on Play Store again. Two layers of redundancy already (EAS Cloud + 1Password); a third on an encrypted external drive would not be overkill.
