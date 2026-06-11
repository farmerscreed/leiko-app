# 11 — Push Notifications

CANONICAL for Sprint 15+. Sourced from D7 §8, D8a §12, D13 §11.3, and the voice rules in `docs/05-voice-and-claims.md` + `docs/_reference/D11-brand-repositioning.md` §3.

Single egress: every push from Leiko goes through the `send-push` Edge Function. The mobile app never talks to Expo / APNs / FCM directly.

---

## 1. Categories

| Category | Default | Quiet hours |
|---|---|---|
| Daily summary | On | Suppressed |
| Weekly summary | On (Plus) | Suppressed |
| Anomaly — BP | On (Plus) | Honoured unless user opts in (per tier) |
| Anomaly — HR | On (Plus) | Honoured unless user opts in (per tier) |
| Anomaly — SpO2 | On (Plus) | Honoured unless user opts in (per tier) |
| Watch status | On | Suppressed |
| Family activity | On | Suppressed |
| Subscription / account | On | Suppressed |
| Marketing | **Off by default** | Suppressed |
| Remote refresh — silent (`sync_refresh`) | System (not user-toggled) | n/a — invisible, data-only |
| Remote refresh — nudge (`sync_nudge`) | Gated by Family activity | Suppressed (held) |

The two remote-refresh categories implement caregiver "sync now" — see §10. `sync_refresh` is a silent data-only push (no title/body, no opt-out, no quiet-hours — nothing renders). `sync_nudge` is the visible, human-confirmed fallback and runs the full visible pipeline; it is muted by the **Family activity** umbrella and held during the wearer's quiet hours.

The umbrella `anomaly_notifications` toggle is a kill-switch — when off, the three per-vital toggles have no effect.

Sleep + Activity have no anomaly toggles. They never push.

Per-category 24h rate limit: 3 max for non-urgent. Confirmed-urgent bypasses the rate limit.

---

## 2. Quiet hours

- **Default 22:00–07:00 in the recipient's IANA timezone.**
- Configurable in Settings → Notifications.
- During quiet hours, the only category that may fire is **anomaly + confirmed-urgent AND `anomaly_bypass_quiet = true`**. Everything else is suppressed (not deferred — the next eligible event re-fires its own copy if still relevant).
- `anomaly_bypass_quiet` defaults to **false** (per migration 0017). Users explicitly affirm via the one-shot `QuietHoursAffirmSheet` on first Home render. Settings is the second-chance toggle.

---

## 3. Deep link table (D7 §8.3, D13 §11.3)

| Category | URL | Target screen |
|---|---|---|
| Daily summary | `leiko://home` | Caregiver / Self-Buyer home |
| Weekly summary | `leiko://weekly` | Trends (weekly view) |
| Anomaly — BP | `leiko://reading/{reading_id}` | Reading Detail |
| Anomaly — HR / SpO2 | `leiko://vital/{kind}` | Vital Detail |
| Watch status | `leiko://settings/devices` | Settings (devices section) |
| Family activity | `leiko://family` | Family Members |
| Subscription | `leiko://settings/subscription` | Settings (subscription section) |
| Marketing | `leiko://home` | Home (no targeted deep link to avoid abuse) |
| Remote refresh nudge | — (no deep link) | Tapping runs a BLE sync via the `sync_refresh` data handler; the app opens to Home |

### Universal Links / App Links (REQUIRED)
- Apple's `apple-app-site-association` template at `apps/mobile/well-known/apple-app-site-association`.
- Android's `assetlinks.json` template at `apps/mobile/well-known/assetlinks.json`.

Before App Store / Play submission:
1. Replace `TEAMID` with the Apple Developer Team ID.
2. Replace the SHA-256 fingerprint placeholders in `assetlinks.json` with Play App Signing's certificate hash.
3. Host both at `https://leiko.app/.well-known/*` so iOS + Android can verify ownership.

The app declares Associated Domains (iOS) and intent filters (Android) for `leiko.app` and `pair.leiko.app` in `apps/mobile/app.json`.

---

## 4. Body templates

Server-side source of truth: `supabase/functions/_shared/notification-templates.ts`. Renders one of three account_type variants (`caregiver` / `self_buyer` / `parent`) per recipient. Every rendered string passes the Deno-side `voice-lint-push` filter in CI; hard-hit failure drops the push.

Length budget per body: ≤ 120 chars iOS / ≤ 180 chars Android. Title: ≤ 60 chars.

Example renders:

```
[caregiver  · BP crisis_absolute]
  Please call Mum
  Mum's reading just now was very high. We recommend reaching out today.

[caregiver  · BP stage2_sustained_60min]
  Please call Mum
  Three high readings for Mum in the last hour. We recommend reaching out now.

[self_buyer · HR confirmed_urgent (extreme_value)]
  Please call your doctor
  Your resting heart rate is outside its usual range. We recommend talking to your doctor today.

[caregiver  · SpO2 overnight_dip_sustained]
  Please call Mum
  Mum's overnight oxygen has dipped low three nights running. Worth a call to her doctor today.
```

Voice rules: never "alert", "warning", "critical", all-caps, multiple `!`. Calm before clever.

