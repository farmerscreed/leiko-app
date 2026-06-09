# Launch Day 2 — Morning Checklist

**Time budget:** one focused half-day (~5-6 hours). One coffee.
**Outcome:** prod backend live, Phone 1 running an EAS-signed APK
pointing at it, real reading round-tripping through Anthropic.

Tick `[x]` as you go. If something breaks, jump to the matching
section of `plans/FOUNDER_OPS_PLAYBOOK.md` for the CLI detail.
Reserved tabs: Supabase, Expo, Anthropic, Resend, PDFShift, GitHub.

---

## Before you start (5 min)

- [ ] Phone 1 (Pixel 8, `43230DLJH001YY`) connected via USB and `adb devices` shows it
- [ ] Repo on branch `claude/competent-goldberg-737194`, working tree clean (`git status` empty)
- [ ] One scratch file open to paste keys into as you generate them (NOT a chat window — local only)
- [ ] 1Password or your password manager open — you will back up the Android keystore here

---

## Block 1 — Stand up the prod backend (45 min)

### Create the Supabase prod project (10 min)

- [ ] Go to **supabase.com** → New Project
- [ ] Name: `leiko-prod`. Region: closest to your largest market (eu-west-2 for NG/UK reach, us-east-1 for US-first)
- [ ] Set a **strong** database password — paste into your scratch file as `SUPABASE_DB_PASSWORD`
- [ ] Wait for the project to provision (~2 min)
- [ ] Project Settings → API → copy and save to scratch:
  - `EXPO_PUBLIC_SUPABASE_URL` (the project URL)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon public)
  - `SUPABASE_SERVICE_ROLE_KEY` (service_role — keep this secret)
  - `SUPABASE_PROJECT_REF` (from the dashboard URL)

### Create the third-party keys (15 min)

- [ ] **console.anthropic.com** → API Keys → Create key → save as `ANTHROPIC_API_KEY` (`sk-ant-...`)
  - Add billing first if not already (set a $20 cap to start)
- [ ] **resend.com** → Sign up → API Keys → Create → save as `RESEND_API_KEY` (`re_...`)
  - Verify the sending domain later (leiko.app); the dev/test sender works for now
- [ ] **pdfshift.io** → Sign up → API Credentials → save as `PDF_RASTERIZER_TOKEN`
  - The URL constant is `https://api.pdfshift.io/v3/convert/pdf` (no signup needed)

### Apply migrations to prod (10 min)

- [ ] From repo root:
  ```powershell
  npx supabase login
  npx supabase link --project-ref <YOUR_PROJECT_REF>
  npx supabase db push --include-all
  ```
- [ ] Verify in Supabase dashboard → Database → Tables: `users`, `families`, `family_members`, `readings`, `vitals_other`, `audit_log`, `ai_narration_cache`, `notification_preferences` all present
- [ ] SQL editor:
  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'vitals_other' AND indexname = 'vitals_dedupe';
  ```
  Returns one row → OPS-1 done.

### Set Edge Function secrets (5 min)

- [ ] From repo root, one shot:
  ```powershell
  npx supabase secrets set `
    ANTHROPIC_API_KEY=<your-anthropic-key> `
    RESEND_API_KEY=<your-resend-key> `
    PDF_RASTERIZER_URL=https://api.pdfshift.io/v3/convert/pdf `
    PDF_RASTERIZER_TOKEN=<your-pdfshift-key> `
    AI_TIER_B_PROD_DATA_ENABLED=true `
    AI_TIER_C_PROD_DATA_ENABLED=false
  ```
- [ ] Verify in dashboard → Project Settings → Edge Functions → Environment Variables — all six listed

### Configure pg_cron secrets via Vault (5 min)

⚠️ The earlier instruction to set `app.settings.*` via `ALTER DATABASE`
won't work on hosted Supabase (`42501: permission denied to set
parameter`). Migration `0023_pg_cron_vault.sql` switched the cron
helpers to read from Supabase Vault instead.

The base URL stored is the project ROOT (`https://<ref>.supabase.co`),
NOT `.../functions/v1` — the helpers append the path themselves.

