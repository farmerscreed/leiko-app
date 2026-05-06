# Sprint 10 — Settings + Family + Paywall

## Goal
Settings hub (paired watch, family, account, privacy, support). Family invite flow (email + 6-digit code per D8a §10). RevenueCat IAP plumbing for self-buyer paywall (PDF export + AI back-and-forth + full history).

## Duration
~1 work-week.

## Hard dependencies
Sprint 7 OR 8, Sprint 9.

## Docs to load
docs/04-screens/settings.md, docs/09-paywall-and-iap.md, docs/01-data-model.md, docs/05-voice-and-claims.md.

## Deliverables
- Settings.tsx hub
- Family invite flow: send invite → recipient enters code → accepts → family_member row created
- RevenueCat configured, IAP products defined (monthly + annual tiers per D2): `com.leiko.app.plus.monthly`, `com.leiko.app.plus.annual`
- /revenuecat-webhook Edge Function
- Paywall screen shown at PDF export and AI back-and-forth touch-points

## Acceptance criteria
- Settings shows all sections per spec
- Invite flow works end-to-end: caregiver A invites B, B receives email with 6-digit code, B enters code in their app, both see the link in family
- Subscription state syncs correctly between RevenueCat and the app
- Paywall is shown at correct touch-points; non-subscriber cannot bypass
- Latest reading remains visible on free tier (D5 §3.4)

## Open prompt
Sprint 10 — Settings + Family + Paywall. Read CLAUDE.md, then docs/04-screens/settings.md, docs/09-paywall-and-iap.md.

Propose:

1. Family invite flow data model (codes table? expiry? rate-limit?)
2. RevenueCat integration: identify-user pattern, entitlement model
3. Paywall screen design — confirm against D8a §9 (PDF lead)
4. Test users for IAP sandbox

Wait for approval.

## External dependency
**Q11 (D7 §14)**: RevenueCat IAP product setup is founder-owned (lead time 1–3 days). Sprint 10 cannot ship without it.
