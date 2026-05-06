# 11 — Push Notifications

CANONICAL for Sprint 15. Sourced from D7 §8 (categories, deep links, body templates) and D8a §12 (voice/push categories). Voice rules from `docs/05-voice-and-claims.md`.

---

## 1. Categories (D7 §8.1, with D8a §12.2 ADDS)

| Category | iOS Category ID | Android Channel | Default | Quiet hours |
| --- | --- | --- | --- | --- |
| Daily summary | `leiko.daily_summary` | `daily-summary` (DEFAULT importance) | On | Suppressed |
| Weekly summary | `leiko.weekly_summary` | `weekly-summary` (DEFAULT) | On (Plus) | Suppressed |
| Anomaly | `leiko.anomaly` | `anomaly` (HIGH) | On (Plus) | Honored unless user opts to override |
| Watch status | `leiko.device` | `device` (LOW) | On | Suppressed |
| Family activity | `leiko.family` | `family` (DEFAULT) | On | Suppressed |
| **Hybrid caregiver joined** (D8a §12.2 ADDS — self-buyer only) | `leiko.hybrid` | `hybrid` (DEFAULT) | On | Suppressed |
| Medication reminder | `leiko.medication` | `medication` (HIGH) | On (parent) | **Always honored** (medication is time-bound) |
| Subscription / account | `leiko.account` | `account` (LOW) | On | Suppressed |
| Marketing | `leiko.marketing` | `marketing` (LOW) | **OFF by default** (D5 §3.4) | Suppressed |

---

## 2. Quiet hours (D7 §8.2)

- **Default 22:00–07:00 caregiver-local-time.**
- Configurable in Settings (D6 US-78) per category.
- During quiet hours, only **Anomaly + Medication** categories may fire (and Anomaly only if user opts in).
- Other categories are **batched** and delivered at end-of-quiet-hours. If same category has > 1 deferred, the app collapses into a single *"3 family events overnight"* notification.
- **Per-category 24h rate limit: max 3 notifications per category.** Excess batched.

---

## 3. Deep linking targets (D7 §8.3)

| Category | URL | Target screen |
| --- | --- | --- |
| Daily summary | `leiko://home` | Caregiver home dashboard |
| Weekly summary | `leiko://weekly` | Weekly view (D6 US-52) |
| Anomaly | `leiko://reading/{reading_id}` | Reading detail (D6 US-24) |
| Watch status | `leiko://settings/devices` | Device settings (D6 US-84) |
| Family activity | `leiko://family` | Family screen (D6 US-47) |
| Medication reminder | `leiko://parent/medication/{med_id}` | Parent medication detail |
| Subscription | `leiko://settings/subscription` | Subscription settings |
| Marketing | `leiko://home` | Home (no targeted deep link to avoid abuse) |

### Universal links / App Links (REQUIRED)
Universal Links (iOS) and App Links (Android) must be set up at the `leiko.app` domain so `https://leiko.app/*` and `https://pair.leiko.app/*` paths can deep-link into the app.

- Apple's `apple-app-site-association` checked into `apps/mobile/well-known/`.
- Android's `assetlinks.json` checked into the same path.

Required because the parent's WhatsApp link will be a regular `https` URL, not a `leiko://` URI.

---

## 4. Notification body templates (D7 §8.4)

Templates live in `apps/mobile/src/i18n/notifications/{locale}.ts`. Each is `function(payload) => string`. The copy-lint linter (`docs/05-voice-and-claims.md`) runs over template outputs in CI by feeding synthetic payloads and asserting no forbidden claim is produced.

