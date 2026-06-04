> **CLOSED 2026-06-02.** The engineering items in this card shipped; the
> remaining work is the external **founder-ops** blitz (OPS-1..12), which is
> tracked as the live source of truth in `plans/PRODUCTION_READINESS.md` —
> not here. Launch work continued past this card into Sprints 19/20 and the
> ADR-0006/0007 unified-model pivot (merged to `main` as PR #8). Filed under
> `done/` as the historical record.

# Sprint 18 — Launch Readiness Blitz

## Goal

Get Leiko from "founder testing satisfied" to "submittable to both
stores." The visible product is done; what's left is the
launch-gating checklist from `plans/PRODUCTION_READINESS.md` (2026-05-14
audit), minus items 16.6 / 17a / 17b already closed.

Target duration: **1 work-week** (5 focused days).

## Hard dependencies

- Sprints 16.6, 17a, 17b shipped + pushed (verified `d7c5a38` on
  `claude/competent-goldberg-737194`).
- Two-phone bench rig functional (the same setup used through the
  17a + 17b validation).
- Founder availability for the ops blitz day (Day 2) — half of those
  tasks require Apple/Google/RevenueCat dashboards the engineer
  doesn't have access to.

## Docs to load at session start

- `plans/PRODUCTION_READINESS.md` — the launch-gating checklist.
  Status partly stale; cross-reference against the recent close-outs.
- `memory/sprint_17a_close_out.md` + `memory/sprint_17b_close_out.md`
  — most recent product-state context.
- `docs/00-tech-stack.md` — version pins (EAS, Expo SDK, etc).
- `docs/05-voice-and-claims.md` — for any new user-visible string
  (App Store metadata, Support row copy, etc).

## What's already been closed since the 2026-05-14 audit

Confirm against `git log --grep=FUN-` etc. before starting:

| Item | Status | Commit |
|---|---|---|
| **FUN-1** SMTP / email transport for family invites | ✅ | `acf73af` |
| **FUN-2** Hard-delete cron + 30-day SLA | ✅ | `f91ecac` |
| **FUN-4** Reminder dispatcher wired | ✅ | `fcba36a` |
| **CODE-1..6** Audit's code-side P0s | ✅ | various 16.5i |
| **DEC-1** Doctor-PDF "not a diagnosis" string | ✅ | kept verbatim (founder pick) |
| **QUA-4** CI release + db-migrate workflows | ✅ Sprint 16.6 | `.github/workflows/{release,db-migrate}.yml` |

The remaining P0 items are **all founder-ops** (OPS-1..12). The
remaining P1 items are split between **SEC-1** (the only big
engineering lift), three doctor-PDF wiring items, and four
verification / hardening passes.

## Sprint 18 engineering progress (live)

Tick as commits land. Updated 2026-05-22.

### Day 1-4 engineering

| Item | Status | Commit | Notes |
|---|---|---|---|
| **SEC-1** MMKV encryption at rest | ✅ | `7d0455e` | Day 1 |
| **FUN-5** Doctor-PDF AI narrative + cover note wired | ✅ | `bf370c3` | Day 3 |
| **FUN-6** PDFShift signup | ✅ | (founder Day 2 Block 1) | PDFShift token in Edge Function secrets |
| **QUA-2** Drop hardcoded HR fallback window | ✅ | `7475bbd` | Day 5 prep |
| **QUA-8** Settings → Help & Support row + email row | ✅ | `ddc45e2` | Day 4 |
| **QUA-5** iOS PrivacyInfo collected data types | ✅ | `241f55d` | Day 3 |
| **QUA-7** App Store metadata + ITSAppUsesNonExemptEncryption | ✅ | `241f55d` | Day 3 |
| **QUA-4** CI workflows | ✅ already in Sprint 16.6 | (existing) | re-verified |

### Day 2 founder ops blitz

| Item | Status | Notes |
|---|---|---|
| **OPS-1** migrations to prod | ✅ | 23 migrations (incl. 0023 Vault hotfix) on `kqnzxjrpnjnczhgdwdqg` |
| **OPS-2** pg_cron config | ✅ | Vault path (hosted Supabase blocked the GUC approach); migration `0023_pg_cron_vault.sql` + 2 vault secrets |
| **OPS-11** Edge Function secrets | ✅ | 6 set: ANTHROPIC, RESEND, PDF×2, AI_TIER×2 |
| **Edge Functions deployed** | ✅ | 17 functions live; `ai-tier-b` smoke-curl 200 |
| **OPS-12** EAS production profile → prod Supabase | ✅ | `794d9f3` |
| **Block 3 AAB build** | ✅ | `5n4GUMxhcrLa5Z6Cgz9Cqr.aab` (versionCode 2) — Play Console upload pending |
| **Block 3 APK build (production-apk profile)** | ✅ | `kQ5uMNfwz7P6517WuvkAbW.apk` (versionCode 3) — installed on Phone 1 |
| **Block 4 Phone 1 smoke test** | ✅ partial | Signup + sign-in walked end-to-end with `tawokels@gmail.com` (Resend sandbox constraint); revealed 9 buckets of bench bugs (see below) |
| **Block 5 GH Actions secrets + production env** | ✅ | EXPO_TOKEN / SUPABASE_ACCESS_TOKEN / SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF variable + required-reviewer gate |

### Day 2-3 bench-found audit pass — 9 fix buckets

The on-device test cycle surfaced both UX issues and systemic
anti-patterns. We audited every vital-detail screen + 23 other
screens and closed 31 separate findings across 9 commits:

| # | What broke | Commit | Findings |
|---|---|---|---|
| 1 | SelfBuyerHome — no inline "Pair your watch" CTA | `8d8000b` | 1 |
| 2 | ReadingDetail — back/close trap (sticky chevron + Done + stack replace) | `6de2632` | 1 |
| 3 | Settings — refresh profile after onboarding DB writes | `e41745d` | 1 |
| 4 | SleepDetail audit — loading/error / fresh labels / chart width / history copy / correlation placeholder | `ff4ece8` | 6 |
| 5 | HRDetail audit — loading/error / date-aligned correlation / label clarity / "Last 24h" caption / history copy / stable nowSec | `d53a66f` | 9 |
| 6 | BPDetail audit — loading/error / fresh "now" gate / share-row wiring / no-today placeholder / hero+row time format | `a4ac261` | 6 |
| 7 | SpO2Detail audit — loading/error / date-pair correlation / Lowest single-source | `1662ca8` | 3 |
| 8 | ActivityDetail audit — loading/error | `8b28165` | 1 |
| 9 | Production-readiness audit — ParentDashboard loading/error + 3 ghost buttons on ReadingDetail | `316301a` | 3 |
| **Total** | | | **31** |

### Day 5 — bench verification (still ahead)

The new APK v4 (built end of 2026-05-22) bundles ALL 9 audit-pass
buckets. Once installed on Phone 1:

| Item | Status | Notes |
|---|---|---|
| **FUN-7** applyDeviceConfig pushes to watch | ⏳ | SPRINT_18_VERIFICATION.md Test 1 |
| **FUN-8** Background-fetch fires | ⏳ | Test 2 |
| **QUA-1** BP value mismatch race | ⏳ | Test 3 |
| **QUA-2** HR interval (no fallback) — verify on-device | ⏳ | Test 4 |
| **QUA-3** Android 14+ BLE foreground service survives Doze | ⏳ | Test 5 |
| Regression check on the 31 audit fixes | ⏳ | All 5 vital details, Home, ReadingDetail, Settings, ParentDashboard |

---

## Day-by-day plan

### Day 1 — SEC-1 (MMKV encryption at rest)

**Scope:** 1 work-day.

CLAUDE.md mandates "encrypt at rest + transit." The TLS side is fine
(supabase-js uses HTTPS). The local storage side is **plain-text MMKV
today** at `apps/mobile/src/services/storage.ts:15`. A rooted device,
a stolen unlocked phone, or a malicious adb backup all expose
readings, auth tokens, and the device pairing list.

**Shape of the fix:**

1. New `apps/mobile/src/services/secureBoot.ts` — async function
   that reads (or generates) a 32-byte key from the OS keychain via
   `expo-secure-store`. Caches the key in memory for the session.
2. Refactor `storage.ts` to construct the MMKV instance with that
   key. Because MMKV is synchronous and key acquisition is async,
   the app must AWAIT the key before mounting any consumer.
3. New boot sequence in `App.tsx` (or wherever the root mounts):
   ```
   await secureBoot.acquireKey();
   // Only now is it safe to render <RootNavigator />, because every
   // hook that touches mmkv assumes it's already initialised.
   ```
4. Migration path for existing installs: on first launch after the
   upgrade, detect the un-encrypted MMKV instance, copy its blob
   into a new encrypted instance, then delete the legacy keys.
   **This must be exercised on a phone that already has data.**
   Founder bench has Phone 1 with months of BP history — the test
   case.
5. Splash UI during the keychain unlock — ~50–200ms on first launch
   per Android session, longer on iOS first-ever launch when the
   keychain prompts biometrics. Show the existing
   `HydratingFallback` until the key arrives.

**Acceptance:**
- New install: key created, blob encrypted.
- Existing install (Phone 1): all readings + settings preserved
  through the migration. No "where did my data go?" moments.
- Roll-back: if the migration crashes mid-way, the app falls back
  to the unencrypted MMKV blob (safer than locking the user out).
  This requires a one-shot "migration_complete" flag in
  `expo-secure-store` so the migration only fires once and never
  partially overwrites itself.

**Verification:** on-device only. Bench-walk Phone 1 (existing
data) + Phone 2 (fresh install) through the upgrade.

---

### Day 2 — Founder ops blitz (OPS-1..12)

**Scope:** ~5 hours of founder work, broken into a single morning
session. The engineer (me) sits alongside for the in-app config
file edits (OPS-12 etc) but most of these are dashboard clicks.

Order matters because some unblock others:

| # | Item | Time | Notes |
|---|------|------|-------|
| 1 | **OPS-1** Push migration `0019_vitals_dedupe_full_index.sql` to prod | 5 min | `supabase db push --project-ref <prod>`. Unblocks all multi-vitals sync. |
| 2 | **OPS-11** Deploy Edge Function env vars to prod | 30 min | `ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`, etc. Edge Functions 500 without these. |
| 3 | **OPS-2** Set pg_cron GUCs on prod | 5 min | `app.settings.functions_base_url`, `app.settings.service_role_key`. Three crons silently failing without these. |
| 4 | **OPS-12** Point EAS production build at prod Supabase | 10 min | `eas.json` env block. Currently points at localhost. |
| 5 | **OPS-3** `npx expo prebuild --platform ios` | 10 min | Generates `apps/mobile/ios/`. Required for any iOS work below. |
| 6 | **OPS-4** Apple Dev: enable HealthKit entitlement | 10 min + 24-72h approval | Start now so approval clock runs. |
| 7 | **OPS-5** Generate Android release keystore + EAS config | 30 min | `eas credentials` walks through it. |
| 8 | **OPS-6** iOS distribution cert + provisioning profile in EAS | 30 min | Same `eas credentials` flow. |
| 9 | **OPS-7** Upload APNs `.p8` + FCM service account JSON to EAS | 1 hr | Sprint 15 push works in sandbox only without these. |
| 10 | **OPS-8** RevenueCat: signup, IAP products in App Store Connect + Play Console | 2 hr (signup) + 1–3 days store approval | Plus tier locked without these. |
| 11 | **OPS-9** `leiko.app` + `pair.leiko.app` DNS + AASA + assetlinks hosting | 1 hr | Deep links broken until this lands. |
| 12 | **OPS-10** App Store demo account creds + privacy policy URL drafted | 30 min | App Store review will reject without these. |

**Acceptance:** every OPS row in PRODUCTION_READINESS.md flips
from blocker → done OR has an explicit external-clock ETA noted.

**Verification:** EAS prod build runs locally with `--profile
production` and the resulting APK opens, signs in, and points at
prod Supabase.

---

### Day 3 — Doctor-PDF completion + App Store metadata

**Scope:** Half-day Doctor-PDF + half-day App Store readiness.

#### FUN-5 + FUN-6 — Doctor-PDF wiring (half-day)

The `For your doctor` screen lets a user generate a PDF for their
GP. The Edge Function `generate-doctor-prep-ai` already produces
the AI narrative paragraphs. The Edge Function `generate-doctor-pdf`
already renders an HTML report. **But the AI never reaches the
PDF** — the two Edge Functions don't talk.

1. **FUN-6 — Pick a rasterizer vendor.** PDFShift ($9/month
   starter) is the lowest-friction choice; Browserless and
   PDFCrowd are alternatives. Sign up, set `PDF_RASTERIZER_URL` +
   `PDF_RASTERIZER_API_KEY` in Edge Function env. Without this,
   `generate-doctor-pdf/index.ts:128` returns 500 in prod.

2. **FUN-5 — Wire the AI narrative through.** Inside
   `generate-doctor-pdf`, call `generate-doctor-prep-ai` for the
   `findings`, `trend`, and `recommendations` sections. Fall back
   to the deterministic Tier-C templates on AI failure (the
   cascade pattern from Sprint 16). Thread `coverNote` (already
   landed Sprint 16.5h) plus the new AI sections into the HTML
   template that ships to the rasterizer.

**Acceptance:** Tap "Letter for your doctor" → PDF arrives with
real AI-generated paragraphs (calm voice; Layer-1 + Layer-2 voice
lints pass), the parent's name, the right vital ranges, baselines,
and the regulatory cover line. Tap Share → OS share sheet works.

#### QUA-5 + QUA-7 — App Store metadata (half-day)

3. **QUA-5 — iOS `PrivacyInfo.xcprivacy`.** Required for App Store
   review since iOS 17. Add `expo-apple-app-privacy` plugin to
   `app.json` (or write the file directly under `ios/Leiko/`).
   Declare: Bluetooth (peripheral + device name), Health (read
   weight/glucose, write BP/HR/O2/sleep/steps), Push tokens.

4. **QUA-7 — Store metadata stubs in `app.json`.** Both stores
   require:
   - `description` (≤4000 chars; pulled from existing brand copy)
   - `privacy` (URL — depends on **OPS-9** DNS being live)
   - `supportUrl` (depends on **OPS-9** too — e.g. leiko.app/support)
   - `marketingUrl` (leiko.app)

**Acceptance:** `app.json` validates against EAS submit
preflight; iOS privacy manifest visible in the bundle.

---

### Day 4 — CI deploy workflow + Help/Support row

**Scope:** Half-day CI + half-day Settings polish.

#### QUA-4 — CI deploy workflow (half-day)

Right now releases are manual + error-prone. Two new GitHub Actions
workflows:

1. **`.github/workflows/release.yml`** — on tag push (`v1.0.0`,
   `v1.0.1`, …):
   - `eas build --platform all --profile production --non-interactive`
   - Gated job: `eas submit --platform all` (manual approval step
     so a bad tag doesn't auto-ship)
2. **`.github/workflows/db-migrate.yml`** — on push to main when
   `supabase/migrations/**` changed:
   - `supabase db push --project-ref ${{ secrets.SUPABASE_PROD_REF }}`
   - Drops a comment on the merge commit with the applied
     migrations.

Secrets to set in GitHub (founder via repo settings):
- `EXPO_TOKEN`
- `SUPABASE_PROD_REF`
- `SUPABASE_ACCESS_TOKEN`

**Acceptance:** push a tag, see EAS pick it up. Push a
no-op migration to main, see the cron run.

#### QUA-8 — Help / Support row (half-day)

Founder audit found no path from Settings → FAQ/contact. App Store
review checks for this. Either:

- External URL: ListRow at the bottom of Settings, opens
  `leiko.app/support` (depends on **OPS-9** DNS).
- In-app screen: new `SupportScreen.tsx` with a couple of FAQ rows
  + a `mailto:support@leiko.app` row.

V1 recommendation: external URL — much lower scope, satisfies
App Store. In-app FAQ is a post-launch polish.

**Acceptance:** Settings → Help & Support → opens browser to
`leiko.app/support`. Voice-lint passes on the row label + accessibility
hint.

---

### Day 5 — Bench verification day

**Scope:** Full day, founder-driven, engineer triages live.

Five things to walk through on real hardware. Each gets a
PASS/FAIL row in a new `plans/SPRINT_18_VERIFICATION.md`.

1. **FUN-7 — `applyDeviceConfig` actually pushes to watch.**
   Procedure: set Settings → Profile → height/weight/age to new
   values → confirm with the watch (long-press, view settings
   menu) that the new values are reflected. Sprint 12.5.2 wired
   the force-flag but on-device verification was deferred.

2. **FUN-8 — Background-fetch actually fires.** Close the app for
   30 min with the watch nearby. Re-open. Verify the `latestSync`
   timestamp moved forward without the user opening the app. PR
   for Sprint 10 closed without this verification.

3. **QUA-1 — BP value mismatch race.** Reproduce: take a reading,
   immediately tap History. Watch for the rare race where the
   wrong value shows. If reproducible, vote-on-retry fix (3 reads,
   majority value) — 2 hr.

4. **QUA-2 — HR fallback removal.** Bench-verify that
   `syncMultiVitals.ts:104` reads the per-call interval from the
   watch's index packet correctly. Remove the hardcoded
   30-min fallback.

5. **QUA-3 — Android 14+ BLE foreground service.** Plug Phone 2
   (OnePlus N30 / Android 14) in, take a reading, lock the phone,
   wait 5 minutes, sync. Verify the BLE service didn't get killed
   by doze. If it did, add `FOREGROUND_SERVICE_TYPES connectedDevice`
   to the Expo plugin's AndroidManifest output.

**Acceptance:** verification doc shows all five PASS, or has a
follow-up commit for each FAIL.

---

## Acceptance criteria for Sprint 18 overall

1. SEC-1 shipped + on-device verified (Phone 1 + Phone 2).
2. Every OPS-1..12 row is done OR has an explicit external-clock ETA.
3. Doctor-PDF generates a real PDF with AI narrative threaded through.
4. iOS privacy manifest + store metadata stubs in `app.json`.
5. Release + db-migrate workflows on `main`, secrets configured.
6. Help/Support row visible in Settings.
7. Day-5 verification doc shows ≥4/5 PASS (one FAIL acceptable if
   it has a follow-up commit).
8. `tsc --noEmit` + `npm run lint` + full jest suite all green.
9. `plans/PRODUCTION_READINESS.md` updated — every closed item
   marked ✅; items deferred to v1.1 are explicit.

## Out of scope (explicit deferrals to v1.1)

- **FUN-3** — Caregiver per-parent AI narration. Tier-A intent
  router is user-scoped; parent-scoped wiring is its own sprint.
  Sprint 17a explicitly deferred this. Static placeholder
  continues until v1.1.
- **GAP-1..15** — Sleep REM stages, hourly activity, sports records,
  deep BP backfill, embeddings build script, full Learn corpus
  expansion, profile photos, in-app theme toggle, parent persona
  large-text shell, jailbreak red-team CI runner, holistic Maestro
  E2E pass, Trends inline state harmonisation, single-string
  cascade adoption, clinical-review-queue sampling.
- **POL-1..7** — Watch timeout configurability, domain URL config
  module, dep version pinning, gitignore additions, SQL linting in
  CI, `as unknown as` cast cleanup, IANA timezone reconciliation.
- **Per-vital cache purge on visibility change for hybrid-mode
  users** — Sprint 17b accepted the minor staleness for
  hybrid-mode users (rare; their own MMKV gets a too-aggressive
  wipe). Revisit if a real user reports.

## Open prompt for the next session

> Sprint 18 — Launch Readiness Blitz. Read CLAUDE.md, then
> `plans/sprint-18-launch-readiness.md`, then
> `plans/PRODUCTION_READINESS.md` (partly stale — confirm via
> `git log --grep="FUN-\\|OPS-"` which items already shipped).
>
> Day 1 is **SEC-1 (MMKV encryption at rest)** — the biggest
> engineering lift in the sprint. Read
> `apps/mobile/src/services/storage.ts` + every consumer that
> calls `mmkv.getString` / `mmkv.set` to scope the boot-ordering
> refactor before touching code. The migration path for existing
> installs (Phone 1 has months of BP history) is the riskiest
> step — bench-test on a phone with data BEFORE shipping.
>
> Propose the plan + the migration's failure-fallback strategy
> before writing code. Wait for founder approval.
