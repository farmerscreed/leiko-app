# Founder Ops Playbook — Sprint 18 to Launch

**Updated:** 2026-05-20 Lagos. **Owner:** Biebele (founder). **Purpose:**
single document that walks you end-to-end through everything Claude
can't do for you — every dashboard click, every account signup, every
on-device verification. Top-to-bottom is the right order; some steps
unblock later steps (Apple HealthKit entitlement, for example, gates
the iOS submit).

Conventions:

- **Time** is your time, not wall-clock. The Apple entitlement step
  itself takes 10 minutes; Apple's *approval* takes 24-72 hours.
- **Blocking?** = "what won't ship until this is done."
- **Verify** = the literal way you confirm the step worked.
- Anything marked **claude-shipped** has already been written to code;
  this playbook just tells you how to plug in the credential / dashboard
  thing that turns it on.

---

## Day 0 — read these first (5 min)

- `plans/PRODUCTION_READINESS.md` — the launch-gating checklist. The
  P0 OPS rows are what Day 1 + Day 2 of this playbook close.
- `plans/sprint-18-launch-readiness.md` — the active sprint card.
  This playbook IS what makes Sprint 18 finishable.

---

## Day 1 — bench verification of SEC-1 (founder + dev phone, 30 min)

**Why this is here:** Claude shipped MMKV encryption at rest (commit
`7d0455e`). Phone 1 has months of BP history and Phone 2 is a fresh
install. The migration path needs human eyes.

### 1.1 — Rebuild + install on Phone 2 (fresh install)

```powershell
cd apps/mobile
EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo run:android --device 8fae80bc
```

**Verify:** App boots → AuthStack appears → sign in → take one reading
→ kill the app → reopen → reading still visible. App did not crash on
the keychain step.

### 1.2 — Rebuild + install on Phone 1 (existing data)

```powershell
cd apps/mobile
EXPO_NO_METRO_WORKSPACE_ROOT=1 npx expo run:android --device 43230DLJH001YY
```

**Verify (load-bearing):**
- App boots — may take a few seconds longer than usual on this launch
  (one-time migration is running)
- Home renders with **all prior BP/HR/SpO2/Sleep history intact**
- Family list intact, paired watch intact, Settings preserved
- Kill + relaunch — instant boot now (keychain key cached)

**If the data isn't there:** STOP. Do not take another reading on this
phone. Open `adb logcat | findstr Leiko` (or PostHog when wired) and
look for `sec1_migration_failed`. The legacy plain MMKV blob is still
on disk for 7 days as a rollback (per Sprint 18 SEC-1 design).

### 1.3 — Encryption-at-rest check (optional but recommended)

```powershell
adb -s 43230DLJH001YY shell run-as com.leiko.care ls -la /data/data/com.leiko.care/files/mmkv
```

The file `mmkv.leiko-enc` should exist. Pull it locally:
```powershell
adb -s 43230DLJH001YY shell run-as com.leiko.care cat /data/data/com.leiko.care/files/mmkv/mmkv.leiko-enc > leiko-enc.bin
```
Open in a text editor. Expected: an encrypted blob, **NOT** readable
plain text. You should NOT see strings like "leiko.auth.session" or
"sys": values. If you DO see plain text — file an issue immediately;
the migration didn't run.

---

## Day 2 — Founder ops blitz (OPS-1 to OPS-12 + FUN-6, ~6 hours total)

This is the big day. Each step is small (5 min to 2 hours). Order
matters; some unblock others. Run a stopwatch. **Blocking? = yes** on
every row unless noted.

### 2.1 — OPS-1: Push migration `0019_vitals_dedupe_full_index.sql` to prod

**What:** Push the multi-vitals dedupe fix to your prod Supabase. Without
it, every SpO2 / HR / sleep / activity write 500s.

**Why:** Sprint 16.5c root cause — the partial index on `vitals_dedupe`
blocked supabase-js `.upsert(onConflict)`. Migration drops the WHERE
clause.

**How:**
```powershell
# Make sure you're logged into the right account
npx supabase login
# Link to the prod project (one-time)
npx supabase link --project-ref <YOUR_PROD_REF>
# Apply pending migrations
npx supabase db push --include-all
```

