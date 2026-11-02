# Leiko US launch — complete handoff for a fresh session (2026-11-02)

> **Who this is for:** a brand-new Claude Code session with no memory of
> earlier work. Read this file top to bottom before doing anything, then
> follow the CLAUDE.md session-start protocol (propose → wait for founder
> approval → execute). Everything you need to know to start from scratch
> is here or linked from here. Where this file says **VERIFY**, the fact
> was not confirmed when written — check it before relying on it.

---

## 0. One-paragraph summary

Leiko is a caregiver-mode blood-pressure app paired with a wrist BP watch
that has a real inflating cuff (Urion U16 hardware, private-labelled as
Leiko). It launched first in Nigeria (presale, Naira pricing, Meta ads,
Paystack). **Nigeria did not convert** — the ads produced zero sales; the
founder believes price vs disposable income is the cause. The founder now
wants to **reposition for the US**: US-specific pricing on the websites,
an **iPhone app** (the app is Android-only today), and a clear go-to-market
direction. This plan covers the strategy (already argued with the founder,
§2), and seven workstreams (§4–§10) with tasks, owners, acceptance
criteria and the order to do them in (§11).

---

## 1. Facts you need (state as of 2026-11-02)

### 1.1 Company and people
- Founder: Lawrence ("Law") Okpokiri. Prefers directness and honest
  pushback over agreement. Not a developer; he runs builds and console
  steps when guided click-by-click. He is in the US (Atlanta area) until
  ~11 Nov 2026, then Port Harcourt, Nigeria.
- US entity: **LawOne Cloud LLC** (US-registered). Use it for the Apple
  developer account, Stripe, US contracts. Banking: Mercury / Wise Business
  have been explored; a PNC personal account exists (personal, not the LLC).
- Hardware: **Shenzhen Urion Technology Co., Ltd.** Contact: Li Jiaming.
  The founder has visited the factory and holds their regulatory package
  (NMPA, FDA listing, ISO 13485, EU MDR).

### 1.2 Regulatory — the single most important fact
- **FDA 510(k) K254048**, cleared **2026-05-14** (Traditional), applicant
  Shenzhen Urion Technology: "Wrist Watch Electronic Blood Pressure
  Monitor", models **U16H, U16L, U16P, U16W, U19M, U19R, U19S, U19T**.
  Product code **DXN**, Class II, 21 CFR 870.1130.
  Source: https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K254048
- Marketing so far says "FDA-listed" (registration only). **"FDA-cleared"
  is the stronger, correct claim — but only for the cleared models.**