- [ ] Supabase SQL editor → New query → paste (substitute your values):
  ```sql
  select vault.create_secret(
    'https://<YOUR_PROJECT_REF>.supabase.co',
    'functions_base_url'
  );
  select vault.create_secret(
    '<YOUR_SERVICE_ROLE_KEY>',
    'service_role_key'
  );
  ```
- [ ] Verify (will return TWO rows, both decrypted_secret populated):
  ```sql
  select name, length(decrypted_secret) as len
    from vault.decrypted_secrets
    where name in ('functions_base_url', 'service_role_key');
  ```
  Two rows back → OPS-2 done.

### Deploy Edge Functions (5 min)

- [ ] From repo root:
  ```powershell
  npx supabase functions deploy --project-ref <YOUR_PROJECT_REF>
  ```
  (deploys all functions; ~2 min)
- [ ] Spot check by curling one:
  ```powershell
  curl -X OPTIONS https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/ai-tier-b
  ```
  Returns 200 with CORS headers — Edge Functions are live.

---

## Block 2 — Point EAS at prod (10 min)

- [ ] Open `apps/mobile/eas.json`, find the `production` profile, edit its `env` block:
  ```jsonc
  "production": {
    "env": {
      "EXPO_PUBLIC_SUPABASE_URL": "https://<YOUR_PROJECT_REF>.supabase.co",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<YOUR_ANON_KEY>"
    }
  }
  ```
- [ ] Save, commit, push:
  ```powershell
  git add apps/mobile/eas.json
  git commit -m "chore(eas): point production profile at prod Supabase (OPS-12)"
  git push
  ```

---

## Block 3 — Build + sign the prod APK (45 min wall clock, ~10 min hands-on)

- [ ] **expo.dev** → Sign up / log in → Account → Access Tokens → Create → save as `EXPO_TOKEN`
- [ ] Local CLI auth:
  ```powershell
  cd apps/mobile
  npx eas-cli login
  ```
- [ ] Generate Android release keystore (one-time, irreversible):
  ```powershell
  npx eas-cli credentials
  ```
  - Pick: Android → production → Keystore → **Generate new keystore**
  - **CRITICAL:** download the keystore + jot down the password
  - **Paste both into 1Password under "Leiko Android Release Keystore"** before continuing. Losing this means losing the ability to update the app in Play Store.
- [ ] Trigger the build:
  ```powershell
  npx eas-cli build --platform android --profile production
  ```
  - This runs in the cloud. Walk away for 20-40 min. Get more coffee.
  - When done, the URL prints to the terminal and emails to you. Download the `.apk`.

---

## Block 4 — Install + smoke test on Phone 1 (15 min)

- [ ] **WARNING:** This installs prod-pointing app over your dev install. The SEC-1 keychain migration will run on first boot — Phone 1 has months of BP history, this is the test case.
- [ ] Uninstall the dev build first to avoid signing-mismatch:
  ```powershell
  adb -s 43230DLJH001YY uninstall com.leiko.care
  ```
  ⚠️ This wipes local MMKV. **Server data is intact** — the migration is from "first launch on a phone with the encrypted-at-rest blob," not from an existing dev install.
- [ ] Install the prod APK:
  ```powershell
  adb -s 43230DLJH001YY install -r path\to\leiko-prod.apk
  ```
- [ ] Open the app on Phone 1
- [ ] Sign in with `biebele@gmail.com`. Mailpit is gone now — you should get the OTP email at your real inbox (Resend sandbox if domain not verified yet, or your inbox if it is)
- [ ] Watch Home render → server-hydrated readings should appear from prod Supabase
- [ ] Take ONE BP reading on the watch → confirm it syncs:
  - Supabase dashboard → Table editor → `readings` → see the new row land
  - Settings → About → "Last sync" timestamp moved forward

If any of the above breaks, STOP and triage. Don't proceed to Block 5 until reading round-trips work.

---

## Block 5 — GitHub Actions secrets (5 min)

