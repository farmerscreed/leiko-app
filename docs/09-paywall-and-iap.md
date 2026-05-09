# 09 — Paywall & IAP

CANONICAL for Sprint 10 (paywall plumbing) and Sprint 17 (store metadata). Sourced from D6 §5.8 (US-67 to US-73), D2 (pricing), D8a §9 (paywall screen), D5 §3.4 (no-paywall-on-basic-readings rule).

---

## 1. The pricing lock

| Plan | Price | Trial | Notes |
| --- | --- | --- | --- |
| Free | $0 | n/a | Always shows latest reading + last 7 days of readings (per D5 §3.4) |
| Leiko Plus monthly | **$4.99 / month** | 7 days, no credit card at start | Card collected at trial end if user converts |
| Leiko Plus annual | **$39.99 / year (33% off)** | 7 days, no credit card at start | Same trial mechanics |

**Single subscription per family circle** (D6 US-73). The `family_owner` subscribes; ALL caregivers in the family inherit Plus features. RevenueCat handles cross-platform — a subscription bought on iOS works for an Android caregiver in the same family, and vice versa.

---

## 2. Free vs Plus feature matrix

| Feature | Free | Plus |
| --- | --- | --- |
| Latest reading | ✅ | ✅ |
| Last 7 days of readings | ✅ | ✅ |
| Manual reading entry | ✅ | ✅ |
| Watch pairing | ✅ | ✅ |
| Daily summary push | ✅ | ✅ |
| Single-caregiver mode (1 caregiver) | ✅ | n/a |
| Full historical readings (30 days+) | — | ✅ |
| Monthly + multi-month trends | — | ✅ |
| Anomaly detection (push notifications) | — | ✅ |
| AI assistant Tier B (pattern explanation) | 5 / month | ✅ (100 / month) |
| AI assistant Tier C (weekly summary) | — | ✅ (4 / month auto) |
| Share with doctor (PDF export) | — | ✅ |
| CSV export | — | ✅ |
| Web link share | — | ✅ |
| Multi-caregiver (up to 5) | — | ✅ |
| Multi-parent (up to 2 wearers) | — | ✅ |
| Medication-correlation insights | — | ✅ |

> **Hard rule from D5 §3.4 + CLAUDE.md**: paywall is on advanced features, **never on basic data**. The free tier always shows the latest reading. Any PR that paywalls the latest reading or the last 7 days will be rejected.

---

## 3. Paywall screen (D8a §9 + D6 US-69)

The paywall lives at the boundary of free/plus. It is shown when a free user taps a paid feature.

### Trigger (D8a §9.1)
- **UNCHANGED**: paywall fires on the **6th reading per identity**, OR on tapping a paywalled feature.
- **Self-buyer ADDS**: "Save as PDF for my doctor" (Trends `docs/04-screens/trends.md`) and "All time" range chip on Trends are paywalled.

### Anatomy (D8a §9.2 — UNCHANGED)
- **Full-screen modal**, `radius.l` top corners, three sections: hero, value bullets, price block.
- `button.accent` primary CTA + `button.ghost` secondary "Maybe later".
- **Hero illustration** (Sprint 10 may stub with the Leiko logomark) on `color.surface.elevated` (white).
- **Bullet list** of unlocked features (`type.body-l`): 3 bullets per D8a §9.4.
- **Price block**:
  - "Try Leiko Plus free for 7 days" — primary button
  - Below: "$4.99/month or $39.99/year — saves 33%" (D8a §9.5 UNCHANGED)
  - Toggle between monthly and annual; annual is highlighted as recommended.
- **"Maybe later"** dismiss link — `color.brand.primary-soft`, `type.label`, no penalty UX. *Cancellation is dignified.*
- **Legal footer**: "Subscriptions auto-renew. Manage anytime in Settings." + privacy/terms links.

### Hero headline + body — SUPERSEDES per `account_type` (D8a §9.3)

| Element | Caregiver mode (D8) | **Self-buyer mode (D8a)** |
| --- | --- | --- |
| Hero headline | "Stay close, every day" | **"Understand your numbers"** |
| Hero body | "Leiko helps you stay close to your parent's health — with calm, contextual updates." | **"See trends clearly. Share them with your doctor. Get plain-language explanations of what your readings mean."** |

### Value bullets — SUPERSEDES per `account_type` (D8a §9.4)

Three bullets, no medical claims (D5 §6.4). Order matters — the doctor-ready PDF leads in self-buyer mode because it is the single most compelling self-buyer ask.

**Caregiver mode (existing):**
- Up to 5 family members can stay informed
- AI-generated weekly summaries
- Share readings with your parent's doctor

**Self-buyer mode (D8a §9.4):**
1. A one-page summary you can save and show your doctor
2. Plain-language explanations of every reading and trend
3. Full history, with no time limit on what you can see

> **What is NOT in the self-buyer paywall** (D8a §9.4 callout): *"Up to 5 family members can stay informed"* — the multi-caregiver value prop in D5 §6.2 is **NOT** mentioned in the self-buyer paywall. Multi-caregiver is meaningless to a self-buyer at first launch. If they upgrade and later invite caregivers (hybrid mode), they discover that capability inside the app — they were not sold on it.

