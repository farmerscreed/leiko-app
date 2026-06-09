# Closed-test launch runbook (Android)

**Goal:** get Leiko into a Google Play **closed test**, recruit testers from
`leiko.app`, and satisfy the individual-account requirement (**≥12 testers
opted-in, continuously, for 14 days** before production).

This stitches the existing release docs into one ordered path:
- `docs/release/android-release.md` — keystore + AAB build mechanics
- `docs/release/play-console-data-safety.md` — Data Safety answers
- `docs/release/foreground-service-implementation.md` — FG-service notes
- `plans/PRODUCTION_READINESS.md` — the OPS-1..12 founder checklist

Context for this run (founder, 2026-06-02): Play account = **individual**;
upload keystore = **already generated**; first test scope = **full**
(push + Plus). All external services under `primethebrain@gmail.com`.

---

## Strategy: start the clock first, polish during the 14 days

The 14-day / 12-tester clock starts when a build is **live in the closed
track** and testers are opted in. So:

1. **Sprint 1 (today–day 1):** build + upload a first AAB, create the
   closed track, stand up the tester funnel. **Clock starts.**
2. **Sprint 2 (during the window):** wire FCM push + RevenueCat, ship them
   as updates to the *same* track. Testers auto-update; the clock keeps
   running. "Full experience" lands without delaying the clock.

---

## Phase 0 — Backend is live (verify, ~10 min)

These gate the app working at all for testers. Most are already deployed
(migrations 0027–0029, edge functions). Confirm:

- [ ] **OPS-1/OPS-2** — prod migrations applied + `pg_cron` GUCs set
  (`app.settings.functions_base_url`, `app.settings.service_role_key`).
- [ ] **OPS-11** — edge-function env vars in prod Supabase
  (`ANTHROPIC_API_KEY`, `EXPO_ACCESS_TOKEN`, `RESEND_API_KEY`, etc.).
- [ ] **OPS-12** — prod Supabase URL/anon in the build env (already in
  `eas.json` production profile ✓).

## Phase 1 — Build a signed AAB (~20 min) ⟵ START HERE

You already have `leiko-release.jks`. Full steps in `android-release.md`.

1. [ ] **Grab the upload-key SHA-256** (needed for deep-link verification —
   send it to Claude to fill `assetlinks.json`):
   ```bash
   keytool -list -v -keystore ~/secrets/leiko-release.jks -alias leiko
   ```
   Copy the `SHA256:` line.
2. [ ] Fill `~/secrets/leiko-release.env` (signing + version + Supabase +
   optional Sentry/PostHog/RevenueCat keys).
3. [ ] Build:
   ```bash
   cd apps/mobile
   source ~/secrets/leiko-release.env
   LEIKO_RELEASE_ACK=yes npm run release:android:aab
   ```
   Output: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`
4. [ ] Verify signature: `apksigner verify --print-certs app-release.aab`.

## Phase 2 — Play Console: create app + closed track (~1–2 hr)

Under `primethebrain@gmail.com`:

1. [ ] **Create app** — name "Leiko", package `com.leiko.care`, free, app
   (not game).
2. [ ] **Enable Play App Signing** (default). After the first upload, copy
   the **App signing key SHA-256** (Test & release → Setup → App signing) →
   send to Claude for `assetlinks.json` (this is the *second* fingerprint).
3. [ ] **Testing → Closed testing → create a track** (e.g. "alpha").
4. [ ] Upload `app-release.aab` to the track. Add release notes.
5. [ ] **Store listing essentials** (closed test still needs these):
   - [ ] Short + full description (seed from `app.json` `description`).
   - [ ] App icon (512), feature graphic (1024×500), ≥2 phone screenshots.
   - [ ] **Privacy policy URL** (host on leiko.app — required for health data).
6. [ ] **App content** (left nav) — all required questionnaires:
   - [ ] **Data safety** → use `docs/release/play-console-data-safety.md`.
   - [ ] **Health apps declaration** — declare BP/heart-rate/health data +
     Health Connect use. (Health data + foreground-service = extra review;
     expect a few days. Be accurate: "describe, not diagnose".)
   - [ ] **Permissions** — justify `BLUETOOTH_*`, `ACCESS_FINE_LOCATION`
     (BLE scan), `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `POST_NOTIFICATIONS`.
   - [ ] Content rating questionnaire.
   - [ ] Target audience (adults; **not** designed for children).
7. [ ] Send the track for review → roll out to closed testing.

## Phase 3 — Tester funnel from leiko.app (~1 hr) — starts the clock

The individual-account rule needs **12 opted-in testers for 14 days**.

1. [ ] **Create a Google Group** as the tester list, e.g.
   `leiko-testers@googlegroups.com` (set "Anyone can join" or
   request-to-join).
2. [ ] In the closed track → **Testers** → add the Google Group.
3. [ ] Copy the track's **opt-in URL**
   (`https://play.google.com/apps/testing/com.leiko.care`).
4. [ ] Wire the **leiko.app "Join the beta"** funnel (see
   `plans/beta-landing-funnel.md`): join group → opt-in URL → Play listing.
5. [ ] Recruit ≥12 real testers and keep them in for 14 continuous days.

## Phase 4 — Full experience (during the 14-day window)

Ship these as updates to the same closed track; testers auto-update.

- [ ] **FCM (push)** — create a Firebase project, add Android app
  `com.leiko.care`, download `google-services.json`, set
  `app.json` → `android.googleServicesFile`. For Expo push, upload the FCM
  **v1 service-account key** to EAS credentials. Rebuild + upload.
- [ ] **RevenueCat (Plus)** — create the Play app in RevenueCat, set
  `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` (`goog_…`), create the
  subscription products in Play (**$4.99/mo · $39.99/yr** per
  `docs/09-paywall-and-iap.md`), link the Play service account, and point
  the `revenuecat-webhook` edge function secret. Rebuild + upload.
- [ ] **Deep links** — once `assetlinks.json` has both real SHA-256s, host
  it at `https://leiko.app/.well-known/assetlinks.json` (+ the iOS
  `apple-app-site-association` when iOS lands) so Connect invite links open
  in-app.

## Phase 5 — Promote to production (after 14 days)

- [ ] Confirm Play shows the 12-tester / 14-day requirement satisfied.
- [ ] Apply for production access; submit the production release.

---

## What Claude can do in-repo (hand off to it)

- Fill `apps/mobile/well-known/assetlinks.json` once you send the two
  SHA-256 fingerprints (upload key + Play app-signing key).
- Extract hardcoded domains (`leiko.app`, `pair.leiko.app`) to one config
  module (POL-2) for consistent web↔app linking.
- Draft the leiko.app beta-landing copy + button flow
  (`plans/beta-landing-funnel.md`).
- Wire `android.googleServicesFile` + the RevenueCat key plumbing once you
  have the Firebase + RevenueCat artifacts.