- [ ] GitHub → repo `farmerscreed/leiko-app` → Settings → Secrets and variables → Actions
- [ ] **Secrets** tab → add:
  - [ ] `EXPO_TOKEN` (from Block 3)
  - [ ] `SUPABASE_ACCESS_TOKEN` — supabase.com → Account → Access Tokens → Create new
  - [ ] `SUPABASE_DB_PASSWORD` (from Block 1)
- [ ] **Variables** tab → add:
  - [ ] `SUPABASE_PROJECT_REF` (from Block 1)
- [ ] **Environments** tab → New environment → name `production-submit` → check "Required reviewers" → add yourself → Save
- [ ] Test: re-run the CI workflow on the latest commit (Actions tab → CI → Re-run) — should pass

---

## Block 6 — Kick off the long-clock async work (10 min, then walk away)

These don't block today's Android-first ship but they have multi-day external clocks. Start them now so they're done by the time you need them.

- [ ] **developer.apple.com** → Certificates, IDs & Profiles → Identifiers → New `com.leiko.care` → enable **HealthKit** + **Background Modes** → Save
  - 24-72h Apple propagation clock starts now
- [ ] **App Store Connect** → My Apps → New App → name "Leiko" → bundle `com.leiko.care` → Create
  - Features → In-App Purchases → Create:
    - `com.leiko.care.plus.monthly` ($4.99)
    - `com.leiko.care.plus.yearly` ($39.99)
  - 1-3 day approval clock starts now
- [ ] **Play Console** → Create app → name "Leiko" → Monetize → Subscriptions → Create:
  - Same product IDs as above
  - 1-3 day approval clock starts now
- [ ] **Cloudflare** (or your registrar) → Add `leiko.app` → set up DNS pointing at static hosting (Cloudflare Pages is free; create a minimal static site with `index.html`, `privacy.html`, `terms.html`, `support.html`, and the `.well-known/` files per the playbook)
  - DNS propagation takes 1-24 hours

---

## Done when

- [x] Prod Supabase project exists and has all migrations applied
- [x] All Edge Function secrets set (Anthropic, Resend, PDFShift, AI flags)
- [x] pg_cron GUCs configured
- [x] `eas.json` production profile points at prod Supabase
- [x] EAS Android release keystore generated **AND BACKED UP**
- [x] Prod-signed APK built and installed on Phone 1
- [x] One reading round-trips from watch → phone → prod Supabase
- [x] GitHub Actions secrets configured
- [x] Apple HealthKit / Apple IAP / Play IAP / DNS clocks all started

You are now in **internal-beta state**: a real APK signed with the real keystore pointing at real Supabase. You can hand this APK to a small trusted tester via Drive link. iOS, RevenueCat (Plus tier), and the public-store push come on subsequent days.

---

## What to do tomorrow

1. **iOS prebuild + signing** — needs a Mac. `npx expo prebuild --platform ios` + `eas credentials` for the iOS distribution cert and provisioning profile (per FOUNDER_OPS_PLAYBOOK Day 2.5 + 2.8).
2. **APNs + FCM push keys** — once Apple HealthKit + APNs Key are propagated (24-72h). Per playbook Day 2.9.
3. **RevenueCat signup + IAP wiring** — once Apple/Play approve the IAP products (1-3 days). Per playbook Day 2.10.
4. **Bench Day 4** — FUN-7 / FUN-8 / QUA-1 / QUA-3 on real hardware. Per playbook Day 4.
5. Tag `v1.0.0-rc.1` → tests + EAS build via the release workflow → TestFlight + Play Internal.

---

## If you get stuck

- Each row maps to a section in `plans/FOUNDER_OPS_PLAYBOOK.md` with the literal CLI commands + verify steps + gotchas
- Bench reconnect issues → `memory/running_on_phone.md`
- Supabase CLI weirdness → `memory/supabase_local_dev.md`
- BLE signature → DebugLauncher → BLE trace log

*This checklist is the operational counterpart to FOUNDER_OPS_PLAYBOOK.md. Run them side-by-side: playbook for "why and how," this file for "what to tick next."*
