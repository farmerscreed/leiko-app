# Caregiver Two-Phone Test Flow

Sprint 16.6 — Pre-Launch Validation & Hardening, deliverable A.3.

This is the script for the two-phone end-to-end test rig. Run it
twice during the sprint:

1. **Mid-week** — catches most bugs before P1 hardening lands.
2. **End-of-sprint** — confirms the hardening fixes did not regress.

Record results in `CAREGIVER_TEST_RESULTS.md` (one row per scenario).
Capture a screen recording of every FAIL.

## Bench setup (one-time)

| Asset | Identity |
|-------|----------|
| Phone 1 | Caregiver-mode account (the one watching) |
| Phone 2 | Self-buyer-mode account (the one being watched) |
| Watch 1 | Historically paired to Phone 1 (bench-test watch) |
| Watch 2 | New, unpaired, will pair to Phone 2 |
| Dev PC | Supabase + Mailpit running locally; LAN-reachable |
| Wi-Fi | Same SSID across both phones + PC |

**Why two real accounts, not persona-switch on one account:**
`account_type` is immutable per D8a §14.1. There is no migration path
between caregiver and self-buyer. Two phones means two real
sign-ups + a family link between them.

**Why the parent persona is the self-buyer account, not the
large-text "parent" route:** the parent route is read-only by spec
(D5 / 17). For an active test where the parent takes readings, the
self-buyer flow is the realistic simulation.

## Pre-flight (before any scenario)

- [ ] `supabase start` running on the dev PC.
- [ ] `pwsh -File scripts/dev-phone-reconnect.ps1` reports all green.
- [ ] `pwsh -File scripts/build-preview-apk.ps1` produced an APK.
- [ ] Phone 1 has the APK installed; Phone 2 has the same APK
      installed via `adb install -r`.
- [ ] Both phones can reach `http://<LAN-IP>:54324/` in Chrome
      (Mailpit web UI). If not, fall back to USB-tethered mode.
- [ ] Both phones uninstall any previous Leiko build before sideloading
      this one (clears MMKV state cleanly).

---

## Scenarios

### S1 — Fresh-install onboarding, caregiver (Phone 1)

**Pre:** app freshly sideloaded, no prior state.

**Steps:**
1. Launch Leiko on Phone 1.
2. Sign-up flow → enter an email you can read in Mailpit.
3. Retrieve the 6-digit OTP from `http://<LAN-IP>:54324/` on the dev PC.
4. Enter OTP.
5. At the persona fork: pick **Caregiver**.
6. Complete caregiver onboarding (display name, who you care for, etc.).

**Expect:**
- Lands on Caregiver Home with the "no readings yet" empty state.
- No persona-fork CTA reappears on subsequent launches.
- Account type immutable — Settings shows persona but no edit affordance.

### S2 — Fresh-install onboarding, parent-target (Phone 2)

**Pre:** Phone 2 app freshly sideloaded, separate email from S1.