### English (en) — caregiver variants
```ts
// apps/mobile/src/i18n/notifications/en/caregiver.ts
export const caregiverNotifications = {
  daily_summary: (p: { parent: string; sys: number; dia: number; time: string; sleepH: number }) =>
    `Good morning. ${p.parent}'s reading was ${p.sys}/${p.dia} ${p.time}. She slept ${p.sleepH} hours.`,

  daily_no_reading: (p: { parent: string }) =>
    `No readings from ${p.parent} yesterday. Want to check in?`,

  anomaly_single: (p: { parent: string; sys: number; dia: number }) =>
    `${p.parent}'s reading just now was higher than usual: ${p.sys}/${p.dia}. We've added it to her log.`,

  anomaly_morning_trend: (p: { parent: string }) =>
    `${p.parent}'s morning readings have been higher this week. Worth a check-in when you can.`,

  weekly_summary: (p: { parent: string; body: string }) =>
    p.body, // body is the AI-generated first sentence; lint runs in CI before send

  watch_low_battery: (p: { parent: string; pct: number }) =>
    `${p.parent}'s watch battery is at ${p.pct}%. She'll need to charge it soon.`,
};
```

### English (en) — self-buyer variants (D8a §12.2 SUPERSEDES)

All eight push categories have self-buyer template variants. Each respects the same quiet hours and length limits (≤120 chars iOS).

```ts
// apps/mobile/src/i18n/notifications/en/self-buyer.ts
export const selfBuyerNotifications = {
  // daily-summary
  daily_summary_title: () => `Your morning reading`,
  daily_summary_body: (p: { sys: number; dia: number }) =>
    `${p.sys}/${p.dia}, in range. Have a good day.`,

  // anomaly-noted
  anomaly_noted_title: () => `Worth a look`,
  anomaly_noted_body: () =>
    `Three readings this week were higher than usual. Might be worth a quiet check-in with your doctor.`,

  // confirmed-urgent
  confirmed_urgent_title: () => `Please call your doctor`,
  confirmed_urgent_body: () =>
    `Three high readings in the last hour. We recommend reaching out today.`,

  // missed-reading
  missed_reading_title: () => `It's been a few days`,
  missed_reading_body: () =>
    `Take a moment to check in with a reading when you can.`,

  // hybrid-caregiver-joined (ADDS — only fires after a self-buyer invites a caregiver)
  hybrid_caregiver_joined_title: (p: { caregiver: string }) =>
    `${p.caregiver} accepted your invite`,
  hybrid_caregiver_joined_body: (p: { caregiver: string }) =>
    `She can now see your readings.`,

  // subscription-billing — UNCHANGED
  subscription_renewing_title: () => `Subscription renewing`,
  subscription_renewing_body: () => `Leiko will renew tomorrow for $4.99/month.`,

  // watch-shipped — UNCHANGED
  watch_shipped_title: () => `Your watch is on the way`,
  watch_shipped_body: (p: { tracking: string; eta: string }) =>
    `Tracking #${p.tracking}: arriving ${p.eta}.`,

  // family-invite (n/a in self-buyer-only mode; used in hybrid)
  // parent-pairing-handoff (n/a in self-buyer mode — the self-buyer pairs themselves)
};
```

### Routing rule

The push composer selects the variant by the **recipient's** `account_type`:
- `caregiver` → `caregiverNotifications.*`
- `self_buyer` → `selfBuyerNotifications.*`
- `parent` → caregiver-style with appropriate adaptations (rare — parent users typically don't receive notifications about themselves)

### Voice rules
- Per `docs/05-voice-and-claims.md`: never "alert", "warning", "critical", all-caps. Never emoji-driven urgency.
- Body length: **≤ 120 chars iOS, ≤ 180 chars Android** (hard fail in copy-lint).
- Even confirmed-urgent stays calm: *"Three high readings in the last hour. We recommend reaching out to Dad now."*

---

## 5. Routing table (calm-concerned vs confirmed-urgent)

| Anomaly source (`docs/10-anomaly-logic.md`) | Category | Title | Body template |
| --- | --- | --- | --- |
| Calm-concerned: single outlier | `leiko.anomaly` | "Worth a look" | `anomaly_single` |
| Calm-concerned: morning trend | `leiko.anomaly` | "Worth a look" | `anomaly_morning_trend` |
| Calm-concerned: weekly trend (3+ in 7d) | `leiko.weekly_summary` | "Mum's week" | (emphasised paragraph in weekly summary, not a separate push) |
| Confirmed-urgent: Stage 2 sustained | `leiko.anomaly` (HIGH; bypasses quiet hours **only if user opted in**) | "Please call Mum" | "Three high readings in the last hour. We recommend reaching out now." |
| Confirmed-urgent: Crisis (≥180/120) | `leiko.anomaly` (HIGH; bypasses quiet hours) | "Please call Mum" | "Mum's reading just now was very high — sys ≥ 180 or dia ≥ 120. We recommend reaching out now." |

**Quiet-hours override behaviour**: even confirmed-urgent only bypasses quiet hours if the user explicitly opted to allow it during onboarding. Default is **respect quiet hours even for urgent** — caregiver gets the push at 07:00 instead of 03:00. Per CLAUDE.md anti-pattern: "Add fear-based push notifications" (forbidden).

---

## 6. Token storage (D7 §3.2.13)

`public.push_tokens` stores both the Expo token AND the underlying APNs/FCM token (per the D7 §2.5 future-migration mitigation). Schema in `docs/01-data-model.md`.

- Re-register on every app foreground (token can rotate).
- Soft-purge tokens unseen > 60 days (a cron job in `/retention`).

---

## 7. Delivery telemetry

Per `docs/13-testing-standard.md`:
- Push delivery success rate ≥ 98% (alert < 95% over 1h).
- Anomaly false-positive rate ≤ 15% thumbs-down (alert > 25% week-over-week).
- All push events emit a PostHog event `push.{category}.{outcome}` with NO PHI in metadata.

---

## 8. Sprint 15 acceptance bar (excerpt)

- All 8 categories registered with iOS Notification Service Extension + Android Notification Channels.
- Quiet-hours logic correctly suppresses + batches; tested with frozen-clock fixtures.
- All templates pass copy-lint with synthetic payloads.
- Universal Links + App Links verified on iOS + Android.
- Anomaly → push deep-link round-trip works on both platforms.

---

## 9. Open notification questions
- Localised quiet-hour defaults (e.g. earlier 21:00 in Lagos, later 22:00 in NJ) — defer to v1.1.
- Snooze-for-1-hour affordance on anomaly notifications — defer.
- Apple Live Activities for in-progress reading — defer to v1.2.