**Verify:** From the Supabase SQL editor:
```sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'vitals_other' AND indexname LIKE '%dedupe%';
```
Should show `vitals_dedupe` with NO `WHERE` clause.

**Time:** 5 min.

### 2.2 — OPS-11: Deploy Edge Function env vars to prod

**What:** Set every secret that Edge Functions read at boot.

**Why:** Without these, `ai-tier-b`, `generate-doctor-pdf`,
`generate-doctor-prep-ai`, `send-push`, `send-family-invite`,
`manage-family-membership`, etc. all 500 in prod.

**How:** Supabase Dashboard → Project Settings → Edge Functions →
Environment Variables. Add (or via CLI `npx supabase secrets set KEY=VALUE`):

| Key | Value | Source |
|---|---|---|
| `ANTHROPIC_API_KEY` | sk-ant-... | console.anthropic.com → API Keys |
| `EXPO_ACCESS_TOKEN` | expo... | expo.dev → Account → Access tokens |
| `RESEND_API_KEY` | re_... | resend.com → API Keys (for FUN-1 emails) |
| `PDF_RASTERIZER_URL` | https://api.pdfshift.io/v3/convert/pdf | After 2.13 (FUN-6) |
| `PDF_RASTERIZER_TOKEN` | api_xxx | After 2.13 (FUN-6) |
| `AI_TIER_B_PROD_DATA_ENABLED` | `true` | enable LLM with real data |
| `AI_TIER_C_PROD_DATA_ENABLED` | `false` | Sonnet stays gated for v1.0 |

**Verify:** `curl -X POST https://<your-proj>.supabase.co/functions/v1/ai-tier-b \
 -H "Authorization: Bearer <user-jwt>" -d '{"question":"hello"}'` — should
NOT return `service_unavailable` (which is what fires when ANTHROPIC_API_KEY
is missing).

**Time:** 30 min.

### 2.3 — OPS-2: Configure pg_cron secrets via Supabase Vault

**What:** The four cron jobs (`compute-correlations`, `weekly-summary`,
`monthly-baseline`, `detect-anomaly`) call back into Edge Functions.
They need the project URL + service-role key.

**Why:** Without these, the crons run but their function calls 404.
Trends correlation cards stay empty.

**How:** The original GUC-based plan (`ALTER DATABASE postgres SET
app.settings.X`) fails on hosted Supabase with `42501: permission
denied`. Migration `0023_pg_cron_vault.sql` (Sprint 18) switched the
helpers to read from Supabase Vault instead.

Supabase SQL editor:
```sql
select vault.create_secret(
  'https://<your-proj>.supabase.co',
  'functions_base_url'
);
select vault.create_secret(
  '<your-service-role-key>',
  'service_role_key'
);
```

⚠️ `functions_base_url` is the project ROOT, **not** `.../functions/v1`.
The helpers in 0023 append `/functions/v1/<name>` themselves.

**Verify:**
```sql
select name, length(decrypted_secret) as len
  from vault.decrypted_secrets
  where name in ('functions_base_url', 'service_role_key');
```
Two rows back → done.

**Rotation:** `vault.update_secret(id, new_value)` or drop + recreate
by name.

**Time:** 5 min.

### 2.4 — OPS-12: Point EAS production build at prod Supabase

**What:** EAS' production profile env block must inject prod Supabase
URL + anon key at build time.

**Why:** Today the production build would point at `localhost:54321` —
nothing works.

**How:** Edit `apps/mobile/eas.json`:
```jsonc
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://<your-proj>.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<your-prod-anon-key>"
      }
    }
  }
}
```

**Verify:** `cd apps/mobile && eas build --platform android --profile production --local` — the
build log shows the prod URL near "Resolved environment variables".

**Time:** 10 min.

### 2.5 — OPS-3: Run iOS prebuild

**What:** Generates `apps/mobile/ios/` from `app.json`. Required for any
EAS iOS build to work.

**Why:** Today no `ios/` folder exists. EAS can't sign a build it can't
generate.

