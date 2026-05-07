# Sprint 9.5 — Apple Health + Android Health Connect Integration

## Goal
Two-way sync between Leiko vitals and the platform health store on each OS. Read other vitals from the platform (weight, glucose, etc.) into a parallel `external_vitals` namespace; write Leiko's BP/HR/SpO2/Sleep/Steps/Calories to the platform per D13 §12. Promoted from v1.1 to v1.0 per the Apple-of-Healthcare positioning — not having Apple Health integration would be a credibility wound.

## Duration
~1.5–2 work-weeks.

## Hard dependencies
Sprint 7.5 (multi-vital data flowing). Sprint 8 (Settings hub for the toggle, comes in Sprint 10 — this sprint provides the bridge service).

## Docs to load
docs/_reference/D13-multi-vitals-constellation-spec.md (§12), CLAUDE.md, docs/01-data-model.md.

## Deliverables
- `services/health-platform/` module — wraps Apple HealthKit (iOS) and Health Connect (Android) behind a unified TypeScript interface
- Permission UX per D13 §12.5:
  - Self-buyer asked at end of onboarding
  - Caregiver NOT asked (privacy boundary)
  - Parent (own phone) asked at first home-screen render
- Write path: every successful `/sync` triggers a write to platform with the same payload (BP correlation type, HR, SpO2, Sleep with stages, Steps, Active Energy)
- Read path: pull weight, height, blood glucose into `external_vitals` namespace on a daily background fetch
- Apple HealthKit identifiers per D13 §12.2 (BP correlation type, HR, SpO2, Sleep with stage subtypes, StepCount, ActiveEnergyBurned)
- Android Health Connect record types per D13 §12.4 (BloodPressureRecord, HeartRateRecord, OxygenSaturationRecord, SleepSessionRecord, StepsRecord, ActiveCaloriesBurnedRecord)
- App Store entitlement justification copy (HealthKit usage description in Info.plist)
- Android manifest declarations for Health Connect permissions
- Granular Settings per-vital toggle (Sprint 10 builds the UI; here we provide the state surface)

## Acceptance criteria
- iOS: a fresh BP reading appears in Apple Health within 60s of capture
- iOS: a fresh sleep session appears in Apple Health with correct stage breakdown
- Android: same for Health Connect (provided HC is installed on the device)
- Read path: a synthetic weight entry in Apple Health appears in `external_vitals` within 24h
- Permission denial UX is calm — no escalating language; user can change their mind later in Settings
- Caregiver path: caregiver is NEVER asked for HealthKit permissions (parent's data is not on caregiver's Apple Health)
- Master toggle off = nothing reads or writes
- App Store entitlement justification copy passes voice gate
- HealthKit unit tests pass with mock provider

## Open prompt
Sprint 9.5 — Apple Health + Android Health Connect. Read CLAUDE.md, then docs/_reference/D13-multi-vitals-constellation-spec.md (§12).

Propose:

1. Library choice — `react-native-health` for iOS, `react-native-health-connect` for Android — both reasonably maintained; confirm against docs/00-tech-stack.md or propose alternatives
2. Background fetch strategy for the read path — iOS Background App Refresh vs explicit user-initiated
3. Granular per-vital toggle persistence — MMKV or Supabase
4. Conflict resolution if Leiko writes a BP reading and the user has another source writing BP at the same minute
5. App Store review prep — HealthKit-using apps require detailed entitlement justification

Wait for approval.

## Risk notes
- App Store review adds ~2 days vs non-HealthKit apps. Plan for this in Sprint 17.
- Health Connect on Android < 12 has compatibility limitations; document gracefully (no error if HC unavailable, just toggle disabled with explainer).
- Two-way sync introduces conflict cases. Default policy: each source writes to its own namespace; we never overwrite an external source's reading.

## External dependency
- Apple Developer account must have HealthKit entitlement enabled before Sprint 9.5 begins.
- Android Health Connect requires the Health Connect app installed on device for testing.

## What this sprint explicitly does NOT ship
- Other platform integrations (Garmin, Fitbit, Oura, Whoop) — deferred to v1.1+
- Bidirectional sync UI in Settings (Sprint 10)
- Strava / Apple Fitness+ workout integration — out of scope
