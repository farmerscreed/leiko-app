# Play Console Data Safety — Leiko answers

Paste these answers into the Play Console **App content → Data safety**
form. Every claim here was derived from a literal read of the
`apps/mobile/src/` source as of the audit PR. If you ship a feature
that collects something new, update this doc *before* the next release
so the form doesn't drift from reality.

## Section 1 — Data collection and security (the upfront questions)

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (every backend call is HTTPS to Supabase; the BLE link to the watch is local-only and not exposed to the network) |
| Do you provide a way for users to request that their data be deleted? | **Yes** — Settings → Privacy and data → Delete my account |

## Section 2 — Data types collected

Tick these and only these. For each, the **purpose** is **App functionality**
unless stated otherwise; data is **collected** (not shared with third parties);
collection is **required** unless stated otherwise; data is **processed
ephemerally: No** (we keep it server-side).

### Personal info

- **Email address** — required. Used for sign-in (OTP), family-circle
  invitations, transactional email. Encrypted in transit; users can
  request deletion.
- **Name** — optional. Display name shown on the Family Circle. Users
  can leave it blank.

### Financial info

- **Purchase history** — collected by **RevenueCat + Google Play Billing**
  for subscription management. Not stored in our backend beyond the
  RevenueCat subscriber id mapping in `subscriptions`.

### Health and fitness

- **Health info** — required. Blood pressure, heart rate, oxygen
  saturation, sleep, steps, active calories. Captured from the paired
  Urion U16 watch; written to the user's Supabase row gated by RLS.
  Optional Apple Health / Health Connect bridge (off by default) reads
  weight, height, blood glucose only when the user opts in per-vital.
- **Fitness info** — same row as above (steps + active energy).

### App activity

- **App interactions** — optional. PostHog events (no PHI, no vitals
  values per the analytics-layer rule). Used for product analytics.
- **In-app search history** — **No.**
- **Other user-generated content** — collected when the user types a
  reading note (`reading_notes`), a caregiver comment
  (`reading_comments`), or an Ask Leiko question (`ai_messages`).

### App info and performance

- **Crash logs** — collected by **Sentry** when `EXPO_PUBLIC_SENTRY_DSN`
  is set. The Sentry adapter strips numeric vitals (sys/dia/pulse/
  bpm/spo2) and email patterns from breadcrumbs before send.
- **Diagnostics** — Sentry performance traces (sampled at 0 in v1).
- **Other app performance data** — **No.**

### Device or other IDs

- **Device or other IDs** — required. A per-install UUID stored in
  Keychain/Keystore via `getDeviceId()` so a single user can be paired
  to multiple push tokens across phones.

### Audio, photos, videos, files, location, web browsing, contacts, calendar, messages, SMS, call logs

- **None.** The app does not access the microphone, camera, photo
  library, file system, location, browser history, contacts,
  calendar, or any messaging surface.

## Section 3 — Data security practices

- **Data is encrypted in transit**: Yes.
- **Data is encrypted at rest on device**: Yes (Supabase auth session
  in Keystore via `expo-secure-store`; analytics buffer in MMKV).
- **You can request that data be deleted**: Yes.
- **Committed to follow the Google Play Families Policy**: **No** —
  Leiko is not directed at children under 13.

## Section 4 — Third parties that receive data

| Third party | What they get | Why | Link |
| --- | --- | --- | --- |
| Supabase | Email, profile fields, vitals, notes, push token, audit log | Backend of record. Hosted on Hetzner. | https://supabase.com/privacy |
| RevenueCat | Purchase events + Supabase user id | Subscription state of truth. | https://www.revenuecat.com/privacy |
| Sentry | Crash stacks (PHI-scrubbed), Supabase user id | Crash reporting. | https://sentry.io/privacy/ |
| PostHog | Product event names + categorical props (no PHI) | Product analytics. | https://posthog.com/privacy |
| Expo Push | Expo push token + notification payload | Delivery of push notifications. Payloads are categorical (no vitals). | https://expo.dev/privacy |
| Google Play Billing | Purchase confirmation + subscription state | IAP. | Standard Play Store handling. |

## Section 5 — Notes / decisions

- "Patient" data is **not** collected. Leiko is consumer-grade. The
  app stores readings the user (or their caregiver) chose to take with
  the watch; it does not pull from EHRs, insurance claims, or any
  HIPAA-covered source. The DTC path is **not** a HIPAA covered entity
  per the project's regulatory posture (D3).
- The Apple Health / Health Connect bridge is **off by default** and
  surfaced as a per-vital opt-in in Settings. When off, no platform
  health data is read or written.
- Location is **not** collected. The legacy `ACCESS_FINE_LOCATION`
  permission ships only because Android 8-11 requires it as a runtime
  prerequisite for BLE scanning. It is capped at `maxSdkVersion="30"`
  and not requested on Android 12+.

When this doc is out of date relative to the code, **fix the doc, not
the code** — the answers here are what Play Console legally relies on.