**How:** Must be on a Mac (Xcode required for prebuild on iOS):
```bash
cd apps/mobile
npx expo prebuild --platform ios --clean
```

**Verify:** `apps/mobile/ios/Leiko.xcodeproj` exists. Open it in Xcode
once to confirm it builds locally (Cmd-B). Quit Xcode after.

**Time:** 15 min on a Mac. Skip if you're targeting Android-only first.

### 2.6 — OPS-4: Apple Developer — enable HealthKit entitlement

**What:** Apple Developer Console → Certificates, IDs & Profiles →
Identifiers → `com.leiko.care` → check "HealthKit" → Save.

**Why:** `app.json` declares the HealthKit plugin + usage strings, but
the entitlement flag must be flipped on the Developer account itself.
App Store review will reject if the manifest claims HealthKit and the
account hasn't enabled it.

**How:** developer.apple.com → log in → Certificates, IDs & Profiles
→ Identifiers → tap the `com.leiko.care` identifier → scroll to
"Capabilities" → check **HealthKit** + **Background Modes** (BLE
central + Background fetch) → Save.

**Verify:** Reload the identifier page; HealthKit shows enabled.

**Time:** 10 min. Apple may take **24-72 hours** to propagate to App
Store Connect. Do this FIRST so the clock starts now.

### 2.7 — OPS-5: Android release keystore + EAS signing

**What:** Generate the production signing keystore that Play Store
ties your app identity to. **Lose this keystore = lose the ability
to ship updates to this app forever.**

**Why:** `android/app/build.gradle` defaults to `debug.keystore`. Play
Store rejects debug-signed releases. The keystore is the cryptographic
identity of the app in the Play Store.

**How:**
```powershell
cd apps/mobile
eas credentials
# Pick: Android → production → keystore → Generate new keystore
```
EAS stores the keystore on your account; back up the keystore +
password **TO 1PASSWORD OR AN ENCRYPTED FILE YOU CONTROL**. Apple
Developer doesn't lose keys for you; lose this and v2.0 has to ship
as a new app.

**Verify:** `eas credentials` shows the production keystore listed
under `apps/mobile`.

**Time:** 30 min (most of it is the backup ritual).

### 2.8 — OPS-6: iOS distribution cert + provisioning profile in EAS

**What:** Same flow as OPS-5 but for iOS.

**Why:** EAS can't sign an iOS production build without these.

**How:**
```powershell
cd apps/mobile
eas credentials
# Pick: iOS → production → Generate or upload distribution cert
# Pick: iOS → production → Generate provisioning profile (App Store)
```

**Verify:** `eas credentials` shows both under `apps/mobile`.

**Time:** 30 min. Needs OPS-4 (Apple Developer login) and OPS-3
(prebuild) done first.

### 2.9 — OPS-7: APNs `.p8` + FCM service-account JSON

**What:** Push notification signing keys. APNs for iOS, FCM for
Android.

**Why:** Sprint 15 ships anomaly push notifications. Today the Expo
"sandbox" pipeline works because no real keys are configured. Real
devices won't receive prod push without these.

**How:**

iOS (APNs):
1. developer.apple.com → Certificates, IDs & Profiles → Keys → +
2. Name "Leiko APNs" → check Apple Push Notifications service (APNs)
3. Generate → download the `.p8` file (this is the ONLY chance to
   download it; back up immediately)
4. Note the Key ID and your Team ID

Then upload to Expo:
```powershell
cd apps/mobile
eas credentials
# Pick: iOS → Push notifications → APNs key → Upload existing key
# Paste Key ID + Team ID + .p8 contents
```

Android (FCM):
1. console.firebase.google.com → Add project (name: leiko-prod)
2. Project Settings → Service accounts → Generate new private key
   → download the JSON file
3. Note: do not commit this JSON to git. Add to gitignore if not
   already.

Then upload to Expo:
```powershell
cd apps/mobile
eas credentials
# Pick: Android → Google Service Account Key → Upload JSON
```

**Verify:** `eas credentials` shows both. The Expo "Sprint 15 push
in prod" works against a real device. (You can test by registering
a token and sending a test push from the Expo dashboard.)

