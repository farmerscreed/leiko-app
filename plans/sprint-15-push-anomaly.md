# Sprint 15 — Push + Anomaly Logic

## Goal
Push notifications wired (Expo + APNs/FCM), 8 push categories per D8a §12 / docs/11-push-notifications.md, anomaly logic per D6 §4.7 (calm-concerned vs confirmed-urgent). User can opt out per category.

## Duration
~1 work-week.

## Hard dependencies
Sprint 6.

## Docs to load
docs/11-push-notifications.md, docs/10-anomaly-logic.md, docs/05-voice-and-claims.md.

## Deliverables
- Expo push setup, APNs + FCM credentials in Supabase
- Edge Function: detect-anomaly — runs on every reading insert
- Edge Function: send-push — routes by category, respects user prefs
- Settings → Notifications screen with per-category toggles (8 categories)
- Anomaly banner component used on Reading Detail and Home (calm-concerned amber, confirmed-urgent crimson)
- Universal Links + App Links assets (apple-app-site-association, assetlinks.json) at apps/mobile/well-known/

## Acceptance criteria
- Calm-concerned anomaly (single elevated reading) → in-app banner only, no push (per the routing in docs/11-push-notifications.md §5)
- Calm-concerned trend (3 readings in pattern) → push to caregiver(s) + in-app banner
- Confirmed-urgent (3 readings >180/120 in 60min OR Crisis ≥180/120) → push to caregiver(s) + in-app banner; respects quiet hours unless user opted in
- Each push category respects user opt-out
- Push tap deep-links to Reading Detail of the triggering reading
- No fear language in any push copy (voice gate passes)
- Anomaly false-positive rate metric wired in PostHog (target ≤ 15% thumbs-down)

## Open prompt
Sprint 15 — Push + Anomaly Logic. Read CLAUDE.md, then docs/11-push-notifications.md, docs/10-anomaly-logic.md.

Propose:

1. Anomaly detection: synchronous on insert vs cron over recent readings
2. Push delivery via Edge Function vs direct from app
3. Deep-link strategy
4. iOS Critical Alerts: do we use them? (Spec says no for Leiko, but confirm.)

Wait for approval.