- **VERIFY with Urion (founder task):** (a) the exact model Leiko ships
  (the app's code refers to "U16H") is in K254048; (b) what is needed to
  sell it under the Leiko brand in the US (private-label / own-label
  distributor arrangement, labelling must match the cleared device,
  importer of record establishment registration, Urion's US agent). Get a
  short written answer, ideally confirmed by a US regulatory consultant.
- Any change to the device or its indications for use would need a new
  510(k). Do not change hardware, firmware measurement behaviour, or claim
  new indications.

### 1.3 Products and repos
| Repo | What | Notes |
|---|---|---|
| `farmerscreed/leiko-app` (public) | Mobile app (RN 0.81.5 / Expo SDK 54 **bare**, Hermes, new arch) + Supabase backend (`supabase/`) | This file lives here. Read `CLAUDE.md` first. |
| `farmerscreed/leiko` (private) | Websites **leiko.health** (watch/marketing, presale) and **leiko.app** (app landing) — **VERIFY** which repo/branch serves which domain and where it is hosted (likely Vercel; the founder's Vercel account is connected as an MCP in claude.ai sessions). | Has a `/join?code=` landing page (Connect invites). |
| `farmerscreed/leiko-content-machine` | Organic social content generation | Uses the Supabase project; see §9.4 security note. |
| `farmerscreed/leiko-redesign` | Design work | Context only. |

- Supabase prod project: **`kqnzxjrpnjnczhgdwdqg`** (Postgres, Auth via
  email OTP, Storage, Edge Functions). `db-migrate.yml` applies
  migrations on push to `main`. Edge functions are deployed by the founder
  (`npx supabase functions deploy … --project-ref kqnzxjrpnjnczhgdwdqg`).
- Android app: package **`com.leiko.care`**, Play listing "Leiko: Blood
  Pressure & Care". Version 1.1.0 (versionCode 25) is on Internal testing;
  26 (background-sync fix, PR #40) is next. **Ignore the stray Play entry
  `com.leiko.app`** — wrong app.
- iOS bundle id is already set: **`com.leiko.care`** (`apps/mobile/app.json`).
- Subscriptions: **RevenueCat** (`react-native-purchases` 9.15.3). The app
  reads `EXPO_PUBLIC_RC_API_KEY_IOS` (or `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`)
  on iOS — not yet created.
- Analytics: PostHog (project key `phc_…` only — **never** a `phx_`
  personal key in a build). Errors: Sentry.
- Auth: **email OTP only** (no Google/Facebook sign-in) → Apple's "Sign
  in with Apple" requirement (App Review 4.8) does **not** apply. If you
  add any social login, you must add Sign in with Apple too.

### 1.4 Current pricing (Nigeria, leiko.health)
- ₦50,000 refundable deposit; Leiko Watch from ₦250,000; Watch Pro
  ₦300,000; "Founder Edition" first 20 units; "no subscription required".
- leiko.app: Android app free during early access; iPhone = email waitlist.

---

## 2. Strategy (agreed direction, founder to confirm the open choices)

**Diagnosis.** In Nigeria the product fits but the *payer* can't. In the
US the payer can, but the general market is crowded (Omron, Withings,
Apple Watch hypertension notifications, cuffless bands) and paid
acquisition is expensive.

**Direction — three segments, in this order:**
1. **Diaspora caregivers (first 90 days).** Nigerians (and later other
   West African/Caribbean diaspora) in the US buy in USD for a parent back
   home; the parent wears the watch, the US-based child watches the
   readings in the app. This is exactly the existing caregiver feature and
   the "Japa" story. Reach is cheap and targeted (churches, associations,
   WhatsApp groups, community creators). Requires: USD checkout, shipping
   to Nigeria (existing stock/logistics) AND/OR US shipping, iPhone app
   for the US-based caregiver.
2. **US self-buyers / caregivers of US-based parents (after iOS ships).**
   Positioning: "a real cuff, on your wrist" + family circle + doctor-ready
   report. Organic/community + small, measured paid tests only.
3. **B2B: home-care agencies and clinics — Remote Patient Monitoring
   (RPM), in parallel, slower.** Medicare reimburses providers monthly for
   remote physiologic monitoring with an FDA-cleared device (CPT 99453,
   99454, 99457, 99458 — **VERIFY current codes/rules and the 16-day data
   requirement**). Leiko already has readings, a clinician-friendly PDF and
   multi-person caregiver views. Needs a provider dashboard and possibly
   BAA/HIPAA posture (today Leiko is NOT a covered entity — see CLAUDE.md
   data rules; B2B would change that). **Founder decision needed** before
   investing.

**Not doing:** broad US Meta ads to everyone (repeats the Nigeria loss at
a bigger budget).

**Open founder decisions (ask, don't guess):**
- D1. Hold US inventory (3PL/Amazon FBA) now, or diaspora-only shipping to
  Nigeria first?
- D2. Pursue B2B/RPM at all in the next 6 months?
- D3. Final US prices (§5 has the proposal).
- D4. Keep "no subscription required" promise for US? (Proposal: yes for
  readings; Plus subscription for family/AI/reports.)

---

## 3. Guardrails (apply to every workstream)

- **CLAUDE.md voice rules** apply to every user-visible string, including
  website copy: no "patient", "diagnose", "treat", "prevent", fear
  language, outcome promises. "Talk to your doctor."
- **Claims:** "FDA-cleared" only after §1.2 VERIFY is done, always with
  the 510(k) number; never "FDA-approved". No cuffless/"continuous BP"
  claims. Accuracy claims only as stated in Urion's 510(k) summary.
- **HSA/FSA:** BP monitors are commonly HSA/FSA-eligible — **VERIFY**
  before claiming; consider a third-party eligibility listing.
- **Founder-only actions:** creating accounts, signing agreements,
  entering payment/bank/tax details, Apple/Google console submissions,
  production deploys, merges to `main` (he types "merge N"), anything with
  passwords/2FA. Prepare everything and give click-by-click steps.
- **Secrets** never in chat, commits or docs. Keys live in the founder's
  local env script (`C:\Users\admin\secrets\leiko-release.ps1`) or EAS
  secrets / Vercel env.
- Never break Android while doing iOS. Run the full gates (tsc, eslint,
  jest — 252 suites / 2,886 tests as of PR #40) before every PR.

---

## 4. Workstream A — iPhone app (critical path)

**Goal:** Leiko on the App Store with feature parity for caregivers and
wearers, background sync that works within iOS rules, Apple Health,
subscriptions.

### A.1 Founder prerequisites (start day 1 — they gate everything)
1. D-U-N-S number for LawOne Cloud LLC (free via Apple's D-U-N-S lookup;
   ~1–2 weeks if it must be created).
2. Apple Developer Program enrolment **as an organization** (LawOne Cloud
   LLC), $99/yr. Needs D-U-N-S, legal authority, a website on the LLC's
   domain, and an Apple ID with 2FA.
3. App Store Connect: create app record `com.leiko.care`, name "Leiko:
   Blood Pressure & Care" (**VERIFY** name availability), primary category
   Medical (or Health & Fitness — decide with founder; Medical invites
   stricter review but matches the device).
4. Paid Apps agreement + banking + US tax forms in App Store Connect
   (required for subscriptions).
5. An iPhone for testing (iOS 16+ ideal; app's minimum is Expo SDK 54
   default 15.1).
6. Access to a Mac **or** use EAS Build (cloud) — recommended: EAS Build
   + EAS Submit, so no Mac is required. Founder needs an Expo account
   (**VERIFY** whether one exists; `eas.json` is already in
   `apps/mobile/`).

### A.2 What already exists for iOS (inspect, don't redo)
- `app.json` → `ios.bundleIdentifier com.leiko.care`, associated domains
  `applinks:leiko.app`, Info.plist strings for Bluetooth and Health,
  `UIBackgroundModes: bluetooth-central, fetch, processing,
  remote-notification`, `BGTaskSchedulerPermittedIdentifiers:
  leiko.sync.backgroundFetch`, `ITSAppUsesNonExemptEncryption: false`,
  a `privacyManifests` block.
- HealthKit adapter: `src/services/health-platform/adapters/native.ios.ts`
  using `@kingstinct/react-native-healthkit` 14.0.0 (ADR-0005). Writes BP,
  HR, SpO2, sleep, steps, active energy; reads weight/height/glucose.
- RevenueCat iOS key lookup in `src/services/purchases/index.ts`.
- `src/services/ble/foregroundService.ts` is an Android-only no-op on iOS.
- There is **no committed `ios/` folder** (Android is committed; iOS will
  be generated by `npx expo prebuild -p ios` or by EAS). Decide with the
  founder whether to commit `ios/` (bare workflow → recommended, matching
  Android) and add any native iOS code there.

### A.3 Engineering tasks (in order)
1. **Generate and build iOS** (EAS `development` profile first). Fix
   build breaks: pods, Nitro modules (MMKV 4.x, healthkit), Sentry,
   react-native-pdf / blob-util, notifications. Get the app to launch on
   the founder's iPhone via a dev/internal build.
2. **Audit every `Platform.OS === 'android'` branch** (8+ files) and every
   Android-only native module (`LeikoBleForegroundService`,
   `headlessDelay`, `holdJsTimers`, battery-optimisation prompts,
   MediaStore "Download to phone"). Each needs an iOS behaviour or a
   graceful hide. Notable: the Settings "Background updates"/battery
   exemption UI must not show on iOS; "Download to phone" → iOS share
   sheet / Files.
3. **BLE on iOS** (`react-native-ble-plx` ^3.5.1, protocol in
   `docs/06-ble-protocol.md`). iOS identifies peripherals by a per-phone
   UUID, not the MAC address — check every place the code stores/uses the
   watch's MAC (pairing, reconnect, device_id on uploads) and make it work
   with iOS identifiers. Test pairing, BP reading, history backlog, config
   push.
4. **Background sync on iOS — redesign, not port.** Android uses a
   15-minute expo-background-fetch wake + a foreground service. iOS has
   neither guarantee. Design (write an ADR first, `docs/_adr/0014-…`):
   - **Core Bluetooth state restoration** (`restoreStateIdentifier` in
     ble-plx) + keep a pending connection to the watch so iOS relaunches
     the app in the background when the watch is in range/advertising.
   - **BGAppRefreshTask** via expo-background-fetch as best-effort extra
     (iOS decides timing; often hours).
   - **Silent push** (`remote-notification`, already in background modes)
     from the server (`request-stale-syncs` already exists) to nudge a
     sync — best effort, throttled by iOS.
   - Set expectations in copy: "Leiko syncs when your watch is nearby and
     whenever you open the app."
   - Verify on device with Xcode/Console logs; record results in a plan
     file like `plans/IOS_BACKGROUND_SYNC_<date>.md`.
5. **HealthKit**: enable the HealthKit capability (and background delivery
   only if used), test write of all six types, Settings toggles, the
   caregiver exclusion (D13 §12.6: caregiver's phone never writes Mum's
   data to the caregiver's Health).
6. **Push notifications**: APNs key in Apple Developer → upload to Expo
   (or FCM for iOS if the stack uses FCM — **VERIFY** the current push path
   in `src/services/notifications`, `send-push` edge function, ADR-0010/0011).
7. **Subscriptions**: create the same products in App Store Connect
   (auto-renewable subscription group "Leiko Plus"), add an Apple app in
   RevenueCat, map entitlements identically to Android, set
   `EXPO_PUBLIC_RC_API_KEY_IOS` (`appl_…`) in the release env. Paywall must
   include restore purchases, terms + privacy links, price/period text
   (App Review 3.1.2).
8. **Deep links**: `leiko.app` must host
   `/.well-known/apple-app-site-association` for `com.leiko.care` (the
   repo has `apps/mobile/well-known/`; deploy it on the website).
9. **Release config**: an iOS equivalent of the Android release script
   guards (prod Supabase URL, `phc_` key only, RC `appl_` key present).
   Store secrets as EAS secrets, not in `eas.json`. Note: `eas.json`
   currently embeds the public anon key and `phc_` key in the `production`
   profile — those are public by design, but do not add anything secret
   there.
10. **Gates**: tsc 0, eslint 0, all jest suites, plus new tests for every
    iOS branch you add (CLAUDE.md testing standard).

### A.4 App Store submission package
- Privacy "nutrition label" (health data, contact info = email, usage
  data/PostHog, diagnostics/Sentry; data linked to user; not used for
  tracking). Mirror `docs/release/play-console-data-safety.md`.
- **Guideline 1.4.1 (medical):** be ready to provide the FDA 510(k)
  clearance (K254048) and the Urion/Leiko relationship documentation in
  the review notes. Apps that measure BP using hardware need regulatory
  clearance evidence.
- Guideline 5.1.3 (health data): no health data to advertising, no
  storing HealthKit data in iCloud.
- Demo account for App Review **plus** a video of the watch pairing and
  taking a reading (reviewers won't have the watch). Note in review notes
  that the app is useful without the watch for caregivers (viewing a
  family member's readings).
- Screenshots for 6.7"/6.5" (and 5.5" if still required), app preview
  optional. Use the Navy/Coral/Cream brand; real watch renders.
- TestFlight: internal (founder) → external (5–10 diaspora testers) for
  1–2 weeks before submitting.

**Acceptance:** app live on the US App Store; founder's iPhone pairs with
a watch, takes a BP reading, uploads it, a caregiver on Android sees it;
background sync observed at least once with the app not in the
foreground; Plus purchase + restore work in sandbox; HealthKit write
visible in Apple Health.

**Estimate:** 4–6 weeks elapsed, gated mostly by Apple account setup and
review; engineering ~2–3 weeks.

---

## 5. Workstream B — US pricing and checkout

**Proposal (founder to confirm, D3):**
| Item | US price (proposal) | Notes |
|---|---|---|
| Leiko Watch | $249 | Compare: Omron/Withings premium monitors; **VERIFY** current competitor prices before finalising |
| Leiko Watch Pro | $299 | Clarify what Pro adds (currently ₦300k vs ₦250k) |
| Leiko Plus | $7.99/mo or $69/yr | Family circle beyond X people, AI insights (Ask Leiko), doctor PDF history — **align with what the app gates today** (`src/services/purchases`, paywall screens) |
| Free tier | $0 | Readings, own history, basic sharing — keep "no subscription required to use the watch" |
| Diaspora bundle | e.g. $279 watch shipped to Nigeria + 3 months Plus | Requires shipping solution (D1) |

- Charge via **Stripe** under LawOne Cloud LLC (medical-adjacent hardware
  — prepare Stripe's risk questions: device clearance, refund policy,
  shipping times). Keep Paystack for Naira.
- Checkout must collect shipping country; diaspora orders capture the
  *wearer's* Nigerian address and the *buyer's* US contact.
- Sales tax: use Stripe Tax or a 3PL that handles it (**VERIFY** nexus).
- Refund/returns policy page (30 days is normal for US DTC).

**Acceptance:** a US visitor can pay in USD end-to-end; order lands in a
place the founder sees (email + sheet/DB); refund flow documented.

---

## 6. Workstream C — Websites (leiko.health, leiko.app)

1. Clone `farmerscreed/leiko`; read its README / handoff (`plans/LEIKO_WEB_HANDOFF.md`
   in leiko-app describes earlier web work). Identify framework and host.
2. **Country-aware pricing:** on Vercel, middleware reads
   `x-vercel-ip-country` (or `request.geo.country`) → `US` (and a manual
   region switcher, because diaspora buyers may browse from anywhere) →
   show USD prices + Stripe checkout; `NG` → existing Naira + Paystack.
   Default for unknown countries: USD. Make prices data-driven (one
   config), not hard-coded across pages. Cache-safe: vary by country.
3. **US copy pass** (voice rules apply): FDA-cleared claim with K254048
   (after §1.2 VERIFY), "real cuff on your wrist", Family Circle,
   doctor-ready report, HSA/FSA (if verified), iPhone + Android badges
   (iPhone = "coming soon" until live).
4. **Diaspora landing page** (e.g. `/family` or `/diaspora`): "Check on
   Mum from Houston" story, ships to Nigeria, caregiver app on your
   iPhone.
5. Deploy `apple-app-site-association` (and keep `assetlinks.json`).
6. Analytics: PostHog events for pricing views/checkout by country (no
   health values — CLAUDE.md data rule).

**Acceptance:** VPN/US IP shows USD; NG IP shows ₦; switcher works; Stripe
test checkout succeeds; Lighthouse ≥ 90 mobile; voice-rule pass.

---

## 7. Workstream D — Regulatory and legal (founder-led, Claude prepares)

- Written confirmation from Urion (§1.2 VERIFY), and their 510(k) summary
  + IFU (instructions for use) for US labelling.
- US regulatory consultant (one-off): own-label distributor / initial
  importer registration, labelling review (box, IFU, UDI), complaint
  handling and MDR (medical device reporting) obligations as the brand.
- Product liability insurance for US sales.
- US Terms of Service + Privacy Policy reviewed for US (state privacy
  laws incl. Washington My Health My Data Act — health data consent).
- If B2B/RPM (D2): BAA template, HIPAA security posture review — large
  scope; separate plan.

Claude's role: draft questions for Urion and the consultant, a document
checklist, and website/app copy that matches the labelling.

---

## 8. Workstream E — Logistics

- D1 decides: (a) ship from China/Nigeria stock to diaspora buyers'
  parents in Nigeria; (b) import to US and hold at a 3PL (e.g. ShipBob,
  ShipMonk) or Amazon FBA (Amazon requires medical-device category
  approval — **VERIFY**).
- Import: FDA entry review at customs (device must be listed under the
  right establishment; prior notice of the 510(k) number on entry docs),
  customs broker, duties.
- Pilot quantity: 20–50 founder units.

---

## 9. Workstream F — Go-to-market (diaspora pilot first)

1. **Pilot (weeks 6–10):** 20–50 founder units to diaspora caregivers via
   churches, Nigerian professional associations, alumni groups, WhatsApp
   communities, 2–3 diaspora creators. Founder Edition pricing.
2. **Measure:** activation (watch paired + first reading within 7 days),
   weekly active caregivers, readings/week, Plus conversion, refund rate,
   NPS. Instrument in PostHog (counts only).
3. **Content machine** (`leiko-content-machine`): add a US/diaspora
   content track; keep the human approval gate.
4. **B2B (if D2 = yes):** list 10 home-care agencies / primary-care
   practices in one metro (Atlanta or Houston — large Nigerian
   communities), pitch RPM pilot. Needs a minimal provider view —
   separate plan.
5. **Security before scale:** PR #37 (`0060_security_advisor_lockdown.sql`,
   RLS on content-machine tables, revoke anon EXECUTE on cron/admin
   functions) must be merged first — confirm the content machine uses the
   **service_role** key, then founder says "merge 37".

---

## 10. Workstream G — App changes for the US (beyond iOS)

- Units are already mmHg; check date/time formats (US: month/day, 12-hour)
  follow the device locale.
- Onboarding copy: US English pass (currently UK/NG flavour in places?
  **VERIFY**), and remove Nigeria-only assumptions (phone formats,
  currency strings, ₦ anywhere in the app).
- Paywall: USD prices come from the store (RevenueCat), never hard-coded.
- Caregiver in US + wearer in Nigeria: timezone handling already follows
  each user's device (PR #32) — test the cross-timezone caregiver view
  (it was deferred as "Stage 2" in earlier testing).
- Learn content / Ask Leiko: make sure US references (AHA guidelines,
  "talk to your doctor") are correct; Nigerian statistics only where
  labelled as such.

---

## 11. Sequenced roadmap (90 days)

| Week | Founder | Claude (engineering/content) |
|---|---|---|
| 1 | Apply D-U-N-S; email Urion (§1.2 questions, drafted by Claude); decide D1–D4; book regulatory consultant call | Clone both repos; iOS build spike (A.3.1) to size the work; write ADR-0014 (iOS background sync); prepare Urion/consultant question list |
| 2 | Apple Developer enrolment (once D-U-N-S arrives); Expo account; Stripe account for LLC | Website country pricing + US copy draft (behind a flag); A.3.2–A.3.3 |
| 3–4 | App Store Connect app record, agreements, tax, banking; RevenueCat iOS app | A.3.4–A.3.9; TestFlight internal build |
| 5 | TestFlight testing on own iPhone; recruit 5–10 diaspora testers | Fix TestFlight issues; App Store package (A.4) |
| 6 | Submit to App Review; finalise prices; order pilot units | Launch US website pricing + diaspora landing; Stripe live |
| 7–10 | Diaspora pilot sales; community outreach | Measure + fix; content track |
| 8–12 | B2B outreach (if D2) | Provider-view plan (if D2) |

**Definition of done for the US launch v1:** iPhone app live; websites
show USD pricing to US visitors with working checkout; claims verified;
20+ paid diaspora orders with ≥ 60% activation.

---

## 12. Android status at hand-off (so you don't redo it)

- 1.1.0 (25) on Play Internal testing; **build 26** carries PR #40
  (foreground service held before the storage gate — fixes background
  sync being frozen ~10 s after each wake). Verify on device, then promote
  to Production. See `plans/RELEASE_AUDIT_2026-10-30.md` and the Android
  close-out notes added on 2026-11-02.
- Health Connect: integration exists (writes BP/HR/SpO2/sleep/steps/
  calories; reads weight/height/glucose) — see
  `src/services/health-platform/` and ADR-0005. Status of any 2026-11-02
  follow-up work is recorded in `plans/NEXT_SESSION_START_HERE.md`.

## 13. Files to read first in the new session
1. `CLAUDE.md`
2. This file
3. `plans/NEXT_SESSION_START_HERE.md` (top banners)
4. `docs/00-tech-stack.md`, `docs/05-voice-and-claims.md`,
   `docs/06-ble-protocol.md`
5. `docs/_adr/0005-health-platform-libraries.md`,
   `docs/_adr/0010-*`, `docs/_adr/0011-*` (push), `0013` (AI guard)
6. `apps/mobile/app.json`, `apps/mobile/eas.json`,
   `src/services/ble/`, `src/services/tasks/registerHeadlessTasks.ts`,
   `src/services/purchases/`, `src/services/health-platform/`
7. `docs/release/` (Play runbooks — mirror them for iOS)

## 14. First message to send the founder in the new session
Propose: week-1 tasks from §11 (both columns), the four decisions D1–D4
as a short multiple-choice question, and the iOS build spike as the first
engineering task. Wait for approval.
