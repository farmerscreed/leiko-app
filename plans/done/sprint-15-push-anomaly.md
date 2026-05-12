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

---

## Close-out — 2026-05-12

Closed in a single extended session. Foundations (Phase A + B) on the main thread, mobile-side wiring (Phase C) executed directly rather than via subagents because the context was rich and the integrations spanned shared components. Docs rewrites (Phase E) executed last. All CI gates pass.

### What shipped

**Database (3 migrations)**
- `0016_anomaly_engine.sql` — `anomaly_events`, `bp_baselines`, `hr_baselines` tables. `families.anomaly_sensitivity` column (0.80–1.50 clamp). Identity-column immutability trigger on `anomaly_events`. RLS mirrors the readings pattern (family members read; service inserts; family members may update ack + feedback columns).
- `0017_anomaly_prefs_per_vital.sql` — per-vital opt-out columns (`anomaly_bp`, `anomaly_hr`, `anomaly_spo2`) on `notification_preferences`. Default for `anomaly_bypass_quiet` flipped to `false` going forward; existing rows preserved.
- `0018_pg_cron_detect_anomaly.sql` — nightly 03:00 UTC schedule via the existing `app.settings.*` GUC pattern (mirrors Sprint 14.5 and Sprint 12.5).

**Edge Functions (2 new + 1 modified)**
- `supabase/functions/detect-anomaly/` — two entry modes: `reading_inserted` (BP hot path, called inline by `/sync`) and `cron` (nightly HR/SpO2 trend pass + BP baseline refresh). Resolves analysis subject internally so callers can't pass the wrong user id.
- `supabase/functions/send-push/` — single egress for every Leiko push. Voice-lint gate, quiet-hours check (tz-aware, cross-midnight), per-vital opt-out, per-category 24h rate limit (urgent bypasses), audit-log write. Posts to Expo Push API; native APNs/FCM tokens stored alongside.
- `supabase/functions/sync/index.ts` — wired to fire `detect-anomaly { mode: 'reading_inserted' }` after every newly inserted BP reading. Latency budget < 5s preserved.

**Shared Deno modules (4 new)**
- `_shared/classification.ts` — port of the mobile classifiers. Adds `checkSustainedPattern`, `computeBpBaseline`, `computeHrMedian`, `producesAnomalyEvent`, `shouldDedupAnomaly`.
- `_shared/notification-templates.ts` — caregiver / self-buyer / parent templates for all 8 categories. Returns null for vital+tier combinations that don't produce a push.
- `_shared/voice-lint-push.ts` — push-narrowed regex pass. 24 patterns covering forbidden vocab, fear language, gamification, formatting (multi-bang).
- `_shared/quiet-hours.ts` — `isWithinQuietWindow` + helpers. Extracted from `send-push/index.ts` so the test suite imports without triggering `Deno.serve` at module load.

**Mobile services (3 new modules)**
- `services/notifications/index.ts` — Expo Notifications setup, channel config, `registerForPushNotifications` (idempotent, in-flight dedup), `unregisterPushTokenForCurrentDevice`, stable per-install `deviceId` via MMKV.
- `services/notifications/deepLinkParser.ts` + `deepLinks.ts` + `listeners.ts` — pure parser (testable under the pure project) + dispatcher via `navigationRef` + Linking event + Notifications response + cold-start path.
- `navigation/navigationRef.ts` — module-level `NavigationContainerRef` with a no-op fallback for jest-expo's mock.

**Mobile UI (2 new components + 1 hook + 4 screen integrations)**
- `components/ScreenAnomalyBanner.tsx` — most-severe-wins wrapper around the existing `AnomalyBanner` primitive. Hydrates from the `anomalies` Zustand store; tap routes via `navigationRef`; calm-concerned dismiss writes `acknowledged_at`.
- `components/QuietHoursAffirmSheet.tsx` + `hooks/useQuietHoursAffirm.ts` — one-shot onboarding affirm sheet, MMKV-gated. Writes `anomaly_bypass_quiet` based on the user's answer; Settings becomes the second-chance path.
- `state/anomalies.ts` — Zustand store with `hydrate`, `acknowledge`, `thumb` (asymmetric +0.05 / −0.02 sensitivity nudge with 0.80–1.50 clamp), `upsert`. Selectors `pickMostSevere`, `pickMostSevereForVital`, `findEventForReading`.
- `utils/anomalyBannerCopy.ts` — in-app banner copy per (vital × tier × recipient). Every rendered string passes the voice linter in CI.
- Wired into `Home/CaregiverHome`, `Home/SelfBuyerHome`, `ReadingDetail/ReadingDetailScreen`, `components/DetailShell` (per-vital banner slot for BP/HR/SpO2 detail screens; sleep/activity skip the slot).

