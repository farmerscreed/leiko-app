# App Store HealthKit Submission — Justification Copy

Source for the "App Review Information" → "Notes" field when submitting Leiko to App Store Connect, plus the HealthKit-specific entitlement justification Apple requires for any app that requests `com.apple.developer.healthkit`. Sprint 9.5 / Task 9.

> Apple's HealthKit review adds ~2 days vs non-HealthKit apps and can request follow-up clarification — keep this doc current and ready to paste.

---

## Per-permission rationale

Apple wants a per-data-type justification: which `HKObjectType`s does the app read, which does it write, and what user-facing benefit does each serve. Sourced from `docs/_reference/D13-multi-vitals-constellation-spec.md` §12.

### Read (NSHealthShareUsageDescription)

| HealthKit type | Why we read it |
| --- | --- |
| `HKQuantityTypeIdentifierBodyMass` | Surfaced on the Trends screen so users keep weight in one place alongside their watch readings. Used to display a small per-week weight series; never integrated into Leiko's anomaly engine. |
| `HKQuantityTypeIdentifierHeight` | Same purpose as weight — Trends-side surfacing only. |
| `HKQuantityTypeIdentifierBloodGlucose` | Surfaced on Trends as a separate read-only series for users who use a continuous glucose monitor. Read-only; we never alter glucose data. |

### Write (NSHealthUpdateUsageDescription)

| HealthKit type | Why we write it |
| --- | --- |
| `HKCorrelationTypeIdentifierBloodPressure` (sys + dia paired) | Leiko captures BP readings from the user's paired Urion U16 / U19 watch (FDA-listed Class II BP monitor). Writing the pair to Apple Health lets the user see Leiko-captured readings in the Health app's BP timeline alongside any other source they use. |
| `HKQuantityTypeIdentifierHeartRate` | Heart rate auto-samples the watch reports throughout the day. |
| `HKQuantityTypeIdentifierOxygenSaturation` | SpO2 auto-samples from the watch. |
| `HKCategoryTypeIdentifierSleepAnalysis` (with stage subtypes on iOS 16+) | Sleep sessions the watch records overnight, including light / deep / REM stage breakdown when available. |
| `HKQuantityTypeIdentifierStepCount` | Daily step totals from the watch. |
| `HKQuantityTypeIdentifierActiveEnergyBurned` | Daily active-energy totals from the watch. |

---

## Permission UX flow

Reviewers sometimes ask to see the permission prompt in context. Walk-through:

1. **Self-buyer onboarding** — after the user confirms "I have it" (the watch) and the family/account is created, the home screen renders. The HealthKit opt-in BottomSheet appears once, with calm copy ("Keep your numbers in one place"), a `Connect` CTA that triggers Apple's standard HealthKit permission sheet, and a `Maybe later` CTA.
2. **Caregiver path** — caregivers (users watching another person's vitals on their own device) are NEVER prompted. Their personal Apple Health is not the right place for the cared-for person's data. The component short-circuits to no-op for `account_type === 'caregiver'`.
3. **Parent (own phone) path** — parents using Leiko on their own iPhone see the same prompt as self-buyers, on first home render.
4. **Re-prompt** — never automatic. Users who decline can re-enable later via Settings (Sprint 10 ships the granular toggles UI).

The opt-in copy is in `apps/mobile/src/components/HealthPlatformPermissionPrompt.tsx`. The Info.plist usage descriptions in `apps/mobile/app.json` mirror that copy in tone.

---

## Background delivery / scheduled reads

Leiko does **not** use `HKObserverQuery` background delivery in v1.0. The read leg of the platform-health bridge runs on app foreground (with a 24-hour internal debounce), so we do NOT request the `com.apple.developer.healthkit.background-delivery` entitlement.

If a future version adds true OS-scheduled background reads, this doc must be amended and the entitlement requested in App Store Connect.

---

## Privacy, scope, and "what we don't do"

Reviewers frequently push back on broad HealthKit grants. Leiko's scope is intentionally narrow:

- We do NOT read any HealthKit type beyond the three named above (weight, height, blood glucose). Sleep / activity from the platform are NEVER pulled — Leiko writes those types and reading them back would round-trip our own data.
- We do NOT read user identity (name, DOB, etc.) from HealthKit. Identity stays in our backend (Supabase Auth).
- We do NOT auto-overwrite. Leiko writes its own samples only; if the user has BP data from another source on HealthKit, both coexist as separate samples.
- We filter out our own bundle id (`com.leiko.app`) on the read side so Leiko-written samples never round-trip back into our database.
- We never log reading values to analytics or crash reporting (PostHog and Sentry both have PHI-stripping wrappers — see `docs/00-tech-stack.md` Compliance Posture).

---

## Demo account for review

The reviewer needs a working account to exercise the HealthKit prompt:

- Account type: `self_buyer` (the persona that triggers the prompt; caregivers don't see it)
- Demo credentials: TBD before each submission — generate a fresh one and add to the App Review Information field.
- The Apple Health opt-in appears on first home render after account creation. Connecting with all defaults grants the full read + write set.

---

## Source links for the reviewer

- App description: docs/_reference/D11-brand-repositioning.md (Leiko positioning)
- Privacy policy URL: TBD (publish before submission)
- Health-data flows: docs/_reference/D13-multi-vitals-constellation-spec.md §12 + §13
- Compliance posture: docs/00-tech-stack.md (HIPAA-aligned, DTC, not a Business Associate)

---

## Updating this doc

Any change to:

- The set of HealthKit types we read or write
- The user-facing usage descriptions in `app.json`
- The permission UX flow

…must be reflected here BEFORE the next App Store submission. Drift between what we declare in the entitlement and what the reviewer sees in-app is the single most common cause of HealthKit rejection.
