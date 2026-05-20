# Sprint 16.6 — Pre-Launch Validation & Hardening

## Goal

Get the app **demonstrably production-ready** without actually
submitting to the stores. Run a full two-phone caregiver test on real
watches; surface what testing finds; clear the P1 engineering items
from `plans/PRODUCTION_READINESS.md`; start the long-clock external
ops items in parallel so Sprint 17 doesn't wait on them.

This sprint sits **between** the 16.5a–i hardening passes and Sprint
17 (Launch). 16.5a–i closed the data-plane gaps that surfaced from
single-phone bench work. 16.6 closes the cross-device + family-flow
gaps that only surface with two phones in a real family. 17 is then
just submission + screenshots + monitor.

## Duration

~1 work-week. ~3 days testing, ~2 days hardening, parallel ops work
across the week.

## Hard dependencies

- Sprint 16.5i complete (PRODUCTION_READINESS.md committed)
- A second phone + second Urion watch on hand (founder)
- LAN-reachable dev Supabase (existing setup)

## Docs to load

- `plans/PRODUCTION_READINESS.md` (the audit; gates everything in this sprint)
- `docs/05-voice-and-claims.md` (any new strings)
- `memory/sprint_16_5e_close_out.md` (server hydration pattern — caregiver mirror just landed in 16.5i)
- `memory/running_on_phone.md` (WiFi/extender quirk, adb reverse details)

---

## Deliverables

### A. Two-phone test rig (engineering, day 1)

1. `apps/mobile/eas.json` — add `preview-lan` profile that injects a
   build-time `EXPO_PUBLIC_SUPABASE_URL` pointing at the dev computer's
   LAN IP, plus the matching anon key. Production profile stays
   untouched.
2. `scripts/build-preview-apk.ps1` — PowerShell helper that:
   - Reads the host's current LAN IPv4 (`Get-NetIPAddress`)
   - Validates Windows Firewall has 54321 + 54324 open on the LAN
     subnet (warn + suggest the `New-NetFirewallRule` command if not)
   - Calls `eas build --platform android --profile preview-lan --local`
     OR `npx expo run:android --variant release` with env baked in
   - Prints the APK path for `adb install`