### Voice
- Never aggressive. Never countdown timers. Never "limited time" framing.
- Per D5 §3.4 voice anti-pattern: "Cancellation is dignified — no 'are you sure?' dark-pattern guilt screens."

### Triggers (Sprint 10 wires the routes)

Per `account_type`, the paywall triggers + headline use the SUPERSEDES table above. Common entry points:

| Source | Trigger | Caregiver headline | Self-buyer headline |
| --- | --- | --- | --- |
| Trends | Tap > 7-day range chip | "Stay close, every day" | "Understand your numbers" |
| Trends (self-buyer only) | Tap "Save as PDF for my doctor" | n/a | "Understand your numbers" |
| Trends (self-buyer only) | Tap "All time" range chip | n/a | "Understand your numbers" |
| AI assistant | First Tier-B query attempt | "Stay close, every day" | "Understand your numbers" |
| Share with doctor (caregiver) | Tap "Share PDF report" | "Stay close, every day" | n/a |
| Add caregiver | At single-caregiver limit | "Stay close, every day" | n/a |
| Anomaly opt-in | "Get proactive alerts with Leiko Plus" on home | "Stay close, every day" | "Understand your numbers" |
| 6th reading per identity (D8a §9.1) | Auto-fires once per family per month | Mode-appropriate | Mode-appropriate |

---

## 4. RevenueCat plumbing

### Architecture
```
mobile app
  │
  ├── @revenuecat/purchases (iOS + Android SDK)
  │
  └── on purchase / restore / cancellation
       ▼
RevenueCat servers
  │
  └── webhook ──► /revenuecat-webhook Edge Function ──► public.subscriptions table
                                                        │
                                                        ▼
                                       public.families.subscription_status
```

### Source of truth
`public.families.subscription_status` is the entitlement flag. RLS reads from it.

Allowed values: `'free' | 'plus' | 'plus_trial' | 'plus_grace' | 'past_due'`.

### Webhook handling (`/revenuecat-webhook` — Sprint 10)
- Validates signature using `REVENUECAT_WEBHOOK_SECRET`.
- Updates `public.subscriptions` (raw event for audit) and writes derived status to `public.families.subscription_status`.
- Idempotent: same event ID processed twice produces the same outcome.
- Audit-log entry for every status change.
- Service-role key required (bypasses RLS by design).

### Product IDs (provisioned in App Store Connect + Google Play Console)
- `com.leiko.app.plus.monthly` — $4.99 / month
- `com.leiko.app.plus.annual` — $39.99 / year

> **Q11 (D7 §14)**: RevenueCat IAP product setup is an external-dependency block for Sprint 10. Founder-owned. Lead time 1–3 days. Track in `plans/backlog.md`.

---

## 5. Trial → conversion → renewal flow

### Trial start
1. User taps "Try free for 7 days" on paywall.
2. RevenueCat starts trial. **No credit card collected at start** (per D2 + D6 US-69).
3. `families.subscription_status` → `'plus_trial'`.
4. Push notification scheduled for trial-end −24h: *"Your trial ends in 1 day. Leiko Plus stays $4.99/month and keeps your weekly summaries running."*

### Trial end → conversion
- If user enters payment in time: RevenueCat charges, status → `'plus'`.
- If user does not: status → `'free'`. **No data loss** — historical readings remain in DB; just access patterns change.

### Renewal & past-due
- RevenueCat handles renewal; on failure, enters `'plus_grace'` (16-day grace per Apple defaults).
- Push: *"Your subscription couldn't renew. Tap to update your payment."* (calm, not threatening).
- After grace: status → `'past_due'` then `'free'`.

### Cancellation
- User cancels via OS subscription settings (Settings → Subscription deep-links).
- Access continues until end of current billing period.
- On expiry, revert to free tier. No data deletion.

---

## 6. Refund policy
- Apple and Google handle refunds via their stores.
- Public refund policy: **30-day money-back on annual plans**, no refunds on monthly plans (industry standard).
- Customer support responds to refund requests within 24 business hours.

---

## 7. App Store / Play Store metadata (Sprint 17)
Subscription product disclosure copy is locked to:
- **Auto-renew language** (Apple required): "Subscriptions auto-renew until cancelled. Manage in Settings."
- **No "save", "discount", "limited time" framing** in the app — paywall copy must pass `docs/05-voice-and-claims.md` voice rules (no fear, no urgency).

Privacy-policy and terms URLs (placeholders today):
- `https://leiko.app/privacy`
- `https://leiko.app/terms`

These must be live, real, and lawyer-reviewed by App Store submission.

---

## 8. Open paywall questions
- Family-plan SKU consolidation (currently single Plus tier; consider Plus-Family at higher price for Sprint 17+).
- Regional pricing for Nigeria (NGN equivalent vs USD-only) — defer to v1.1 once Apple/Google IAP currency strategy clarified.