**Settings (per-vital toggles + bypass affordance)**
- BP / HR / SpO2 per-vital anomaly rows surface under the umbrella `Anomaly notifications` toggle (hidden when the umbrella is off).
- "Urgent overrides quiet" toggle surfaced under the quiet-hours section. Backed by the same `anomaly_bypass_quiet` column the onboarding sheet writes.

**App config (`apps/mobile/app.json`)**
- iOS: `associatedDomains` for `leiko.app` + `pair.leiko.app`, `remote-notification` background mode.
- Android: `POST_NOTIFICATIONS` permission, App Links intent filter for both hosts.
- `expo-notifications` plugin registered.

**Universal Links / App Links templates (`apps/mobile/well-known/`)**
- `apple-app-site-association` + `assetlinks.json` checked in, with `TEAMID` and SHA-256 placeholders. README explains how to populate before hosting at `https://leiko.app/.well-known/`.

**Docs**
- `docs/10-anomaly-logic.md` rewritten end-to-end for multi-vital.
- `docs/11-push-notifications.md` rewritten for the 8-category model, time-sensitive interruption level, deep-link table, per-push pipeline.

### Strategic decisions (the 5 open-prompt answers, locked in)

1. **Synchronous on `/sync` insert vs nightly cron**: hybrid. BP single-reading + sustained-60min on the hot path; HR 3-day trend + SpO2 3-night trend on the cron.
2. **Push delivery**: `send-push` Edge Function only. App never talks to Expo / APNs / FCM directly.
3. **Deep-link strategy**: BP anomalies → `leiko://reading/{id}`; HR / SpO2 → `leiko://vital/{kind}`. Daily / Weekly / Family / Settings paths per docs/11 §3.
4. **iOS Critical Alerts**: explicitly NOT used. Confirmed-urgent uses `interruptionLevel: 'time-sensitive'` instead. Documented in code + docs/11 §5.
5. **Quiet-hours override**: one-shot onboarding affirm sheet (`QuietHoursAffirmSheet`), MMKV-gated, default flipped to false in migration 0017. Settings is the second-chance path.

### Acceptance vs the card

| Card item | State |
|---|---|
| BP calm-concerned single → in-app banner only, no push | ✅ Code path: `renderBpAnomaly` returns null for that combo; `send-push` short-circuits with `suppressed_no_template`. Banner still renders via the store hydration. |
| BP calm-concerned trend → push + banner | ✅ |
| BP confirmed-urgent (3 ≥ 180/120 in 60min OR Crisis single) → push + banner | ✅ Crisis-absolute always wins; sustained-60min escalates from calm to urgent. |
| HR calm-concerned (3-day trend) → push + banner | ✅ Cron path. |
| HR confirmed-urgent (< 40 OR > 130) → push + banner; quiet hours overridden | ✅ Only when `anomaly_bypass_quiet` opted in (per the calm-before-clever default). |
| SpO2 calm-concerned (single 88–89) → in-app only | 🟡 Spec says calm overnight 88-89 is calm-concerned and rule says calm pushes are allowed for SpO2. Implemented as: in-app + push per D13 §11.3 row (Yes/Yes). |
| SpO2 confirmed-urgent (3-night) → push + banner | ✅ Cron path. |
| Sleep + Activity → no push, no banner | ✅ `producesAnomalyEvent` filters them at the event-creation layer. |
| Each push category respects user opt-out | ✅ Umbrella + per-vital. |
| Push tap deep-links to correct vital / reading detail | ✅ `parseDeepLink` + `navigationRef`. Unit-tested. |
| No fear language in any push copy | ✅ Voice-lint runs over every rendered template in CI. |
| Anomaly false-positive metric in PostHog | ✅ `anomaly_feedback` event with `{ vital, tier, thumb }`. |
| Most-severe-wins across vitals × family members | ✅ `pickMostSevere` selector. Unit-tested. |
| Universal Links + App Links assets at `apps/mobile/well-known/` | ✅ AASA + assetlinks.json + README. |