---

## 5. iOS interruption levels

| Tier | iOS interruptionLevel | Notes |
|---|---|---|
| All non-urgent | `active` | Respects DND, surfaces in normal stream. |
| Anomaly confirmed-urgent | `time-sensitive` | Surfaces above DND-suppressed default-priority notices; **does not bypass DND or ringer**. |

**Critical Alerts (`com.apple.developer.usernotifications.critical-alerts`) are intentionally NOT used.** Critical Alerts bypass Do-Not-Disturb and ringer; Leiko's brand voice (D11 §3, CLAUDE.md) is calm-before-clever, not fear-based. Confirmed-urgent gets time-sensitive instead, which respects DND.

Android: anomaly channel is `HIGH` importance (heads-up). Confirmed-urgent uses `priority: 'high'` on the Expo message envelope.

---

## 6. Token registration

- `expo-notifications` `getExpoPushTokenAsync()` is called once at app boot (after auth), and on every foreground.
- Token + platform + per-install `device_id` (UUID persisted in MMKV) upsert into `public.push_tokens` keyed by `(user_id, device_id)`.
- Native APNs/FCM token (when available) is stored alongside for the future migration off Expo Push API.
- Tokens unseen > 60 days are soft-purged by a retention cron (Sprint 17 follow-up).

---

## 7. Per-push pipeline (Sprint 15)

`send-push` runs each request through:

1. Recipient lookup + `notification_preferences` + tokens.
2. Per-category opt-out + per-vital opt-out gates.
3. Template render via recipient's `account_type`.
4. Voice-lint over title + body. **Hard hit → drop, log to audit_log.**
5. Length check (Android 180 cap).
6. Quiet-hours check in recipient's timezone (cross-midnight aware).
7. Per-category 24h rate limit (urgent bypasses).
8. Expo Push API POST.
9. `audit_log` row: `push.sent` or `push.suppressed` with category + outcome + (anomaly only) vital_kind + tier + anomaly_event_id. **No reading values.**

PostHog events fire mobile-side from the response handler.

---

## 8. Delivery telemetry

Per `docs/13-testing-standard.md`:
- Push delivery success rate ≥ 98% (alert < 95% over 1h).
- Anomaly false-positive rate ≤ 15% thumbs-down (alert > 25% week-over-week).
- All push events emit a PostHog event (mobile-side from the tap listener; server-side via audit_log).
- PHI rule: reading values NEVER in metadata.

---

## 9. Open items

- Localised quiet-hour defaults (e.g. earlier 21:00 in Lagos) — defer to v1.1.
- Snooze-for-1-hour affordance on anomaly notifications — defer.
- Apple Live Activities for in-progress reading — defer to v1.2.
- APNs `.p8` + FCM service account credentials — founder action; sandbox-only until provided.

---

## 10. Remote refresh (silent-first) — ADR-0011

Caregiver "sync now": a remote caregiver pulls-to-refresh on the parent's
dashboard and the parent's phone syncs the watch over BLE. **Silent-first
with a human-confirmed visible fallback** (full rationale: `docs/_adr/0011`).

Flow (caregiver-triggered, via `request-sync`):

1. **Silent attempt** — `request-sync` (default, `escalate=false`) → `send-push`
   `sync_refresh` → a data-only push (`{ type: 'sync_refresh' }`, no title/body,
   `_contentAvailable`, `priority: high`). A foreground / battery-opt-exempt
   phone runs the BLE sync invisibly. **Nothing is shown to the wearer.**
2. **Watch for fresh data** — the caregiver screen (`useRemoteRefreshNudge`)
   watches its Realtime `readings` / `vitals_other` feed. If new data lands
   within ~20s, the sync worked silently — done.
3. **Offer a reminder** — if no fresh data arrives, the screen shows the
   *caregiver* a calm "Send a reminder" row (never auto-sent).
4. **Escalate (caregiver tap)** — that tap calls `request-sync` with
   `escalate=true` → `send-push` `sync_nudge` → a **visible** notification
   ("{name} would love to see your latest reading. Tap to sync your watch.")
   the OS delivers reliably even in Doze. It carries `data.type='sync_refresh'`
   so the wearer's tap (or a foreground receive) runs the same BLE sync.

Properties:
- **`sync_refresh` (silent)**: skips render / opt-out / quiet-hours / voice-lint;
  carries no title, body, or PHI. Coalesced (30s) server-side. Used by both the
  caregiver silent attempt and the automatic 3-hourly `request-stale-syncs` cron.
- **`sync_nudge` (visible)**: full pipeline — opt-out under **Family activity**,
  voice-lint (fail-closed), quiet-hours hold, 24h/3 rate limit. Copy + message
  builder in `_shared/sync-nudge.ts`. Routed through the Android `family` channel.
- The automatic cron is **always silent** — it must never nag.
- Client orchestration ships in the **v5 build**; old clients that omit
  `escalate` get the silent push (backward compatible).

Why not auto-escalate: reliably detecting a background *wake* needs a
server-written ack; "no new reading" conflates *didn't wake* with *nothing to
sync* and would false-nag. See ADR-0011.
