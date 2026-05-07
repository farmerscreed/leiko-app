# D13 — Multi-Vitals Constellation Spec

**Five-Vital Data Surface · Daily Pulse · Cross-Vital Correlation**
*Prepared: 2026-05-07 · Status: Draft for founder sign-off*

---

## Document Metadata

| Field | Value |
|---|---|
| **Deliverable** | D13 — Multi-Vitals Constellation Spec |
| **Project** | Leiko health-wearable platform |
| **Predecessor docs** | D11 (Brand Repositioning) · D12 (Visual System v2) |
| **Sister docs** | D14 (Ambient AI Architecture) |
| **Authority** | When D13 conflicts with `docs/01-data-model.md`, `docs/06-ble-protocol.md`, `docs/04-screens/`, or `docs/10-anomaly-logic.md`, those files are updated to match D13 |
| **Implementation gate** | Sprint 7.5 (multi-vitals ingest plumbing) and Sprint 7.6 (Daily Pulse component primitives) cannot begin until D13 is signed off |

---

## Executive Summary

D13 turns the *premium pulse* promise from D11 into a concrete product surface. It specifies five vital data streams (BP, HR, SpO2, Sleep, Activity), the BLE ingest expansion (10 new wrappers), the `/sync` Edge Function expansion, the local persistence model, the classification logic per vital, the Daily Pulse hero's adaptive behaviour, the five vital detail screens, and the cross-vital correlation engine that turns isolated numbers into a story.

The single biggest claim of this document: **users perceive Leiko as a premium pulse, not a BP tracker, because the constellation surface treats vitals as a system rather than as separate metrics.** Sleep × morning BP is the canonical example — that correlation is what makes the app feel intelligent. D13 specifies how this is implemented end-to-end.

The current app captures only BP. After Sprint 7.5 + 7.6 ship D13's plumbing and primitives, the constellation goes live and Sprint 8 onwards consumes it through the screens.

---

## §1. The Five Vitals — At a Glance

| Vital | Source on watch | Capture frequency | Daily Pulse role | BLE cmd |
|---|---|---|---|---|
| **Blood Pressure (BP)** | Oscillometric micro-cuff inflate | User-initiated, 1–3×/day | Headline ring (brand accent); morning reading drives central value | 0x14 (existing) |
| **Heart Rate (HR)** | PPG continuous + spot | Auto-sample every 30min when enabled; spot on-demand | Coral ring; resting HR displayed | 0x15 (history), 0x16 (auto on/off) |
| **Blood Oxygen (SpO2)** | PPG | Auto-sample every 30min when enabled; spot on-demand | Teal ring; latest + overnight low | 0x2D (history), 0x2C (auto on/off) |
| **Sleep** | Derived from accelerometer + HR pattern | Nightly, computed at wake | Violet ring; last night's score | 0x12 / 0x13 |
| **Activity (steps + calories)** | Accelerometer | Continuous, summarized daily | Sage ring; today's progress vs goal | 0x12 |

A sixth metric — **Calories** — is captured but is not its own ring. It rides along with Activity (the sage ring shows steps progress; calories appears as the secondary line on the Activity tile).

This is the headline list. D13 expands each below.

---

## §2. Vital Data Shapes

### 2.1 Blood Pressure (BP)

**Already implemented.** `public.readings` table per `docs/01-data-model.md`. Schema preserved.

```
{
  id, family_id, device_id,
  source: 'watch' | 'manual' | 'clinic' | 'pharmacy' | 'other',
  measured_at: timestamptz,
  measured_at_local: ISO with offset,
  systolic: int (30-300),
  diastolic: int (20-200),
  pulse: int (30-240) | null,
  quality_score: 'good' | 'fair' | 'suspect' | null,
  quality_flags: jsonb,
  motion_detected: boolean,
  hidden, hidden_reason, hidden_by_user_id, hidden_at
}
```

No D13 changes to BP schema.

### 2.2 Heart Rate (HR)

Goes into `public.vitals_other`. Schema:

```
{
  vital_type: 'hr',
  measured_at: timestamptz,
  value_int: bpm,                  // the reading (40-220 valid range)
  value_jsonb: {
    sample_window_sec: int,         // typically 1 (spot) or 30 (auto-sample window)
    motion_state: 'rest' | 'light' | 'moderate' | 'vigorous' | 'unknown',
    is_spot_check: bool             // true if user pressed "Take HR" on watch
  }
}
```

A **derived aggregate** is computed nightly per user: `resting_hr_today` = lowest 10-minute rolling-average HR sample during the user's sleep window. This is the value displayed on Daily Pulse.

### 2.3 Blood Oxygen (SpO2)

Schema:

```
{
  vital_type: 'spo2',
  measured_at: timestamptz,
  value_int: percent,               // primary value (typically the average for the sample window)
  value_int_2: max_in_window,
  value_int_3: min_in_window,
  value_jsonb: {
    sample_window_sec: int,
    is_spot_check: bool,
    perfusion_index: float | null   // sensor confidence
  }
}
```

A **derived aggregate** per night: `overnight_spo2_low` = lowest valid SpO2 sample during the user's sleep window. This is a sleep-disordered-breathing signal — described as "share with your doctor," never as a diagnosis.

### 2.4 Sleep

Schema:

