# Sprint 15 — Push + Multi-Vital Anomaly Engine

## Goal
Push notifications wired (Expo + APNs/FCM). **Anomaly engine extended across all 5 vitals** per D13 §11.1 (calm-concerned vs confirmed-urgent rules per vital). Push routing per D13 §11.3 (most-severe-wins, quiet hours, opt-out per category). User can opt out per category.

## Duration
~1 work-week.

## Hard dependencies
Sprint 7.5 (multi-vital data flowing), Sprint 7.7 + 8 (home banners consume anomalies), Sprint 12 (output guard for anomaly push copy).

## Docs to load
docs/_reference/D13-multi-vitals-constellation-spec.md (§11), docs/_reference/D14-ambient-ai-architecture.md (§13 forbidden vocabulary), docs/11-push-notifications.md (will be rewritten), docs/10-anomaly-logic.md (will be rewritten), docs/_reference/D11-brand-repositioning.md (§3 voice).

## Deliverables
- Expo push setup, APNs + FCM credentials in Supabase
- Edge Function `detect-anomaly` — runs on every reading insert AND on every nightly aggregate (HR baseline, SpO2 overnight low, Sleep score)
- Edge Function `send-push` — routes by category, respects user prefs + quiet hours
- Per-vital anomaly classifier per D13 §11.1:
  - BP: existing rules preserved
  - HR: 3-day baseline drift, sustained-rest > 100 / < 40
  - SpO2: pattern-of-3-nights overnight low < 88, single 88–89
  - Sleep: never urgent (contextual data only)
  - Activity: never urgent (info only)
- Settings → Notifications screen with per-category toggles per D13 §11.3 (8 categories)
- Anomaly banner component used on Reading Detail and Home (already built in Sprint 7.6 — wire it)
- Universal Links + App Links assets (apple-app-site-association, assetlinks.json) at apps/mobile/well-known/
- Most-severe-wins logic on Home banner across all family members + all 5 vitals
- New docs: `docs/10-anomaly-logic.md` rewritten, `docs/11-push-notifications.md` rewritten

## Acceptance criteria
- BP calm-concerned single → in-app banner only, no push
- BP calm-concerned trend (3 readings) → push to caregiver(s) + in-app banner
- BP confirmed-urgent (3 ≥ 180/120 in 60min OR Crisis single) → push + banner; respects quiet hours unless user opted in
- HR calm-concerned (resting > baseline + 15 bpm × 3 days) → push + banner
- HR confirmed-urgent (< 40 OR > 130 sustained at rest) → push + banner; quiet hours overridden
- SpO2 calm-concerned (single 88–89) → in-app only
- SpO2 confirmed-urgent (3-night trend < 88) → push + banner
- Sleep low score → no push, no banner (info only)
- Activity low → no push, no banner
- Each push category respects user opt-out
- Push tap deep-links to correct vital detail OR reading detail
- No fear language in any push copy (voice gate passes)
- Anomaly false-positive rate metric wired in PostHog (target ≤ 15% thumbs-down, alert > 25% week-over-week)
- Most-severe-wins works correctly across (5 vitals × N parents)

## Open prompt
Sprint 15 — Push + Multi-Vital Anomaly Engine. Read CLAUDE.md, then docs/_reference/D13-multi-vitals-constellation-spec.md (§11), docs/_reference/D11-brand-repositioning.md (§3).

Propose:

1. Anomaly detection: synchronous on insert (BP, HR samples) vs cron over nightly aggregates (HR baseline, SpO2 overnight low, Sleep score)
2. Push delivery via Edge Function vs direct from app
3. Deep-link strategy per push category — to vital detail or reading detail?
4. iOS Critical Alerts: do we use them? (Spec says no for Leiko; confirm.)
5. Quiet-hours override logic — confirmed-urgent overrides, but how is this surfaced in onboarding?

Wait for approval.

## Risk notes
- Multi-vital anomaly rules add false-positive risk. Sleep is the safest (never anomalies), HR is the riskiest (sensor noise).
- Push voice is the highest-stakes voice surface (it bypasses the app). Voice review must be tighter than usual; test all push templates against the Aesop test per D11 §3.5.
- Quiet-hours override for confirmed-urgent is a privacy + dignity decision. Document the user's onboarding consent moment carefully.

## What this sprint explicitly does NOT ship
- The anomaly explanation paragraph (Sprint 12.5 generates it via Tier-B)
- Custom watch faces showing anomaly state (deferred)