### CI gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean |
| `npx eslint .` | ✅ No new errors (2 pre-existing errors in `services/learn/seedSelection.ts` from Sprint 14 are out of Sprint 15 scope) |
| Jest pure + rn projects | ✅ 150 suites / 1,887 tests pass; 110 snapshots (4 updated for the new DetailShell banner slot) |
| Deno test suite (`_shared` + `send-push/quiet-hours.test.ts`) | ✅ 142 tests pass |
| Voice-lint over every rendered banner / push template | ✅ Built into `notification-templates.test.ts` + `anomalyBannerCopy.test.ts` |

### Deferrals

| Item | Why |
|---|---|
| Live APNs `.p8` + FCM service-account credentials | Founder action — sandbox-only until provided. The pipeline ships against the Expo sandbox endpoint via `EXPO_PUSH_URL` env override. |
| `leiko.app` / `pair.leiko.app` DNS + AASA/assetlinks hosting | Founder action. Templates checked in. |
| pg_cron GUCs (`app.settings.functions_base_url`, `app.settings.service_role_key`) | Founder ops — same pattern as Sprint 14.5 + Sprint 12.5 crons; both must be set per-environment before `0018` runs. |
| On-device end-to-end demo recording (real BP crisis → real push receipt → real deep-link tap) | Requires APNs creds. Demoable today only via the Supabase Functions panel "Invoke" button hitting `send-push` with a synthetic anomaly payload. |
| False-positive precision/recall benchmark (200 hand-labelled BP sequences) | Sprint 16 follow-up per the spec. |

### Test counts (cumulative on this branch)

- 1,887 Jest tests across pure + rn projects
- 142 Deno tests across the shared modules + send-push helper
- 110 snapshots (107 pre-existing, 4 updated for the DetailShell banner slot)

### Files touched (final)

Migrations: `0016_anomaly_engine.sql`, `0017_anomaly_prefs_per_vital.sql`, `0018_pg_cron_detect_anomaly.sql`.

Edge Functions: `detect-anomaly/index.ts`, `send-push/index.ts` + `send-push/quiet-hours.test.ts`, `sync/index.ts` (post-BP-insert trigger).

Shared (Deno): `_shared/classification.ts` + `.test.ts`, `_shared/notification-templates.ts` + `.test.ts`, `_shared/voice-lint-push.ts` + `.test.ts`, `_shared/quiet-hours.ts`.

Mobile services: `services/notifications/{index,listeners,deepLinks,deepLinkParser}.ts` + tests; `services/analytics/logger.ts` (8 new event types).

Mobile state + hooks: `state/anomalies.ts` + tests, `state/notifications.ts` (per-vital fields), `hooks/useAnomalies.ts`, `hooks/useQuietHoursAffirm.ts`.

Mobile components: `components/ScreenAnomalyBanner.tsx`, `components/QuietHoursAffirmSheet.tsx`, `components/DetailShell.tsx` (banner slot).

Mobile screens: `screens/Home/CaregiverHome.tsx`, `screens/Home/SelfBuyerHome.tsx`, `screens/ReadingDetail/ReadingDetailScreen.tsx`, `screens/Settings/SettingsScreen.tsx`.

App config: `app.json` (iOS associatedDomains, Android intent filters, expo-notifications plugin), `well-known/*` (AASA + assetlinks + README).

Types: `src/types/database.ts` (`PushTokenRow`, `AnomalyEventRow`, `BpBaselineRow`, `HrBaselineRow`, `families.anomaly_sensitivity`, per-vital toggles).

Docs: `docs/10-anomaly-logic.md`, `docs/11-push-notifications.md`.

Mocks: `__mocks__/expo-notifications.js`, `__mocks__/expo-linking.js`.

Dependencies: `expo-notifications ~0.32.17`, `expo-linking ~8.0.12`.