**Steps:**
1. Launch Leiko on Phone 2.
2. Sign-up flow → separate email (e.g. founder+parent@…).
3. OTP via Mailpit.
4. At the fork: pick **Self-buyer** (the practical "parent taking
   their own readings" simulation).
5. Complete self-buyer onboarding.

**Expect:**
- Lands on Self-Buyer Home with empty state.
- No reference anywhere to "caregiver" or the other account.

### S3 — Family invite + accept (caregiver → parent)

**Pre:** S1 + S2 complete.

**Steps:**
1. Phone 1 → Settings → Family → Invite.
2. Enter Phone 2's email; the app generates a 6-digit code.
3. Verify behaviour:
   - The code is visible in-app on Phone 1 (always, by spec).
   - If FUN-1 (SMTP) has shipped: an invite email arrives in Mailpit.
   - If not: founder reads the code aloud as the fallback.
4. Phone 2 → Settings → Join family → enter the 6-digit code.

**Expect:**
- Phone 1 shows the parent's display name on Home and in the family list.
- Phone 2 shows the caregiver's display name on its Settings family row.
- The invite is single-use (re-entering the same code fails gracefully).

### S4 — Watch pairing on Phone 2

**Pre:** S3 complete. Watch 2 powered on and within range.

**Steps:**
1. Phone 2 → Settings → Pair watch (or onboarding pairing flow if not
   yet completed).
2. BLE permission prompt → grant.
3. Scan list → pick Watch 2 → confirm.
4. Wait for `applyDeviceConfig` to push demographics + goals.

**Expect:**
- Watch shows as connected on Phone 2.
- Watch face flips to show the right time after `applyDeviceConfig`.
- Memory note: this is the FUN-7 verification step (force-flag
  wired in Sprint 12.5.2; never re-verified post-Sprint 16.5a).

### S5 — Take reading → sync → caregiver visibility

**Pre:** S4 complete.

**Steps:**
1. Phone 2 → "Take a reading" → wait for the watch.
2. After the reading lands on Phone 2's Home, switch to Phone 1.
3. Wait up to 30 seconds (the realtime channel + server hydration).

**Expect:**
- The reading appears on Phone 1's Caregiver Home with the same
  systolic / diastolic / pulse values as Phone 2.
- Timestamp is correct (UTC+8 watch quirk applied — memory file
  `watch_timestamp_quirk.md`).
- BP value matches between phones (QUA-1 BP-mismatch check; if they
  differ, capture the firmware trace).

### S6 — Anomaly trigger

**Pre:** S5 complete. `detect-anomaly` Edge Function running locally
(it polls; check with `supabase functions serve`).

**Steps:**
1. Either trigger a deliberately high reading via the watch, OR
   insert a synthetic anomalous BP row via SQL.
2. Wait for the detect-anomaly cron tick (or invoke it manually).
3. Observe Phone 1.

**Expect:**
- Phone 1 receives a push notification within ~60s.
- Opening the app shows the `ScreenAnomalyBanner` on Home.
- Quiet-hours bypass respects the user's Settings toggle (default off).
- Voice-lint check on the banner copy: no "patient", "diagnose",
  "dangerous", "critical", etc.

### S7 — Trends letter (caregiver reading parent's data)

**Pre:** at least 7 days of multi-vital data on Phone 2's account.
If the bench doesn't have a week of data yet, seed via the dev tools.
Note which path was used.

**Steps:**
1. Phone 1 → Trends.
2. Wait for "The Letter" to render.
3. Read every sentence.

**Expect:**
- Parent's actual name appears in the copy (not "her", not "your
  parent" placeholder).
- Focal vital is AI-picked, not always BP.
- Baseline reference + r-value present where the Sprint 16.5g engine
  fired.
- "Talk to your doctor" phrasing — not "consult a healthcare provider".
- No voice-rule violations: no "diagnose", "treat", "predict",
  "silent killer", etc.
- Plus-gated 30D / 90D / 1Y pills show the lock chip if the account
  is not Plus.

### S8 — For-your-doctor PDF (caregiver mode)

**Pre:** S7 dataset.

**Steps:**
1. Phone 1 → For-your-doctor.
2. Review the cover letter preview.
3. Tap Generate → wait for the PDF.
4. Preview the PDF on-device.
5. Share via OS share sheet to a target you can re-open (email
   yourself a copy).

**Expect:**
- Parent's name on the cover (not "her" hardcoded).
- Multi-vital gate fires correctly if not enough data.
- "Last generated" timestamp accurate.
- Offline state handled gracefully if the network drops.
- Baseline reference visible on charts.
- PDF page count dynamic (Sprint 16.5h).
- DEC-1 string resolution applied (either "It is not a diagnosis"
  with the voice-lint exemption, or the reframed version — whichever
  the founder picked).

### S9 — Settings flows, both sides

**Pre:** prior scenarios complete.

**On Phone 1 (caregiver):**
- Profile edit: display name, cm/ft toggle, kg/lbs toggle, height,
  weight. Verify each round-trips.
- Anomaly toggles (per-vital) — flip a few, kill app, reopen.
- Quiet hours start/end — set, verify saved.
- Theme: auto / light / dark (UI may only ship auto for now).
- Data export → OS share sheet.
- Family management → invite again, remove the link.

**On Phone 2 (self-buyer):**
- Same Profile fields.
- Health-platform connection (Health Connect on Android).
- Sign out from family.

**Expect:**
- No Android keyboard regressions (Sprint 12.5.2 fixed several).
- Every value persists across a kill-and-relaunch.
- No fields auto-fill from previous values (medical-data rule).

### S10 — Sign-out / sign-back-in resilience

**Pre:** prior data set + family link in place.

**Steps:**
1. Phone 1 → Settings → Sign out.
2. Force-kill Leiko on Phone 1.
3. Cold launch → Sign in with the same caregiver email + OTP.

**Expect:**
- Family link still intact (parent visible).
- Server-hydration hooks populate Home with last-known BP / HR /
  SpO2 / sleep / activity within ~2s of landing on Home.
- No re-onboarding prompt; persona persists.
- No duplicate readings.

### S11 — Offline buffering + reconnect

**Pre:** S10 complete.

**Steps:**
1. Phone 2 → Airplane mode.
2. Take a reading via the watch (or sync a buffered reading).
3. Observe the OfflineBanner on Phone 2.
4. Turn airplane mode off; wait for sync.
5. Switch to Phone 1.

**Expect:**
- The reading was buffered in MMKV during airplane mode.
- OfflineBanner appears on Phone 2 throughout the offline window.
- On reconnect, the sync drains within ~60s.
- Phone 1 sees the reading after Phone 2's sync completes.

### S12 — Background-fetch (long-clock)

**Pre:** S11 complete.

**Steps:**
1. Take a reading on Phone 2.
2. Force-quit Leiko on Phone 2 (swipe from recents).
3. Leave Phone 2 closed for 30+ minutes (sleep, locked screen).
4. Open Phone 1 (do not touch Phone 2 yet).

**Expect:**
- Phone 1 reflects the reading without Phone 2 being re-opened.
- This validates `services/sync/backgroundSync.ts` end-to-end
  (FUN-8 in PRODUCTION_READINESS.md).
- If the test fails, note whether the background task ran at all
  (Android battery optimisation can suppress it).

---

## Reporting

- For each scenario, fill in PASS / FAIL / NOTE in
  `CAREGIVER_TEST_RESULTS.md`.
- For each FAIL: capture a screen recording on the failing phone +
  any relevant `adb logcat` output.
- Voice-lint findings on any user-visible string: file path +
  exact phrase, even if the rest of the scenario passes.
- If a scenario can't be run (e.g. SMTP not yet wired, can't test
  S3 email path), mark NOTE with the reason and continue.

## Out of scope for this rig

- Apple Health write-path on iOS (no iOS prebuild yet — OPS-3).
- RevenueCat IAP flow (OPS-8 not yet shipped).
- Real APNs / FCM push delivery (OPS-7; bench uses sandbox).
- Maestro E2E coverage (Sprint 17).