3. `plans/CAREGIVER_TEST_FLOW.md` — step-by-step test script:
   - Two-phone onboarding sequence (caregiver + parent accounts)
   - Family invite + accept via 6-digit code
   - Watch pairing on phone 2
   - Reading take → sync → caregiver sees on Home
   - Anomaly trigger (deliberately high reading)
   - Trends letter on caregiver phone (parent's data)
   - For-your-doctor PDF flow (caregiver mode)
   - Settings flows on both sides
   - Sign-out / sign-back-in resilience
4. `plans/CAREGIVER_TEST_RESULTS.md` — empty template the founder
   fills in during testing. One row per scenario: `PASS / FAIL / NOTE`.

### B. P1 engineering hardening (days 2–4)

In priority order — top of list is most user-visible:

1. **SEC-1: MMKV encryption** (1-2 days)
   - Eager bootstrap: App.tsx awaits keychain key via
     `expo-secure-store` before mounting any consumer
   - Generate-or-read a per-install 32-byte key; pass to `createMMKV`
   - Migration story: first launch on existing installs reads
     unencrypted MMKV, copies into the new encrypted instance, then
     deletes the legacy keys
2. **FUN-1: SMTP / email transport for family invites** (2 hr)
   - Pick Resend or SendGrid (Resend cheaper for low volume)
   - Wire into `send-family-invite/index.ts` after the code-generation
     block; fan out an HTML email with the 6-digit code
   - Caregiver still sees the code in-app as a fallback
3. **FUN-2: Hard-delete cron + 30-day SLA for `delete-account`** (1 hr)
   - New migration `0020_pg_cron_hard_delete.sql`
   - Cron runs daily; for any `users.deleted_at < now() - 30 days`,
     cascade-purge rows in readings / vitals_other / families / etc.
4. **QUA-1: BP value mismatch (firmware race after `0x73 0x02`)** (2 hr)
   - Either: settling-delay of ~200ms after `0x73 0x02` before reading
   - Or: vote-on-retry — take 3 reads, accept the majority value
   - Trace from `scenario-11` is the reference; recurrence on next
     mismatch confirms the fix
5. **QUA-7: App Store + Play Store metadata stubs** (1 hr)
   - Add to `app.json`: description, privacy, supportUrl, marketingUrl
   - These need real URLs once OPS-9 (DNS) lands; placeholder TODOs OK
6. **FUN-4: Reminder dispatcher** (2 hr)
   - Wire `Notifications.scheduleNotificationAsync` to the existing
     learned-time engine output. One scheduler call per active reminder
     window per day; tear down on Settings toggle.
7. **QUA-5: iOS `PrivacyInfo.xcprivacy`** (1 hr)
   - Add `expo-apple-app-privacy` plugin to `app.json`
   - Declare data accessed: Bluetooth (peripheral, device name), Health
     (read weight/glucose, write BP/HR/O2/sleep/steps)
8. **QUA-4: CI deploy workflow** (half-day)
   - `.github/workflows/release.yml` — on tag push, runs `eas build`
     + `eas submit` (gated by manual approval for prod)
   - `.github/workflows/db-migrate.yml` — on main push, runs
     `supabase db push --project-ref` with secrets
9. **QUA-6: npm audit fix** (half-day)
   - Try `npm audit fix` first; if it breaks Expo, document the
     non-fixable transitives + add `npm audit` to CI with allowlist

### C. Parallel founder ops (day 1 kickoff, churns across the week)

Founder starts these on day 1 of the sprint so the elapsed-time
clocks run while engineering works:

| ID | Item | Estimated wait |
|----|------|---------------|
| OPS-3 | `npx expo prebuild --platform ios` | Same day |
| OPS-4 | HealthKit entitlement on Apple Dev account | Same day (request); approval 24-72h |
| OPS-5 | Generate Android release keystore | Same day |
| OPS-7 | APNs `.p8` + FCM service account credentials | Same day (collect); 1 day to wire |
| OPS-8 | RevenueCat signup + IAP product creation | Same day (signup); 1-3 days approval |
| OPS-9 | `leiko.app` DNS + AASA + assetlinks hosting | Same day |
| OPS-10 | App Store demo account + privacy URL drafted | Same day |
| FUN-6 | Pick PDF rasterizer vendor (PDFShift / Browserless) | Same day |

The OPS-1 / OPS-2 / OPS-11 / OPS-12 items all depend on a **prod
Supabase project existing**. Founder creates that on day 1
(`supabase projects create leiko-prod`, ~5 min); the project doesn't
need to be deployed-to yet, just provisioned.

### D. Test execution (days 3–5)

After A is built, run through `CAREGIVER_TEST_FLOW.md` end-to-end at
least twice — once mid-week (catches most bugs), once at sprint end
(verifies the hardening fixes didn't regress).

Each test session: founder + watch on Phone 2, caregiver session on
Phone 1. Capture screen recordings for any failure.

### E. DEC-1 decision: the "diagnosis" voice-rule conflict

Resolve before Sprint 17. Two paths:

1. **Keep the mandated phrase**: leave `"It is not a diagnosis"` as-is;
   add a comment in `services/voice/voiceLint.ts` exempting this one
   string (with a refernece to docs/05 + D3 regulatory). Lower risk
   per regulatory expectations.
2. **Reframe**: replace with `"This report is general information.
   Talk to your doctor about what it means."` — cleaner voice-lint
   pass; check with regulatory advisor first.

Founder picks. I'll wire whichever direction in a 5-min commit.

---

## Acceptance criteria

- Two-phone caregiver test rig runs end-to-end on real hardware
  without manual tethering of Phone 2 to a computer
- All P1 engineering items in §B shipped + tested
- All parallel ops items in §C either complete or have a concrete
  ETA from the external party (e.g. "RevenueCat product live by
  Wednesday")
- `CAREGIVER_TEST_RESULTS.md` shows ≥ 90% PASS across the test plan;
  any FAIL has a follow-up commit
- Voice-lint clean on any new strings authored this sprint
- `plans/PRODUCTION_READINESS.md` updated — every closed item marked
  ✅; items deferred to Sprint 17 are explicit
- DEC-1 resolved + committed

## Open prompt (for next session)

Sprint 16.6 — Pre-Launch Validation & Hardening. Read CLAUDE.md, then
`plans/PRODUCTION_READINESS.md`, then this sprint card. The two-phone
test rig in §A is the first deliverable — engineering must build that
before founder can start §D testing.

Propose:
1. The eas.json `preview-lan` profile contents
2. The `scripts/build-preview-apk.ps1` helper
3. The `plans/CAREGIVER_TEST_FLOW.md` outline (every scenario named)
4. The order of P1 items in §B (which to attack first)

Wait for founder approval before writing code.

---

## Risk notes

- **The LAN test rig depends on WiFi reliability.** Memory file
  `running_on_phone.md` documents that the MTN extender at the
  founder's location blocks peer-to-peer traffic. Plan B: Phone 2
  tethered to the dev computer via USB just for adb-reverse on
  :54321 (same pattern Phone 1 already uses). Cost: Phone 2 needs to
  be near the computer.
- **MMKV encryption can break first-launch existing installs.** The
  migration step (legacy unencrypted → encrypted) must be exercised
  on a build that had data in MMKV before the upgrade. If it fails,
  user loses their pending readings buffer (offline-first guarantee
  broken). Test the upgrade path explicitly.
- **External ops items have hidden dependencies.** RevenueCat needs
  Apple + Google products to be CONFIGURED in App Store Connect /
  Play Console first, which needs the bundle ID submitted via a
  build, which means OPS-3/4/5/6 must clear first. The dependency
  graph compresses by maybe 1-2 days; not a blocker but worth
  knowing.

## Bench environment state at sprint start

Phone 1: `43230DLJH001YY` (currently caregiver-targeted, will continue)
Phone 2: brought out today, not yet provisioned
Watch 1: paired to Phone 1 historically (the bench-test watch)
Watch 2: new, unpaired

Local Supabase: running on dev computer, `54321` + `54324` exposed via
adb reverse currently (LAN exposure pending §A.1).