**Time:** 1 hour.

### 2.10 — OPS-8: RevenueCat signup + IAP products

**What:** RevenueCat is the in-app-purchase abstraction layer.

**Why:** Without it, the Plus tier is unreachable. Plus gates Trends
30D/90D/1Y, doctor-PDF export, and the AI Tier-B quota.

**How:**
1. Sign up at app.revenuecat.com (free tier covers ≥10k MAU)
2. Create a project called "Leiko"
3. Add Android app (package: `com.leiko.care`)
4. Add iOS app (bundle: `com.leiko.care`)
5. **IAP products** — create matching IDs in both:
   - **App Store Connect:** App → Features → In-App Purchases → +
     - `com.leiko.care.plus.monthly` ($4.99/mo or your pricing)
     - `com.leiko.care.plus.yearly` ($39.99/yr)
   - **Play Console:** App → Monetize → Products → Subscriptions
     - Same IDs as above
   - **RevenueCat:** Add the product IDs to both apps → create one
     entitlement called `plus` → attach both products to it.
6. RevenueCat → Project Settings → API keys → copy iOS + Android keys.
7. Set the keys in `apps/mobile/eas.json` production env:
   - `EXPO_PUBLIC_RC_API_KEY_IOS`
   - `EXPO_PUBLIC_RC_API_KEY_ANDROID`

**Webhook:** Project Settings → Webhooks → +
   URL: `https://<your-proj>.supabase.co/functions/v1/revenuecat-webhook`
   Authorization header: `Bearer <webhook-secret>` (generate one)
   Set `REVENUECAT_WEBHOOK_SECRET` as an Edge Function env (OPS-11).

**Verify:** Sandbox purchase on a TestFlight build → Settings shows
"Plus" → Trends 30D/90D/1Y unlocks.

**Time:** 2 hours of your work, then 1-3 days for App Store + Play
to approve the IAP products.

### 2.11 — OPS-9: `leiko.app` + `pair.leiko.app` DNS + AASA + assetlinks

**What:** Host the two domains; serve Apple `apple-app-site-association`
and Android `assetlinks.json` files. These power deep links + Google's
App Links verification.

**Why:** Family invites use 6-digit codes (not deep links — design
choice per D8a §10), but the app declares `applinks:leiko.app` +
`applinks:pair.leiko.app` so any future deep-link content (e.g.,
welcome email referrals) works without an app update.

**How:**

DNS (Cloudflare / Namecheap / wherever your registrar is):
- `leiko.app` → A record → IP of your static hosting (Cloudflare Pages,
  Vercel, Netlify; the cheap free tier is fine)
- `pair.leiko.app` → CNAME to `leiko.app` (or A record to same IP)

Static hosting (Cloudflare Pages example — free):
- Repo: create a new git repo `leiko-app-www` with this structure:
  ```
  /
    index.html  (your marketing page, even a placeholder is fine)
    support.html  (for the QUA-8 Settings → Help & support link)
    privacy.html  (the privacy policy)
    terms.html  (the ToS)
    .well-known/
      apple-app-site-association  (no extension; JSON)
      assetlinks.json
  ```
- Push to GitHub, connect to Cloudflare Pages, point custom domain
  to `leiko.app`.

`.well-known/apple-app-site-association` content (replace TEAMID
with your Apple Developer Team ID):
```json
{
  "applinks": {
    "details": [{
      "appIDs": ["TEAMID.com.leiko.care"],
      "components": [{ "/": "*" }]
    }]
  }
}
```

`.well-known/assetlinks.json` content (replace SHA256 with the
fingerprint of your release keystore — get it from `eas credentials`):
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.leiko.care",
    "sha256_cert_fingerprints": ["SHA256_OF_RELEASE_KEYSTORE"]
  }
}]
```

The templates already exist at `apps/mobile/well-known/` — copy
those, replace placeholders, push.

**Verify:**
- `curl https://leiko.app/.well-known/apple-app-site-association`
  returns valid JSON with no extension
- `curl https://leiko.app/.well-known/assetlinks.json` returns
  valid JSON