```
{
  vital_type: 'sleep_session',
  measured_at: timestamptz,         // session start
  value_int: total_minutes,
  value_int_2: deep_minutes,
  value_int_3: rem_minutes,
  value_jsonb: {
    session_start_local: ISO,
    session_end_local: ISO,
    light_minutes: int,
    awake_minutes: int,
    awake_count: int,                // number of wake events
    transitions: [
      { t: ISO, stage: 'light' | 'deep' | 'rem' | 'awake' }
    ],
    sleep_score: int                 // 0-100, computed (see §6.4)
  }
}
```

One row per sleep session, written when the watch emits the session-complete event (typically a few minutes after the user wakes, when motion patterns confirm wake).

### 2.5 Activity (steps)

Schema:

```
{
  vital_type: 'steps_day',
  measured_at: timestamptz,         // start-of-day in user local time
  value_int: total_steps,
  value_jsonb: {
    day_local: 'YYYY-MM-DD',
    target_steps: int,                // user-set goal (default 6000)
    last_sample_at: ISO,
    hourly: [int × 24]                // steps per hour (00-23)
  }
}
```

One row per local day per user. Updates throughout the day as the watch syncs.

### 2.6 Calories (rides with Activity)

Schema:

```
{
  vital_type: 'calories_day',
  measured_at: timestamptz,
  value_int: kcal,
  value_jsonb: {
    day_local: 'YYYY-MM-DD',
    target_kcal: int | null,
    activity_kcal: int,                // active calories
    bmr_kcal: int                      // basal estimate
  }
}
```

### 2.7 What's NOT in the schema

Stating these explicitly to prevent scope creep:

- **No HRV.** Could be derived from PPG inter-beat intervals, but the U16 firmware does not expose those at the resolution needed. Out of scope for v1.0.
- **No stress score.** Same.
- **No skin temperature.** Hardware doesn't sense it.
- **No automatic activity classification.** Steps is steps. We do not auto-detect runs, walks, cycling, etc. The watch's `value_jsonb.motion_state` field is qualitative only.
- **No menstrual / fertility data.** Out of cleared IFU and out of brand scope.
- **No nutrition logging.** Calories is from activity, not from food. We do not ask users to log meals.

---

## §3. BLE Ingest Layer

### 3.1 Wrappers needed (10 new)

Per `docs/06-ble-protocol.md` §3 — 14 commands total in firmware. Currently 4 wrappers exist (`setTime`, `findWatch`, `readBattery`, `readBPHistory`). D13 adds 10:

| BLE cmd | Wrapper | Purpose |
|---|---|---|
| 0x21 | `setGoals(device, goals)` | Push user's step/sleep/activity goals to watch (drives watch face progress display) |
| 0x12 | `readActivity(device, day)` | Pull steps + calories for a given day |
| 0x12 / 0x13 | `readSleep(device, day)` | Pull sleep session for a given day |
| 0x0A | `setUserParams(device, p)` | Push user gender/age/height/weight (drives BMR + calorie estimation) |
| 0x04 | `setTimeFormat(device, fmt)` | 12h/24h, metric/imperial |
| 0x16 | `setAutoHR(device, bool)` | Toggle continuous HR sampling |
| 0x15 | `readHRHistory(device, since)` | Pull HR samples since timestamp |
| 0x2C | `setAutoSpO2(device, bool)` | Toggle continuous SpO2 sampling |
| 0x2D | `readSpO2History(device, day)` | Pull SpO2 samples for a given day |
| 0xFF | `factoryReset(device, confirm)` | Unbind for re-pair |

All wrappers follow the pattern in `docs/06-ble-protocol.md` §3 — pure functions, build packet, write, await response, validate. CRC failures retry silently.

### 3.2 Notify routing fix

Current `apps/mobile/src/services/ble/notify.ts` subscribes to the notify characteristic but only routes the BP byte to a downstream handler (the other handlers exist as typed dead-code paths). D13 expands the wiring to all live triggers per the vendor U16PRO PDF §4.13 + `docs/06-ble-protocol.md` §3 cmd 0x73 sub-events.

The byte mapping below is **empirically verified** against U19M_013C in Lagos 2026-05-07 — the Sprint 6 BP path proves `0x02 = BP completed`. An earlier draft of this section had `0x01` and `0x02` reversed; corrected here in Sprint 7.5.

