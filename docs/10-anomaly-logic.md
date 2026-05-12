# 10 — Anomaly Logic

CANONICAL for Sprint 15+. Extended from BP-only (Sprint 6) to multi-vital per `docs/_reference/D13-multi-vitals-constellation-spec.md` §11. Voice rules from `docs/05-voice-and-claims.md` and `docs/_reference/D11-brand-repositioning.md` §3 apply.

> **Hard rule** (D3 + CLAUDE.md): the anomaly engine surfaces a **statistical outlier**, never a clinical diagnosis. Language is descriptive ("higher than usual"), never diagnostic ("hypertensive crisis"). Detection logic is statistical, not clinical.

---

## 1. Per-vital anomaly rules (D13 §11.1)

| Vital | Calm-Concerned | Confirmed-Urgent |
|---|---|---|
| **BP** | Single reading > 150 sys OR > 95 dia AND > 2σ outlier (with ≥14-day baseline). Cold-start fallback: > 160 sys OR > 100 dia OR > 130 pulse. | ≥ 180/120 single reading (crisis-absolute) OR 3 readings > 160/100 in a rolling 60 minutes (stage2_sustained_60min). |
| **HR** | Resting HR > baseline + 15 bpm for 3 consecutive days (baseline_3day_trend) OR > 100 bpm at rest sustained (sustained_high_at_rest). | < 40 bpm OR > 130 bpm sustained at rest (extreme_value). |
| **SpO2** | Latest spot reading 90–94 OR latest overnight low 88–89 (sample_or_overnight_borderline). | Overnight low < 88 sustained 3+ nights (overnight_dip_sustained). |
| **Sleep** | **Never produces a banner or push** — score classification informs the ring colour on Vital Detail only. | Never. |
| **Activity** | **Never produces a banner or push.** | Never. |

Sleep + activity exclusion is enforced in code by `producesAnomalyEvent(vital, tier)` in `supabase/functions/_shared/classification.ts` and mirrored on the mobile side by the `pickMostSevere*` selectors.

---

## 2. Detection flow

### 2.1 BP — hot path (`/sync` → `detect-anomaly` inline)

After every successful BP insert, `/sync` calls `detect-anomaly` with `{ mode: 'reading_inserted', familyId, readingId }`. The function:

1. Resolves the analysis subject (parent in caregiver mode, the user themselves in self-buyer / parent modes) via `families.parent_user_id` with fallback to `family_owner`.
2. Loads the user's `bp_baselines` row + the family's `anomaly_sensitivity`.
3. Runs `classifyBP(reading, baseline, sensitivity)` — see `_shared/classification.ts`.
4. Runs `checkSustainedPattern(recent, now)` over the parent's last 60 minutes of readings; if 3+ are at Stage 2, escalates to `confirmed_urgent { reason: 'stage2_sustained_60min' }`.
5. Dedup: if the most recent unrelated `anomaly_events` row for `(user_id, vital_kind='bp')` is within 4 hours AND the new tier is calm-concerned, suppress (per docs/10 §3). Confirmed-urgent always fires.
6. Writes the event + dispatches `send-push` once per recipient.

Latency budget: < 5s from `/sync` ack to event row.

### 2.2 HR + SpO2 — nightly path (pg_cron → `detect-anomaly` cron)

Migration `0018_pg_cron_detect_anomaly.sql` schedules `detect-anomaly` with `{ mode: 'cron' }` at 03:00 UTC. The function iterates families with recent data:

- **HR**: recomputes `hr_baselines.median_bpm` over the previous 14 days of `motion_state='rest'` samples; evaluates `classifyHR({ restingBpmToday, restingBpmRecent })`; writes an event if calm or urgent and dedup permits.
- **SpO2**: collects the previous 5 nights of `min(value_int_3)` per UTC day from `vitals_other` SpO2 rows; runs `classifySpO2({ latestPercent, overnightLowsRecent })`; writes an event for `confirmed_urgent` (3-night dip) or `calm_concerned` (single 88–89 overnight).

The cron also keeps `bp_baselines` fresh so the hot path can use a current baseline.

---

## 3. False-positive control

### 3.1 Deduplication
After a calm-concerned anomaly fires, the next one for the same `(user_id, vital_kind)` within **4 hours** is suppressed. The reading itself is still saved and visible; only the second push/event is dropped. Confirmed-urgent does NOT dedup — crisis-absolute fires even if a recent event existed.

### 3.2 Per-family sensitivity
`public.families.anomaly_sensitivity` is a `numeric(3,2)` per-family multiplier on the σ threshold (default 1.00, clamped 0.80–1.50). Thumbs-down on a banner nudges it +0.05 (less sensitive); thumbs-up nudges it −0.02 (more sensitive). Asymmetric — fewer false positives is more important than catching every outlier.