- Apple's verifier: search-fwd.apple.com (open in browser, paste
  `leiko.app`)
- Google's verifier: digitalassetlinks.googleapis.com/v1/statements:list
  ?source.web.site=https://leiko.app&relation=delegate_permission/common.handle_all_urls

**Time:** 1 hour (most of it is the DNS propagation wait — start early).

### 2.12 — OPS-10: App Store demo account credentials + privacy policy

**What:** Apple's review team needs an account they can log into to
walk through the app. They also need a public privacy policy URL.

**Why:** App Store review will reject without both.

**How:**

Demo account:
1. Create a real Leiko account using a dedicated review email (e.g.
   `apple-review@leiko.app`). Onboard as both caregiver and self-buyer
   (set up two accounts if needed).
2. Pre-populate the account with **realistic but fake** BP/HR readings
   for the past 30 days so the reviewer sees Trends populated.
3. Save the credentials.

Privacy policy URL: depends on OPS-9. Once `leiko.app/privacy` is
live, you're set. The content of the policy must cover:
- HealthKit data handling (per Apple)
- Health Connect data handling (per Google)
- The fact you encrypt data at rest (claude-shipped Sprint 18 SEC-1)
  and in transit
- Your retention policy (30-day hard-delete cron after account
  deletion — claude-shipped Sprint 16.6 FUN-2)

You can use Iubenda / Termly to draft this; ~$30/yr is the price of
not writing it yourself.

**Verify:** Once you're ready to submit, the App Store Connect form
has a "Demo Account" field — paste credentials there. Privacy URL
field auto-validates with a fetch.

**Time:** 30 min to set up the account + populate; ~$30 + 30 min if
you use a policy generator.

### 2.13 — FUN-6: Pick a PDF rasterizer vendor + set its keys

**What:** The doctor-PDF Edge Function (`generate-doctor-pdf`) needs
an HTML→PDF service. Claude wired the AI narrative through (FUN-5,
commit pending), but it can't run without this env var.

**Why:** PDF generation 500s in prod without `PDF_RASTERIZER_URL` set.

**How:** Pick one:

| Vendor | Pricing | Notes |
|---|---|---|
| **PDFShift** | $9/mo starter (500 PDFs/mo) | Lowest friction. Recommended. |
| Browserless | $50/mo (10k credits) | More features; overkill for v1.0 |
| PDFCrowd | $9/mo (2k credits) | Similar to PDFShift |

Recommended: **PDFShift**.

1. Sign up at pdfshift.io
2. Create an API key
3. Set Edge Function env vars (per OPS-11 above):
   - `PDF_RASTERIZER_URL=https://api.pdfshift.io/v3/convert/pdf`
   - `PDF_RASTERIZER_TOKEN=<your-api-key>`

**Verify:** From the `For your doctor` screen on a Plus account →
tap "Letter for your doctor" → PDF arrives → open it → verify:
- Cover page has a Leiko-formatted disclaimer line
- Cover page has the AI-generated paragraph (Tier-B Haiku, 2-3
  sentences, clinical tone)
- Cross-vital observations section has an AI-generated 1-2
  paragraph lead
- All vital sections populated with stats from actual data

**Time:** 30 min.

---

## Day 3 — Configure GitHub Actions secrets (15 min)

Sprint 16.6 (commit `f8aafcc`) shipped three workflows (`ci.yml`,
`release.yml`, `db-migrate.yml`). They need secrets to run.

**Where:** GitHub → repo `farmerscreed/leiko-app` → Settings → Secrets
and variables → Actions → **Repository secrets** tab.

Add:

| Secret | Value | From |
|---|---|---|
| `EXPO_TOKEN` | expo... | expo.dev → Account → Access tokens → Create |
| `SUPABASE_ACCESS_TOKEN` | sbp_... | supabase.com → Account → Access tokens → Generate new token |
| `SUPABASE_DB_PASSWORD` | (your prod db password) | Supabase dashboard → Project Settings → Database → Reset password if you don't remember it |

**Variables** tab (not secrets — these are non-sensitive):