| Sub-event byte | Meaning | Routes to |
|---|---|---|
| `0x01` | Live HR sample | New `onHR` handler — push to local `state/hr.ts` |
| `0x02` | Live BP completed | Existing `onBP` handler |
| `0x03` | Live SpO2 sample | New `onSpO2` handler |
| `0x04` | Step-counting event | New `onSteps` handler — invalidate activity cache |
| `0x07` | Sports record | New `onSports` handler — invalidate activity cache |
| `0x09` | Do-not-disturb echo | Settings echo (no-op for ingest) |
| `0x0C` | Battery state | Existing `onBattery` handler |
| `0x10` | Sleep session complete | New `onSleepSessionComplete` handler — trigger `readSleep` (UNVERIFIED empirically — to be confirmed during Sprint 7.5 soak; the orchestrator's sequenced-sync also pulls last-night sleep on every reconnect so a missed/misrouted byte here is non-fatal) |

### 3.3 Sequenced sync on reconnect

When the watch reconnects:

1. `setTime(device, tz)` — clock sync (existing)
2. `setUserParams(device, ...)` — push user demographics if dirty (NEW)
3. `setGoals(device, ...)` — push goals if dirty (NEW)
4. `readBPHistory(device, since)` — existing
5. `readHRHistory(device, since)` — NEW
6. `readSpO2History(device, today_local)` — NEW (per-day rather than since-cursor — protocol limitation)
7. `readSleep(device, last_night)` — NEW
8. `readActivity(device, today_local)` — NEW

Each step has its own success criterion; failures are isolated (HR sync failure doesn't block BP sync). Retry on next reconnect with exponential backoff.

### 3.4 Per-vital sync cursor

Currently `lastSyncByDevice` stores a single timestamp. D13 expands to per-vital cursors:

```
type VitalSyncCursor = {
  bp: number              // unix sec, raw watch format
  hr: number              // unix sec, raw watch format
  spo2: string            // 'YYYY-MM-DD' last full day
  sleep: string           // 'YYYY-MM-DD' last full night
  activity: string        // 'YYYY-MM-DD' last full day
}
```

Stored in MMKV per-device. Each cursor advances independently after a successful sync of that vital.

### 3.5 The watch-firmware-timestamp quirk (already handled for BP)

Per `docs/06-ble-protocol.md` §1.1 — the watch serialises timestamps as if its wall clock is China-local-time (UTC+8). The fix `watchTimestampToUtcSec` already exists in `services/sync/syncBacklog.ts` for BP. D13 reuses the same utility for HR samples (per-sample timestamps follow the same encoding). Sleep and SpO2 sync per-day rather than per-sample so the quirk doesn't apply at the boundary; activity is per-day same.

Verified empirically against U19M_013C on 2026-05-07 in Lagos. Behaviour holds across all per-sample vitals.

---

## §4. Sync Layer (`/sync` Edge Function expansion)

### 4.1 Current shape

`/sync` accepts a `ReadingPayload` (BP only). Inserts into `public.readings`.

### 4.2 New shape — `MultiVitalsPayload`

```
type MultiVitalsPayload = {
  device_id: string,
  family_id: string,
  bp_readings?: BPReading[],
  hr_samples?: HRSample[],
  spo2_samples?: SpO2Sample[],
  sleep_sessions?: SleepSession[],
  activity_days?: ActivityDay[],
  calories_days?: CaloriesDay[],
  client_synced_at: ISO,
  client_app_version: string
}
```

Each array is independently optional. Edge Function inserts each array into its target table (`readings` for BP, `vitals_other` for everything else) within a single transaction. Partial-payload sync is supported — a payload with only HR samples is valid.

### 4.3 Idempotency

`vitals_other` already has the dedup index `(device_id, vital_type, measured_at)`. Re-uploads of the same sample are no-ops. Same defence as BP today.

### 4.4 Server-side validations

| Vital | Reject if |
|---|---|
| HR | bpm < 30 or > 220 (sensor noise) |
| SpO2 | percent < 70 or > 100 |
| Sleep | total_minutes < 30 (too short to be a real session) or > 18×60 (impossible) |
| Steps | < 0 or > 100,000 (sensor glitch) |
| Calories | < 0 or > 10,000 |

Rejected samples are dropped silently and logged to `audit_log` with `action='sync.invalid_sample'`. PostHog event `multi_vital_invalid_sample` fires for ops monitoring.

### 4.5 Apple Health / Health Connect bridge (Sprint 9.5)

When the bridge is enabled (user opted in), the same payload is **also** written to the platform health store. Implementation lives in a separate service module (`services/health-platform/`) that consumes the same payload shape after `/sync` returns success.

Two-way: writes go to platform; reads from platform are pulled into a parallel `external_vitals` namespace (not into `vitals_other` directly — keeps the source-of-truth clean). Platform-sourced data is visible in Trends but is not eligible for Leiko's anomaly engine.

---

## §5. Local Persistence

### 5.1 MMKV (offline-first writes)

Each vital captured locally first, written to MMKV pending buffer, then attempted sync. Same architecture as current BP path. New keys:

```
mmkv.pending.bp                  // existing
mmkv.pending.hr
mmkv.pending.spo2
mmkv.pending.sleep
mmkv.pending.activity
mmkv.pending.calories
mmkv.cursor.{deviceId}.{vital}   // per-vital cursor
```

Pending buffer flushes on:
- BLE reconnect successful
- Network connectivity regained (TanStack Query background refetch)
- App foreground

### 5.2 WatermelonDB (queryable cache)

Schema mirrors a 30-day window of `public.readings` + `public.vitals_other`. Indexed on `(family_id, vital_type, measured_at)` for fast trend queries.

### 5.3 State stores (Zustand)

Each vital gets its own slice. Pattern follows existing `state/readings.ts`:

```
state/
├── readings.ts              // BP — existing
├── hr.ts                    // NEW
├── spo2.ts                  // NEW
├── sleep.ts                 // NEW
├── activity.ts              // NEW (steps + calories combined)
└── dailyPulse.ts            // NEW — composes the others into the hero data shape
```

`dailyPulse.ts` is a **derived selector** that composes the latest values from each vital store + the AI narration string into a single `DailyPulseData` shape consumed by the hero component.

---

## §6. Classification Logic per Vital

Each vital has a state classifier. The classifier maps a reading to one of: `in-pattern` · `calm-concerned` · `confirmed-urgent` · `stale` · `no-data`.

These states drive the ring color modulation, the tile state, and feed the anomaly engine.

### 6.1 BP classifier (existing — preserved)

Per `apps/mobile/src/utils/classification.ts`:

| State | Threshold (AHA 2017) |
|---|---|
| Normal | Sys < 120 AND Dia < 80 |
| Elevated | Sys 120-129 AND Dia < 80 |
| Stage 1 | Sys 130-139 OR Dia 80-89 |
| Stage 2 | Sys 140-179 OR Dia 90-119 |
| Crisis | Sys ≥ 180 OR Dia ≥ 120 |

Mapping to D13 states:
- Normal · Elevated → `in-pattern`
- Stage 1 · Stage 2 (single reading) → `calm-concerned`
- Crisis (single) OR three Stage 2+ in 60min → `confirmed-urgent`

### 6.2 HR classifier (new)

Resting HR varies with age. We use a per-user adaptive baseline computed nightly.

```
baseline_resting_hr = median of last 14 days of resting_hr_today
```

| State | Rule |
|---|---|
| `in-pattern` | resting_hr_today within ±10 bpm of baseline AND within 50–95 absolute |
| `calm-concerned` | resting_hr_today > baseline + 15 bpm for 3+ consecutive days OR > 100 sustained while at-rest |
| `confirmed-urgent` | resting_hr_today < 40 OR > 130 sustained at rest (sensor-error fallback: drop sample if the watch reports motion_state ≠ 'rest') |

Until 14 days of baseline data exist, classifier returns `in-pattern` for any value in 50–95 absolute, `calm-concerned` outside that band, `confirmed-urgent` only at extremes (< 40 or > 130).

### 6.3 SpO2 classifier (new)

Per AHA + clinical guidelines, mapped to non-diagnostic D13 language.

| State | Rule |
|---|---|
| `in-pattern` | latest_spo2 ≥ 95 AND overnight_low ≥ 90 |
| `calm-concerned` | latest_spo2 90–94 OR overnight_low 88–89 |
| `confirmed-urgent` | overnight_low < 88 sustained 3+ nights — language: "below 88% sustained — share with your doctor" |

A single below-90 reading does NOT trigger calm-concerned alone (sensor noise is real). Pattern-of-3 is the threshold.

### 6.4 Sleep classifier (new)

Sleep score = composite of (total time, deep %, wake count, sleep efficiency).

```
sleep_score (0-100) =
  + total_score (max 50)        // capped at 8h: each hour from 4h up = 6.25 pts
  + deep_score (max 20)         // % of total deep sleep, capped at 25%
  + continuity_score (max 20)   // 20 - (wake_count * 4) capped at 0
  + efficiency_score (max 10)   // total / (session_end - session_start)
```

| State | Rule |
|---|---|
| `in-pattern` | sleep_score ≥ 70 |
| `calm-concerned` | sleep_score 50–69 (info only — does not push) |
| `confirmed-urgent` | never (sleep alone never triggers urgent) |
| `no-data` | no session recorded last night |

Note: poor sleep is *contextual data* for the BP and HR classifiers via the correlation engine (§9), not a urgent state on its own.

### 6.5 Activity classifier (new)

| State | Rule |
|---|---|
| `in-pattern` | steps ≥ 80% of target_steps |
| `calm-concerned` | never (low activity is info, not concerning) |
| `confirmed-urgent` | never |
| `progress` | < 80% of target — display as "in progress" |

The activity ring is the only ring that does not surface concern states. Low activity does not push notify; it's just shown.

### 6.6 Stale classifier (cross-vital)

Each vital has a staleness rule:

| Vital | Stale threshold |
|---|---|
| BP | last reading > 36h ago |
| HR | no auto-sample in last 6h (when auto-HR is on) |
| SpO2 | no auto-sample in last 8h (when auto-SpO2 is on) |
| Sleep | no session recorded in last 24h |
| Activity | no step sync in last 6h |

A stale vital displays the ring at 50% opacity and 70% saturation per D12 §11.2.1. Tile shows a "last sync 4h ago" caption.

---

## §7. Daily Pulse Hero Behaviour

The hero is a `DailyPulseHero` component (D12 §11.2.3). D13 specifies the **behaviour** — what's in the rings, what the central value is, how the AI narration is sourced.

### 7.1 The five rings (always present, fill state varies)

| Ring (outer → inner) | Color | Fill formula |
|---|---|---|
| BP (outermost) | brand accent | latest BP classification → 0/25/50/75/100% based on state — full ring at in-pattern, 50% at calm-concerned, etc. |
| HR | coral | `(resting_hr_today - 40) / 80` clamped 0-1 — visualises within-band position |
| SpO2 | teal | `(latest_spo2 - 85) / 15` clamped 0-1 |
| Sleep | violet | `sleep_score / 100` |
| Activity (innermost) | sage | `steps_today / target_steps` clamped 0-1 |

The rings always render — empty state uses the `no-data` ring (12% opacity track only, no fill).

### 7.2 The central value — adaptive

The center of the hero shows ONE primary number. Selected by this priority:

1. **If a fresh BP reading exists (≤ 8h old):** show that. Format `"128/82"` in `type.numeric-hero`. Label: `"morning BP"` (or `"latest BP"` if not morning).
2. **Else if a HR sample exists today (≤ 12h old):** show resting HR. Format `"62"`. Label: `"resting HR"`.
3. **Else if last night's sleep is recorded:** show sleep total. Format `"7h 24m"`. Label: `"last night"`.
4. **Else:** show "—". Label: `"no readings yet today"`.

The adaptive logic means the hero always says *something useful* even before the user takes their first reading of the day. This is the Apple-of-Healthcare bar — the screen is never empty.

### 7.3 The AI narration line

Below the rings, in `type.display-m`, brand accent color: a single sentence generated daily.

D14 specifies the prompt and tier routing. D13 specifies the data shape the AI is given:

```
{
  parent_name: string,                 // "Mum" or user's chosen label
  account_type: 'caregiver' | 'self_buyer' | 'parent',
  today_date_local: 'YYYY-MM-DD',
  bp: { latest, classification, week_avg } | null,
  hr: { resting_today, baseline, classification } | null,
  spo2: { latest, overnight_low, classification } | null,
  sleep: { last_night_total, sleep_score, classification } | null,
  activity: { steps_today, target, percent_of_target } | null,
  notable_correlations: Correlation[]   // up to 3, see §9
}
```

The AI generates one sentence (or two short sentences). Examples per D11 §3.6 voice rules:

> *"Mum is in pattern. 124/79 this morning, six below her week."*
> *"You slept 7h 24m, your morning BP is in pattern, and your resting heart rate is two below your week."*
> *"Your sleep was light last night. Your morning number is six above your week — these often go together."*

Falls back to a deterministic template if AI is offline or quota exhausted.

### 7.4 Caregiver mode — the Family Circle pattern

Each parent in the family gets a **scaled-down** Daily Pulse card (`mode='card'`). Layout:
- Smaller hero (240pt → 168pt diameter)
- Simpler narration line (one sentence only)
- Tap → opens immersive Daily Pulse for that parent

Multiple parents = vertical stack of these cards. The Family Circle metaphor is preserved.

### 7.5 Live state visibility

When any vital is *currently* being captured (HR notify is streaming, BP cuff is inflating), that vital's ring runs the live-pulse animation per D12 §7.5. Only one vital can be live at a time.

A small "live" pill appears next to the central value when a live capture is in progress.

---

## §8. Vital Detail Screens

Tap any VitalTile → opens that vital's detail screen. Five new screens; the existing BP detail gets visual upgrade only.

### 8.1 Common structure (all five)

| Element | Spec |
|---|---|
| Header | Vital name in `type.headline`, back chevron, share/export action |
| Hero card | Latest value in `type.numeric-xl`, classification pill, time of capture |
| Trend chart | 7d/30d/90d toggle, vital-color line, baseline shadow band |
| Cross-vital correlation strip | One pre-computed correlation involving this vital — see §9 |
| Pattern callout | Tier-A or Tier-B AI paragraph describing patterns over the selected range |
| History list | Last N readings, tap → reading-detail |
| Settings shortcut | Per-vital toggles (auto-sample on/off, goal config, share to Apple Health) |

### 8.2 BP Detail

Existing screen preserved. Visual upgrade per D12 (dark canonical, vital ring instead of bar gauge). Pattern callout becomes Tier-B paragraph instead of static text.

### 8.3 HR Detail

Specific elements:
- Hero shows resting HR + tabular small-print for max-today / min-today
- Trend chart shows resting HR over time (not all samples — a noise-floor view)
- "Activity context" sub-section: "Your resting HR was 4 below baseline last week — your daily activity averaged 7,200 steps, above your target."
- Live-pulse animation when HR is currently streaming

### 8.4 SpO2 Detail

Specific elements:
- Hero shows latest spot value + overnight-low secondary value
- Trend chart shows daily overnight-low over time (the most clinically interesting view)
- "Sleep context" sub-section if SpO2 calm-concerned: "Your overnight oxygen dipped below 90 on 4 of the last 14 nights. Worth mentioning at your next visit."
- The most aggressive defer-to-doctor copy of any vital. SpO2 is closest to a clinical signal.

### 8.5 Sleep Detail

Specific elements:
- Hero shows last night's total + sleep score
- Stage chart: horizontal bar showing light/deep/REM/awake distribution last night
- 14-day trend of total sleep + sleep score
- "BP context" sub-section: "On nights you slept 6h or less last week, your morning BP averaged 8 points higher than on full-sleep nights. These often go together."

This is the screen where the Apple-of-Healthcare correlation magic shows most clearly. Sleep × BP is the canonical insight.

### 8.6 Activity Detail

Specific elements:
- Hero shows today's steps + ring against target
- Calories sub-line
- 14-day step bar chart with target line
- Goal config inline: tap to adjust target_steps + target_kcal
- "BP context" sub-section: "On days you walk 7,500+ steps, your evening BP averages 5 points lower."

The only screen with "hit your goal" affordance — but framed as supportive, not gamified. No streaks, no badges, no level-up language (per D11 §3.3 forbidden vocabulary).

---

## §9. Cross-Vital Correlation Engine

This is the engine that delivers the *premium pulse intelligence* claim. It computes per-user correlations between vitals on a 30-day rolling window and exposes them to the AI and to the vital detail screens.

### 9.1 v1.0 correlations (the only three)

| Correlation | Domain | Description |
|---|---|---|
| **Sleep × Morning BP** | poor sleep → elevated morning BP | Strongest published correlation in the literature |
| **Activity × Resting HR** | more daily activity → lower resting HR | Visible within 1–2 weeks of lifestyle change |
| **SpO2 night-dip × Sleep score** | overnight SpO2 dips → poor sleep score | Sleep-disordered-breathing signal |

These three are explicitly named, tested, and surfaced in v1.0. Others are deferred to v1.1+ — *no generic correlation explorer* at v1.0. Restraint matters; surfacing weak correlations makes the app feel like a stats engine, not a pulse.

### 9.2 Computation

Runs as an Edge Function `compute-correlations`, scheduled nightly per family at 03:00 family-local-time. Produces per-user `correlations` rows.

Schema:

```sql
create table public.correlations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  correlation_type text not null check (correlation_type in (
    'sleep_x_morning_bp',
    'activity_x_resting_hr',
    'spo2_dip_x_sleep_score'
  )),
  window_days int not null default 30,
  computed_at timestamptz not null default now(),
  -- the data
  pearson_r float,                       -- correlation coefficient
  effect_size float,                     -- e.g. mmHg per hour of sleep
  effect_unit text,                      -- 'mmHg/hour-sleep', etc
  significance float,                    -- p-value
  sample_n int,
  is_meaningful bool,                    -- |r| ≥ 0.3 AND sample_n ≥ 14 AND p < 0.05
  narrative_short text,                  -- "Poor sleep ↔ +8 mmHg morning systolic"
  narrative_long text                    -- the human-language paragraph
);
create index correlations_family_user on public.correlations (family_id, user_id, computed_at desc);
```

Only correlations with `is_meaningful = true` are surfaced to the user. This is the gate that keeps the app from saying "we found a correlation between your sleep and the moon phase."

### 9.3 Statistical rules

- Pearson r computed on 30-day window per user
- Minimum sample size: 14 paired observations (so we need at least 14 nights of sleep with morning BP, etc)
- Threshold for "meaningful": |r| ≥ 0.3 AND p < 0.05
- Significance test: two-tailed Pearson p-value
- Effect size translated to user-relatable units (mmHg per hour, bpm per 1000 steps, etc)

If correlations don't meet the threshold yet (e.g., user just started using the watch), the engine simply doesn't produce that correlation. Daily Pulse narration falls back to single-vital observations only.

### 9.4 Surfacing

- Daily Pulse AI narration consumes top 1 meaningful correlation if available (passed in `notable_correlations` per §7.3)
- Each vital detail screen shows ONE correlation involving that vital (if meaningful)
- Trends screen shows all meaningful correlations for the user
- Tier-C weekly summary draws on all meaningful correlations to build the narrative

### 9.5 Voice for correlation language

Correlations are described, never prescribed. Per D11 voice rules:

✓ *"On nights you slept under 6 hours, your morning BP averaged 8 points higher."*
✓ *"More daily activity correlates with lower resting heart rate over the last month."*
✗ *"Sleeping 7+ hours will lower your blood pressure."* (forbidden — promises outcome)
✗ *"You should walk more to reduce your risk."* (forbidden — prescriptive)
✗ *"This pattern indicates sleep apnea."* (forbidden — diagnostic)

---

## §10. Trends + Multi-Vital PDF (Sprint 9 rewritten)

D13 expands the Trends screen and the doctor PDF to multi-vital.

### 10.1 Trends screen

| Element | Spec |
|---|---|
| Header | "Trends" + range selector (7d / 30d / 90d / 1y) |
| Multi-vital chart | Stacked line chart, vitals selectable via toggle row above. Default: BP + HR + Sleep visible; SpO2 + Activity off |
| Correlation cards | Up to 3 meaningful correlations as full-width cards |
| Weekly summary card | Tier-C narrative when available |
| Export button | "Share with your doctor" → opens PDF preview |

### 10.2 Doctor PDF (rewritten)

The PDF is the primary self-buyer paywall lever per D8a §15 Q-D8a-2 (defaulted v1.0).

Structure:
1. **Cover** — name, date range, summary one-line
2. **BP report** — averages, trend chart, classification distribution (Normal / Elevated / Stage 1 / Stage 2 / Crisis), top 5 abnormal readings
3. **HR report** — resting HR trend, baseline, anomalies
4. **SpO2 report** — overnight low trend, days below 90%
5. **Sleep report** — total time trend, score distribution
6. **Activity report** — steps trend vs target
7. **Cross-vital observations** — meaningful correlations narrative
8. **Notes** — user-provided context

Layout: clinical but premium — typeface premium, spacing generous, tables clean. NOT a generic CSV dump. The PDF is itself a brand surface.

Voice on the PDF: more clinical than the app (intended audience is the doctor) but still respects forbidden-claim rules. No "diagnosis," no "treatment recommendation."

---

## §11. Anomaly Engine Extensions (Sprint 15 rewritten)

`docs/10-anomaly-logic.md` currently defines BP-only anomaly states. D13 expands to multi-vital.

### 11.1 Per-vital anomaly rules

| Vital | Calm-Concerned | Confirmed-Urgent |
|---|---|---|
| BP | Single Stage 1+ reading; OR 3-reading-trend pattern | 3 readings ≥ 180/120 in 60min; OR Crisis single reading |
| HR | resting > baseline + 15 bpm for 3 consecutive days; OR > 100 at rest sustained | < 40 OR > 130 sustained at rest |
| SpO2 | overnight_low 88–89 | overnight_low < 88 sustained 3+ nights |
| Sleep | None (sleep alone never anomalies) | Never |
| Activity | None | Never |

### 11.2 Most-severe-wins on Home banner

The Home anomaly banner shows ONE state at a time — the most severe across all vitals. Order: confirmed-urgent > calm-concerned > none.

### 11.3 Push notification routing

Per `docs/11-push-notifications.md` (to be expanded):

| Trigger | Push? | In-app banner? | Quiet hours respected? |
|---|---|---|---|
| BP calm-concerned (single) | No | Yes | n/a |
| BP calm-concerned (trend) | Yes | Yes | Yes |
| BP confirmed-urgent | Yes | Yes | No (override) |
| HR calm-concerned (3-day trend) | Yes | Yes | Yes |
| HR confirmed-urgent | Yes | Yes | No |
| SpO2 calm-concerned | Yes | Yes | Yes |
| SpO2 confirmed-urgent (3-night trend) | Yes | Yes | No |
| Sleep <60 score | No | No | n/a |

Voice on every push: per D11. Sentence-case, premium-precise, never escalating, never fear-based.

### 11.4 Anomaly false-positive rate

Tracked per category in PostHog. Target: ≤ 15% thumbs-down. Alert threshold > 25% week-over-week.

---

## §12. Apple Health / Health Connect Integration (Sprint 9.5)

### 12.1 Scope at v1.0

Two-way sync. Read selected vitals from platform; write Leiko vitals to platform.

### 12.2 iOS HealthKit identifiers (write)

| Leiko vital | HealthKit type |
|---|---|
| BP | `HKQuantityTypeIdentifierBloodPressureSystolic` + `HKQuantityTypeIdentifierBloodPressureDiastolic` (correlation type `bloodPressure`) |
| HR | `HKQuantityTypeIdentifierHeartRate` |
| SpO2 | `HKQuantityTypeIdentifierOxygenSaturation` |
| Sleep | `HKCategoryTypeIdentifierSleepAnalysis` (with stages — `inBedToAsleep`, `asleepCore` for light, `asleepDeep`, `asleepREM`, `awake`) |
| Steps | `HKQuantityTypeIdentifierStepCount` |
| Calories | `HKQuantityTypeIdentifierActiveEnergyBurned` |

### 12.3 iOS HealthKit identifiers (read)

| Source | HealthKit type |
|---|---|
| Weight | `HKQuantityTypeIdentifierBodyMass` (used in BMR/calorie calculation) |
| Height | `HKQuantityTypeIdentifierHeight` |
| Blood glucose | `HKQuantityTypeIdentifierBloodGlucose` (read-only, surfaced on Trends as a separate series — never integrated into Leiko's anomaly engine) |
| Medications | not on HealthKit at iOS 17+ in a structured way — defer to manual entry |

### 12.4 Android Health Connect

Mirrors iOS where supported. Health Connect's coverage is narrower; `BloodPressureRecord`, `HeartRateRecord`, `OxygenSaturationRecord`, `SleepSessionRecord`, `StepsRecord`, `ActiveCaloriesBurnedRecord` are all available in HC v1+.

### 12.5 Permission UX

- **Self-buyer:** asked at end of onboarding ("Connect to Apple Health to keep your numbers in one place") — opt-in, default off
- **Caregiver:** not asked (the parent's vitals do not go on the caregiver's Apple Health — different Apple ID, privacy boundary)
- **Parent (own phone):** asked on first home-screen render with same copy

Settings has master toggle: "Apple Health" / "Health Connect" → on/off + per-vital granular toggles.

### 12.6 What we don't do

- We don't sync Leiko data to Apple Health *for the caregiver's view of their parent's data.* The caregiver's Apple Health is their own personal store; Mum's BP is not on it.
- We don't read identity from HealthKit. The user identity stays in Supabase.
- We don't auto-overwrite. Leiko writes its own readings only; if the user has BP data from another source on HealthKit, both coexist as separate samples.

---

## §13. Privacy & Visibility Model

### 13.1 RLS (already in place)

Per `docs/01-data-model.md` §RLS — `vitals_other` follows the same family-scoped pattern as `readings`. Members read; service inserts. No D13 RLS changes.

### 13.2 Self-buyer/hybrid privacy boundary

Per D8a §7.3 — `reading_notes.visibility` field allows self-buyer to keep notes private even after inviting caregivers. D13 extends this principle to vitals **only via opt-out**, not by default.

In hybrid mode (self-buyer who later invites caregivers), the self-buyer can opt to hide specific vital streams from caregivers. Settings → Family → "What [Caregiver name] sees":

- BP — always visible (it's the primary use case)
- HR — visible by default, can hide
- SpO2 — visible by default, can hide
- Sleep — **hidden by default** — sleep is private; opt-in to share
- Activity — visible by default, can hide

The default — *sleep is hidden* — is a deliberate dignity choice. Sharing sleep data with a family member feels intimate; we ship with the more conservative default.

### 13.3 PHI scrubbing for AI calls

Per `docs/13-testing-standard.md` PHI rules. Already in spec. D13 adds:

- Vital values are necessary for AI narration → not stripped
- Per-sample timestamps are quantised to the day (not sample-second) before egress
- No device serial, MAC, or sensor-confidence fields in AI payload

D14 specifies the full prompt scrubbing.

### 13.4 Analytics (PostHog)

Per CLAUDE.md: reading values NEVER appear in analytics events. D13 extends:

| Event | Properties allowed |
|---|---|
| `vital_synced` | `vital_type`, `count`, `device_id_hash` (NOT actual values) |
| `vital_classified` | `vital_type`, `state` (in-pattern/calm-concerned/etc — NOT the value) |
| `correlation_computed` | `correlation_type`, `is_meaningful`, `sample_n` (NOT the values or coefficient) |

Hash device_id with HMAC + a server-side secret to prevent re-identification.

---

## §14. Sprint Scope (the new sprints D13 funds)

### 14.1 Sprint 7.5 — Multi-Vitals Ingest Plumbing

**Goal:** All 5 additional vital streams flow from watch → Edge Function → database. No UI surface.

Deliverables:
- 10 new BLE wrappers (§3.1)
- Notify routing fix for all sub-events (§3.2)
- Sequenced sync on reconnect (§3.3)
- Per-vital sync cursors (§3.4)
- New state slices: hr.ts, spo2.ts, sleep.ts, activity.ts, dailyPulse.ts (§5.3)
- `MultiVitalsPayload` type + `/sync` Edge Function expansion (§4.2–4.4)
- Server-side validations (§4.4)
- Classification utilities for HR, SpO2, Sleep, Activity in `apps/mobile/src/utils/classification.ts` (§6.2–6.5)
- BLE mock layer extended to emit synthetic HR/SpO2/sleep/activity samples for tests
- Unit tests for every wrapper, every classifier, every sync path

**Acceptance:**
- Synthetic HR samples flow watch → /sync → vitals_other in dev
- Synthetic sleep session flows the same path
- All classifiers covered by unit tests (≥ 90% coverage)
- BP path remains green (no regression)

Duration estimate: ~2 weeks elapsed.

### 14.2 Sprint 7.6 — Daily Pulse + Vital Tile Component Primitives

**Goal:** Build the D12 component library for the constellation surface. No screens consume yet.

Deliverables:
- `VitalRing.tsx` per D12 §11.2.1
- `VitalTile.tsx` per D12 §11.2.2
- `DailyPulseHero.tsx` per D12 §11.2.3
- `AmbientPulse.tsx` per D12 §11.2.4
- `CorrelationStrip.tsx` per D12 §11.2.5
- `AnomalyBanner.tsx` rewrite per D12 §11.2.6
- Component gallery (`src/dev/ComponentGallery.tsx` — already exists, extended)
- Unit + component tests for all six
- Reduced-motion behaviour verified

**Acceptance:**
- All six render in both modes (dark + light)
- Daily-pulse-reveal animation fires correctly on first paint
- Live-pulse animation runs UI-thread-only (no JS-thread frame work)
- Reduced motion verified
- Storybook-equivalent gallery shows every state of every component

Duration estimate: ~1.5–2 weeks elapsed.

### 14.3 Existing sprints rewritten by D13

- **Sprint 8** — Self-Buyer Home now consumes DailyPulseHero + vital tile strip + AI narration
- **Sprint 7-redux** — Caregiver Home rewritten to use Daily Pulse cards per parent
- **Sprint 8.5 (NEW)** — Per-vital detail screens (HR · SpO2 · Sleep · Activity)
- **Sprint 9** — Trends + multi-vital PDF
- **Sprint 9.5 (NEW)** — Apple Health + Health Connect integration
- **Sprint 11** — AI Tier-A intent router with multi-vital intents
- **Sprint 12** — AI Tier-B with multi-vital prompt scope (D14 specifies)
- **Sprint 12.5 (NEW)** — Ambient AI surfaces (D14 specifies)
- **Sprint 13–14** — Learn cards expanded for HR, SpO2, sleep, activity, correlations
- **Sprint 15** — Anomaly engine across all 5 vitals (§11)

---

## §15. Open Items & Validation Checklist

### 15.1 Founder validation required before Sprint 7.5 begins

- [ ] Approve schema for `vitals_other` `value_jsonb` shapes (§2.2–2.6)
- [ ] Approve classification thresholds (§6.2–6.5)
- [ ] Approve correlation engine scope — exactly the three correlations in §9.1, no others at v1.0
- [ ] Approve Daily Pulse adaptive central value priority (§7.2)
- [ ] Approve sleep-hidden-by-default privacy choice (§13.2)
- [ ] Approve Apple Health / Health Connect at v1.0 with the scope in §12

### 15.2 Open for D14 to resolve

- AI prompt template for daily readiness narration
- Tier routing for narration (Tier-A template vs Tier-B generated)
- AI prompt for correlation narrative_long generation
- Tier-C weekly summary structure

### 15.3 Open for downstream `docs/` PR

- `docs/01-data-model.md` — incorporate `correlations` table schema (§9.2)
- `docs/06-ble-protocol.md` — already names all 14 commands; D13 does not change protocol but commits to wrappers
- `docs/10-anomaly-logic.md` — incorporate per-vital anomaly rules (§11.1)
- `docs/11-push-notifications.md` — incorporate routing table (§11.3)
- New: `docs/04-screens/daily-pulse-immersive.md`, `vital-detail-hr.md`, `vital-detail-spo2.md`, `vital-detail-sleep.md`, `vital-detail-activity.md`, `trends.md` (rewrite)
- New: `docs/15-correlation-engine.md` documenting the engine
- New: `docs/16-health-platform-integration.md` documenting HealthKit + Health Connect

### 15.4 Open technical questions tracked

| # | Question | Default if unanswered |
|---|---|---|
| Q-D13-1 | What's the user-set default `target_steps`? Default 6000 vs typical 10,000? | 6000 — appropriate for hypertensive adults including elders |
| Q-D13-2 | Should HR samples roll up to hourly bins server-side to manage row count? | Yes — keep raw samples in MMKV for 7 days, write hourly aggregates to `vitals_other` |
| Q-D13-3 | Sleep score weighting — exact formula adjustable? | Use the formula in §6.4; reweight after 90 days of production data if needed |
| Q-D13-4 | Cross-vital correlation min sample size — 14 too aggressive? | 14 is the floor; first meaningful correlations appear ~2 weeks after activation |

---

## §16. Sign-Off

This document represents the locked multi-vitals product surface for Leiko v1.0. Once founder signs off, Sprint 7.5 (multi-vitals plumbing) becomes buildable in parallel with D14 drafting.

| Role | Name | Sign-off |
|---|---|---|
| Founder / Product Owner | Law (LawOne Cloud LLC) | Pending |
| Engineering | Implements against this contract | Implementation gate: Sprint 7.5 |

---

*End of D13 — Multi-Vitals Constellation Spec v1.0.*

*Next document: D14 — Ambient AI Architecture. Begins on D13 founder sign-off.*