### 3.3 False-positive metric
- Target: ≤ 15% thumbs-down on anomaly notifications.
- Alert threshold: > 25% week-over-week.

Tracked in PostHog via the `anomaly_feedback` event in `apps/mobile/src/services/analytics/logger.ts`. No PHI in metadata — only `{ vital, tier, thumb }`.

---

## 4. Banner UI

See `docs/03-components/anomaly-banner.md` for the component (Sprint 7.6 ships the primitive; Sprint 15 wires it). The mobile-side wiring:

- `ScreenAnomalyBanner` (`apps/mobile/src/components/ScreenAnomalyBanner.tsx`) — most-severe-wins selector, renders nothing when no event. Wired on Home (caregiver + self-buyer), Reading Detail, and per-vital Detail screens (via `DetailShell`).
- Copy lives in `apps/mobile/src/utils/anomalyBannerCopy.ts`. Voice-lint runs over every (vital × tier × recipient) combination in CI.
- Tap → navigate to Reading Detail (BP) or Vital Detail (HR/SpO2). Dismiss (calm-concerned only) writes `acknowledged_at` and removes the row from the selector. Confirmed-urgent has no dismiss action; only an explicit "see the reading" path.

---

## 5. Push routing (D13 §11.3)

| Trigger | Push? | In-app banner? | Quiet hours respected? |
|---|---|---|---|
| BP calm-concerned (single) | No | Yes | n/a |
| BP calm-concerned (trend) | Yes | Yes | Yes |
| BP confirmed-urgent | Yes | Yes | Honoured unless user opted in |
| HR calm-concerned (3-day trend) | Yes | Yes | Yes |
| HR confirmed-urgent | Yes | Yes | Honoured unless user opted in |
| SpO2 calm-concerned | Yes | Yes | Yes |
| SpO2 confirmed-urgent (3-night trend) | Yes | Yes | Honoured unless user opted in |
| Sleep / Activity | No | No | n/a |

Quiet-hours override defaults to **off** — users explicitly affirm via the one-shot sheet on first home render (`QuietHoursAffirmSheet`). Settings → Notifications is the second-chance path.

iOS confirmed-urgent uses `interruptionLevel: 'time-sensitive'` (respects DND but surfaces above default). **Critical Alerts are explicitly not used** — they bypass DND and ringer, and Leiko is not a fear-language brand.

---

## 6. Feature gate

- **Free tier** sees the reading on the dashboard but **no proactive anomaly push**. An unobtrusive note on home: *"Get proactive notices with Leiko Plus"* (links to paywall).
- **Plus tier** receives anomaly pushes per category preferences (`docs/11-push-notifications.md`).
- The reading itself is never paywalled — only the proactive notification.

---

## 7. Testing requirements

Per `docs/13-testing-standard.md`:

- **Unit tests** for `classifyBP`, `classifyHR`, `classifySpO2`, `checkSustainedPattern`, `computeBpBaseline`, `computeHrMedian`, `producesAnomalyEvent`, `shouldDedupAnomaly` — boundary cases at sys=149/150/151, bpm=39/40/130/131, SpO2=87/88/89/90, sigma boundaries, cold-start path. Both Deno tests (`_shared/classification.test.ts`) and Jest tests (`apps/mobile/src/utils/__tests__/classification*.test.ts`).
- **Banner voice test**: every (vital × tier × recipient) combo runs through `voiceLint`/`voice-lint-push` in CI. Fails closed.
- **Quiet-hours boundary test** in `supabase/functions/send-push/quiet-hours.test.ts` — DST, midnight-cross window, per-timezone (UTC, Lagos UTC+1, NJ UTC-5).
- **False-positive test** (Sprint 16 follow-up): fixture of 200 hand-labelled BP sequences asserts precision/recall against the labels.

---

## 8. Schema reference

- `public.anomaly_events` (migration 0016) — one row per fired anomaly. Immutability trigger protects identity columns; only ack + push + feedback columns may be updated.
- `public.bp_baselines` / `public.hr_baselines` (migration 0016) — per-user rolling baselines. Refreshed nightly.
- `public.families.anomaly_sensitivity` (migration 0016) — per-family multiplier.
- `public.notification_preferences.{anomaly_bp,anomaly_hr,anomaly_spo2}` (migration 0017) — per-vital opt-outs.
- `public.notification_preferences.anomaly_bypass_quiet` default flipped to FALSE in migration 0017; existing rows preserved.
