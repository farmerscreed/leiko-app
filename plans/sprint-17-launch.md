# Sprint 17 — Launch

## Goal
Store submission. Beta channel via TestFlight + Play Internal Testing. App Store + Play screenshots. Final regression QA on real iOS + real Android with the real watch. NAFDAC + FDA paperwork is a separate workstream and does not block this sprint.

## Duration
~1 work-week.

## Hard dependencies
Sprints 12, 14, 15, 16.

## Docs to load
docs/_reference/D3-regulatory.md, docs/09-paywall-and-iap.md.

## Deliverables
- App Store listing: screenshots, description, keywords, privacy policy, age rating
- Play Store listing: same
- TestFlight + Play Internal builds
- Beta tester recruit list (10–20 people, mix of NG and US)
- Maestro E2E: smoke tests for the critical-path flows (per docs/13-testing-standard.md — Maestro, not Detox)
- All copy in App Store + Play Store listings runs through the forbidden-claims linter (`docs/05-voice-and-claims.md`)
- Privacy policy and Terms of Service published at `https://kena.app/privacy` and `https://kena.app/terms`

## Acceptance criteria
- TestFlight build runs end-to-end on a real device
- Play Internal build runs end-to-end on a real device
- Screenshots match the live app (no "coming soon" elements)
- Privacy policy is published and accurate
- First 5 beta testers complete onboarding without help
- All pre-flight checks pass (per docs/13-testing-standard.md §"Pre-flight checks"):
  - Copy-lint over all i18n + AI prompt fixtures — zero forbidden claims
  - Synthetic crash with PHI-shaped fields → arrives at Sentry redacted
  - Synthetic event with reading values → arrives at PostHog without sys/dia/pulse
  - Maestro smoke suite green on iOS + Android
  - BLE soak test green on at least one watch (48h+)
  - WCAG 2.2 AA scan green on all V1 screens
  - AI red-team suite — 100% deflection rate

## Open prompt
Sprint 17 — Launch. Read CLAUDE.md, then docs/09-paywall-and-iap.md and docs/_reference/D3-regulatory.md.

Propose:

1. Submission checklist for both stores
2. Screenshots: which screens, what device frames, what copy overlay
3. Privacy policy generator vs founder-written
4. Beta tester onboarding instructions
5. Critical-path E2E tests for Maestro

Wait for approval.

## Risk notes
- Apple review can reject for medical-app reasons — anchor positioning matters. Have D3 regulatory summary ready.
- NAFDAC and FDA processes run in parallel; they don't block store submission but they DO block sales claims in the listing.
- First store rejection is normal. Plan for one rejection cycle (5–10 days slip).

## External dependencies
- **Q1**: Anthropic BAA signed (gates Tier B/C in production)
- **Q2**: Brand name KENA verified (USPTO, NIPC, domains)
- **Q4**: 510(k) Letter of Authorisation from K141683 holder (gates US shipping)
- **Q5**: Clinical advisor sign-off on Cluster A Learn cards
- **Q11**: RevenueCat IAP product setup
- Apple Developer + Google Play accounts provisioned
- Supabase paid plan active for production
- App Store screenshots + marketing copy commissioned

See `plans/backlog.md` for the full list.
