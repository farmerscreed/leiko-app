# Sprint 17 — Launch ⚠️ SUPERSEDED

**Status:** SUPERSEDED 2026-05-20. This card's original scope was redistributed across the post-pivot sequence:

- **Sprint 16.6** absorbed pre-launch validation tooling (two-phone test rig, CAREGIVER_TEST_FLOW.md, CAREGIVER_TEST_RESULTS.md) + P1 hardening (FUN-1/2/4, QUA-5/7) — closed 2026-05-19.
- **Sprint 17a** (per-person dashboard) + **Sprint 17b** (family member management + visibility enforcement) absorbed what would have been "final regression QA" of caregiver flows — closed 2026-05-20.
- **Sprint 18 — Launch Readiness Blitz** (`plans/sprint-18-launch-readiness.md`) absorbs the engineering remainder: SEC-1, doctor-PDF wiring, CI workflows, help/support row, plus the founder-ops blitz.
- **Actual store submission work** (TestFlight, Play Internal, App Store screenshots, privacy policy URL hosting, HealthKit entitlement justification, beta tester recruitment, Maestro E2E) is now tracked in `plans/PRODUCTION_READINESS.md` as OPS-* and QUA-* items, plus the v1.1 deferrals in `plans/sprint-18-launch-readiness.md` § "Out of scope". Run after Sprint 18 closes.

The original card body is preserved below for historical context, but **the source of truth for what's left is `plans/PRODUCTION_READINESS.md`**, not this file.

---

## Goal
Store submission. Beta channel via TestFlight + Play Internal Testing. App Store + Play screenshots. Final regression QA on real iOS + real Android with the real watch. **HealthKit entitlement justification copy** (newly required at v1.0 per Sprint 9.5). NAFDAC + FDA paperwork is a separate workstream and does not block this sprint.

## Duration
~1 work-week.

## Hard dependencies
Sprints 12, 12.5, 14, 15, 16.

## Docs to load
docs/_reference/D3-regulatory.md, docs/_reference/D11-brand-repositioning.md (§11 brand application — App Store screenshots), docs/_reference/D13-multi-vitals-constellation-spec.md (§12 HealthKit), docs/09-paywall-and-iap.md.

## Deliverables
- App Store listing: screenshots, description, keywords, privacy policy, age rating, **HealthKit usage description per D13 §12 / Sprint 9.5**
- Play Store listing: same + Health Connect permission justification
- TestFlight + Play Internal builds
- Beta tester recruit list (10–20 people, mix of NG and US)
- Maestro E2E: smoke tests for the critical-path flows (per docs/13-testing-standard.md — Maestro, not Detox)
- **Multi-vital screenshots** per D11 §11 — five-screen sequence leading with Daily Pulse hero in dark mode (US) / self-buyer Daily Pulse (Nigeria); each with one-line story overlay in display face
- All copy in App Store + Play Store listings runs through the forbidden-claims linter per D14 §13 expanded vocabulary (`docs/05-voice-and-claims.md`)
- Privacy policy and Terms of Service published at `https://leiko.app/privacy` and `https://leiko.app/terms` — privacy policy MUST cover HealthKit + Health Connect data handling per Apple/Google requirements

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
- **Q2**: Brand name LEIKO verified (USPTO, NIPC, domains)
- **Q4**: 510(k) Letter of Authorisation from K141683 holder (gates US shipping)
- **Q5**: Clinical advisor sign-off on Cluster A Learn cards (especially SpO2 articles)
- **Q11**: RevenueCat IAP product setup
- Apple Developer + Google Play accounts provisioned
- **Apple Developer HealthKit entitlement enabled** (new per Sprint 9.5)
- Supabase paid plan active for production
- App Store screenshots + marketing copy commissioned (designer-produced per D11 §11)

See `plans/backlog.md` for the full list.

## Risk notes (additions per the Apple-of-Healthcare pivot)
- HealthKit-using apps add ~2 days to Apple review. Plan the timeline accordingly.
- App Store screenshots are now a brand surface per D11 §11 — generic UI screenshots will undersell the product. Designer's premium hero renders are the ones that ship.
- The voice-rule expansion in D14 §13 (no "biohack," "smart insights," "wellness," etc.) means existing draft App Store copy from D5 era needs a full re-lint pass.