| Variable | Value |
|---|---|
| `SUPABASE_PROJECT_REF` | (your prod project ref — visible in the dashboard URL) |

**Environment for manual gating:** Settings → Environments → New
environment → name `production-submit` → check "Required reviewers"
→ add yourself. This means `eas submit` won't fire until you click
approve in the GitHub Actions UI.

**Verify:** Push a no-op migration commit to main → DB migrate
workflow runs successfully (or skips if no migrations changed).
Tag a v1.0.0-rc.1 → Release workflow builds, then waits at the
submit step until you approve.

**Time:** 15 min.

---

## Day 4 — On-device bench verification (founder, ~2 hours)

This is Sprint 18 Day 5 in the sprint card. Engineering changes
already landed in commits; this is the "does it actually work on
real hardware" pass.

Open `plans/SPRINT_18_VERIFICATION.md` (create it if it doesn't
exist) and fill in PASS / FAIL / NOTE for each row.

### 4.1 — FUN-7: applyDeviceConfig writes to the watch

**Procedure:**
1. Settings → Profile → edit height/weight/age to a NEW value
2. Save
3. Wait for the next sync (or trigger Force Sync from DebugLauncher)
4. On the watch: long-press → Settings menu → confirm the new values
   are reflected on the device

**Pass condition:** Watch shows the new values.

**If FAIL:** check `services/sync/applyDeviceConfig.ts` — the
force-flag must be set true on take-reading sync. Sprint 12.5.2 wired
it; this is a verification of that wiring, not a fix.

### 4.2 — FUN-8: Background-fetch actually fires

**Procedure:**
1. Take one reading on Phone 1
2. Kill the Leiko app
3. Wait 30 minutes (literal wall clock — go make tea)
4. Reopen the app
5. Settings → About → "Last sync at" should be more recent than 30
   minutes ago

**Pass condition:** Last-sync timestamp moved forward without user
intervention.

**If FAIL:** check Android's battery-optimization settings for Leiko
(Settings → Apps → Leiko → Battery → Unrestricted). Background-fetch
on Android requires this on most OEM ROMs. Document the workaround
in onboarding.

### 4.3 — QUA-1: BP value mismatch race

