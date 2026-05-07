# Sprint 10 — Settings + Family + Paywall

## Goal
Settings hub (paired watch, family, account, privacy, support, **per-vital toggles**, **Apple Health / Health Connect master + per-vital toggles**, **AI quotas + tier visibility**). Family invite flow (email + 6-digit code per D8a §10). RevenueCat IAP plumbing for self-buyer paywall (PDF export + AI Tier-B quota + full history) per D14 §14.

## Duration
~1 work-week.

## Hard dependencies
Sprint 7.7 OR 8, Sprint 9, Sprint 9.5 (Health Platform bridge service).

## Docs to load
docs/_reference/D11-brand-repositioning.md (paywall voice §3.6), docs/_reference/D13-multi-vitals-constellation-spec.md (§13 privacy, §12 health platform), docs/_reference/D14-ambient-ai-architecture.md (§14 quotas), docs/04-screens/settings.md (will be rewritten as part of this sprint), docs/09-paywall-and-iap.md, docs/01-data-model.md, docs/05-voice-and-claims.md.

## Deliverables
- `Settings.tsx` hub rewritten per D12, with new sections:
  - Profile + account
  - Paired watch + battery + last sync
  - **Vital streams** — per-vital on/off toggles (HR auto-sample, SpO2 auto-sample, Sleep, Activity goals)
  - **Goal config** — steps target (default 6,000 per Q-D13-1), sleep target
  - **Apple Health / Health Connect** — master toggle + per-vital granular toggles per D13 §12.5
  - **Caregiver visibility** (hybrid mode only) — what each invited caregiver sees per vital, with sleep hidden by default per D13 §13.2
  - **AI** — quota usage display (e.g., "23 of 100 questions used this month"), tier explainer
  - **Notifications** — 8 categories per D13 §11.3
  - Family management, Privacy, Support
- Family invite flow: send invite → recipient enters code → accepts → family_member row created
- RevenueCat configured, IAP products defined (monthly + annual): `com.leiko.app.plus.monthly`, `com.leiko.app.plus.annual`
- `/revenuecat-webhook` Edge Function
- Paywall screen shown at PDF export, Tier-B quota exhausted, AI Daily Pulse upsell affordance, doctor-prep, full-history past 30 days
- New screen spec: `docs/04-screens/settings.md` rewritten

## Acceptance criteria
- Settings shows all sections per the new spec, in both modes
- Invite flow works end-to-end: caregiver A invites B, B receives email with 6-digit code, B enters code, both see the link in family
- Subscription state syncs correctly between RevenueCat and the app
- Paywall is shown at correct touch-points per D14 §14.3 — voice passes Aesop test (confident-quiet, never pushy)
- Per-vital toggles change state both on watch (via `setAutoHR` / `setAutoSpO2`) and on Health Platform bridge
- Sleep-hidden-by-default verified for hybrid-mode caregiver visibility
- AI quota counter accurate against `audit_log` egress events
- Latest reading remains visible on free tier (D11 §10 brand do-not-paywall rule)

## Open prompt
Sprint 10 — Settings + Family + Paywall. Read CLAUDE.md, then docs/_reference/D14-ambient-ai-architecture.md (§14) and docs/_reference/D13-multi-vitals-constellation-spec.md (§12, §13).

Propose:

1. Family invite flow data model (codes table? expiry? rate-limit?)
2. RevenueCat integration: identify-user pattern, entitlement model
3. Paywall screen design — confirm Plus quota structure (100 Tier-B / month, 4 weekly summaries, 1 monthly baseline auto-generated)
4. AI quota counter accuracy — `audit_log` query vs cached counter
5. Per-vital toggle propagation — watch + platform + database

Wait for approval.

## External dependency
**Q11 (D7 §14)**: RevenueCat IAP product setup is founder-owned (lead time 1–3 days). Sprint 10 cannot ship without it.

## What this sprint explicitly does NOT ship
- AI narration generator surfaces (Sprint 12.5)
- Push notification routing engine (Sprint 15)
- The Health Platform bridge itself (Sprint 9.5 — this sprint surfaces the toggles only)