**Procedure (try to reproduce):**
1. Take a reading
2. The MOMENT the reading is shown, tap History (don't wait)
3. Compare the value shown in History to the value the watch displayed

Do this 5-10 times.

**Pass condition:** Values always match.

**If FAIL** (mismatch in any of the 5-10 attempts): file an issue,
include the trace from DebugLauncher → BLE trace. Engineering fix is
either (a) settling delay or (b) vote-on-retry — Claude can ship the
fix once a real trace is captured.

### 4.4 — QUA-3: Android 14 BLE foreground service

**Procedure:**
1. Phone 2 (OnePlus Nord N30 / Android 14)
2. Take a reading
3. Lock the phone immediately after
4. Wait 5 minutes (literal wall clock)
5. Unlock + open Leiko
6. The reading should be present AND new readings taken on the watch
   while locked should sync within 30 seconds of unlock

**Pass condition:** No data loss; sync resumes on unlock.

**If FAIL:** the Expo plugin may need `FOREGROUND_SERVICE_CONNECTED_DEVICE`
service-type declaration. File an issue with the logcat output from
`adb logcat | findstr ble`. Code fix is small if needed.

---

## Day 5 — Tag v1.0.0-rc.1 + first internal beta build (30 min)

After Day 4 bench verification PASSES on all four rows:

```powershell
git tag v1.0.0-rc.1
git push origin v1.0.0-rc.1
```

This triggers the Release workflow:
1. EAS build runs for both platforms (~30-45 min wall clock)
2. Submit job waits at the production-submit gate

**Don't approve submit yet.** Internal beta first — see Day 6.

---

## Day 6 — Internal beta cycle (1-2 weeks wall clock)

### 6.1 — TestFlight (iOS)
1. App Store Connect → TestFlight → Internal Testing → add testers
   by Apple ID email
2. Once OPS-3..6 + OPS-10 done, EAS submit (run the
   `production-submit` workflow manually via the Actions UI) → build
   goes to TestFlight
3. Testers receive an email invite → install via TestFlight app

### 6.2 — Play Internal Testing (Android)
1. Play Console → Internal testing → Create a release → upload the
   AAB from EAS build (or let `eas submit --platform android` do it)
2. Add tester emails to the closed-list
3. Testers install via the opt-in link

### 6.3 — Recruit 10-20 beta testers
- Mix of Nigeria + US
- Mix of caregiver + self-buyer personas
- At least 3 with watches paired (the rest can demo without)

### 6.4 — Watch the dashboards
- **PostHog** (once configured) — funnel from onboarding → first
  reading → second reading
- **Sentry** (if wired) — crash rate
- **Supabase logs** — Edge Function 500s, especially around
  `generate-doctor-pdf`, `ai-tier-b`, `send-push`
- **Audit log** in Supabase — confirm visibility changes,
  family-removal events, etc. are landing

**Iterate:** any P0 surfaced by testers → branch off main → fix →
re-tag `v1.0.0-rc.2`, etc.

---

## Day 7 — Submit to public stores (when betas are clean)

1. App Store Connect → App → Pricing → confirm tier + availability
2. App Store Connect → App → App Privacy → fill out the privacy
   nutrition labels (covers HealthKit, BLE, push tokens — all opt-in)
3. App Store Connect → App → Version 1.0 → Submit for review
   (uses the latest TestFlight build)
4. Play Console → Production track → Promote from Internal Testing
   → Roll out to 100%

Wait: 24-72 hours for Apple, ~1-3 days for Play (faster for updates).

**First rejection is normal.** Apple often nitpicks the medical-device
positioning. Have `docs/_reference/D3-regulatory.md` ready as
ammunition: Leiko surfaces general information; it's not a diagnostic
tool; the watch itself is FDA-cleared (510(k) K141683) for BP measurement.

---

## Post-launch — monitor + iterate

- **First 48 hours:** stare at PostHog + Sentry + Supabase logs. Any
  crash spike → hotfix tag and push.
- **First 2 weeks:** weekly review of the audit_log table for any
  family-removal or visibility-change anomalies.
- **First month:** revisit `PRODUCTION_READINESS.md` § "v1.1 deferrals"
  (GAP-1..15, POL-1..7). Triage which to ship in 1.1 vs 1.2.

---

## What's left as engineering work post-Sprint-18

Tracked in `plans/PRODUCTION_READINESS.md` under v1.1 deferrals:

- **GAP-1** Sleep REM stages (firmware exposes only deep/light today)
- **GAP-3** Sports records ingest
- **GAP-4** Deep BP backfill > 50 readings (Phase-2 walk-back)
- **GAP-5** Embeddings build script for Tier-B card-citation
- **GAP-6** DAILY + CULTURAL Learn article clusters
- **GAP-7** Profile photo upload + display-name editor
- **GAP-8** In-app theme toggle UI
- **GAP-10** Parent (large-text read-only) persona content
- **GAP-11** Live jailbreak red-team CI runner
- **GAP-12** Holistic Maestro E2E pass
- **GAP-13** Trends inline chart state harmonisation
- **GAP-14** runSingleStringCascade adoption across narration
- **GAP-15** Clinical-review-queue ambient-surface sampling
- **POL-1..7** small polish items (watch timeout configurability,
  domain URL config module, dep version pinning, gitignore additions,
  SQL linting in CI, type-cast cleanup, IANA timezone reconciliation)

None block v1.0 launch.

---

## When you're stuck

- Bench reconnect issues → `memory/running_on_phone.md`
- USB / adb weirdness → `scripts/dev-phone-reconnect.ps1`
- Supabase local dev → `memory/supabase_local_dev.md`
- Voice-rule questions → `docs/05-voice-and-claims.md` + the strings
  in `apps/mobile/src/services/voice/`
- Anything else → search `memory/MEMORY.md` index first; the close-out
  memos there carry the load-bearing context.

---

*This document is the operational counterpart to `plans/PRODUCTION_READINESS.md`.
Update both as items close. Mark each section ✅ inline when done.*
