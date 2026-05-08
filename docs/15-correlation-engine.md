# 15 — Cross-Vital Correlation Engine

CANONICAL for Sprint 9 (engine + Trends correlation cards) and downstream consumers (Daily Pulse narration, vital detail screens, Tier-C weekly summaries, doctor PDF). Sourced from D13 §9 + D11 §3.6 (voice). Schema reference: `supabase/migrations/0005_correlations.sql`.

---

## 1. What it is

A nightly per-family job that computes Pearson correlations between paired observations of two vitals over a rolling 30-day window, writes one row per `(family, user, correlation_type)` to `public.correlations`, and exposes them to the app via the standard family-scoped RLS policy.

The engine is the only writer. Clients only read.

---

## 2. The three correlations (v1.0)

Per D13 §9.1, only three correlations are computed and surfaced. Restraint is the design — surfacing weak or arbitrary correlations would make the app feel like a stats engine, not a pulse.

| `correlation_type` | Pair | Direction | Effect unit |
| --- | --- | --- | --- |
| `sleep_x_morning_bp` | total sleep minutes (last night) × morning systolic BP | shorter sleep → higher morning systolic | `mmHg / hour-sleep` |
| `activity_x_resting_hr` | daily total steps × resting HR | more activity → lower resting HR | `bpm / 1000-steps` |
| `spo2_dip_x_sleep_score` | overnight SpO2 minimum × sleep score | lower SpO2 dip → lower sleep score | `points / SpO2-percent` |

Anything beyond these three is deferred to v1.1+. There is **no generic correlation explorer**.

---

## 3. Statistical rules (D13 §9.3)

- Pearson r computed over the most recent 30 days of paired observations.
- Minimum sample size: **14** paired days.
- Significance test: **two-tailed Pearson p-value** derived from the t-statistic `t = r * sqrt((n-2) / (1 - r²))` against a Student's t distribution with `n - 2` degrees of freedom.
- Threshold for `is_meaningful = true`: **|r| >= 0.3 AND p < 0.05 AND sample_n >= 14**.
- Effect size is computed as the slope of the simple linear regression in user-relatable units (the `effect_unit` column names them).

If a correlation doesn't meet the threshold, the engine still writes the row (so we have audit history) but `is_meaningful = false`. Clients filter on `is_meaningful = true`. UI never shows below-threshold correlations.

---

## 4. Computation

Implementation: Edge Function `compute-correlations` (Deno) at `supabase/functions/compute-correlations/`.

### 4.1 Pairing rules per type

- **`sleep_x_morning_bp`**: paired (sleep total minutes for night ending day D, average systolic of all BP readings on day D between 06:00 and 12:00 local time). One pair per day where both are present.
- **`activity_x_resting_hr`**: paired (steps total for day D, resting HR for day D — derived from the HR slice's `restingBpmToday` aggregator equivalent on the server). One pair per day where both are present.
- **`spo2_dip_x_sleep_score`**: paired (minimum SpO2 percent during the night ending day D, sleep score for the session ending day D). One pair per night where both are present.

### 4.2 Pearson r + p-value

The engine ships its own pure-Deno implementation of:
- Pearson r (no library dependency).
- Two-tailed p-value via the regularised incomplete beta function (Student's t CDF). The implementation is small (~60 lines) and unit-tested against scipy.stats reference values for n in [14, 30] and r in [0.0, 0.9]; tolerance ±0.005.

No external statistics library is loaded — Deno Edge Functions have a small dependency surface and the math is self-contained.

### 4.3 Output narratives

The engine writes both `narrative_short` and `narrative_long` alongside the stats so clients don't re-derive copy. Templates per type:

- `sleep_x_morning_bp` (when meaningful):
  - `narrative_short`: *"Poor sleep ↔ +{effect} mmHg morning systolic"*
  - `narrative_long`: *"On nights you slept under 6 hours, your morning systolic averaged about {effect} points higher than on full-rest nights. Pattern based on the last {n} nights."*
- `activity_x_resting_hr` (when meaningful):
  - `narrative_short`: *"More daily steps ↔ −{effect} bpm resting HR"*
  - `narrative_long`: *"Days with more steps tracked alongside a lower resting heart rate over the last {n} days. About {effect} bpm lower per extra 1,000 steps."*
- `spo2_dip_x_sleep_score` (when meaningful):
  - `narrative_short`: *"Lower overnight SpO2 dips ↔ lower sleep score"*
  - `narrative_long`: *"On nights your SpO2 dipped further, your sleep score landed lower over the last {n} nights. The pattern doesn't tell us why; if it persists, it's worth raising with your doctor."*

When `is_meaningful = false`, both narrative columns are null; clients hide the card slot rather than show empty copy.

---

## 5. Voice

Per D11 §3.6 + D13 §9.5. Correlations are **described, never prescribed**.

| Allowed | Forbidden |
| --- | --- |
| *"On nights you slept under 6 hours, your morning BP averaged 8 points higher."* | *"Sleeping 7+ hours will lower your blood pressure."* (promises outcome) |
| *"More daily activity tracked alongside a lower resting heart rate."* | *"You should walk more to reduce your risk."* (prescriptive) |
| *"This pattern is worth raising with your doctor."* | *"This pattern indicates sleep apnea."* (diagnostic) |

The engine's narrative templates pre-pass the voice gate. Reviewers should still re-check on every template change.

---

## 6. Scheduling

### 6.1 Family-local-time fan-out

Per D13 §9.2, the job runs **nightly per family at 03:00 family-local-time**. Postgres `pg_cron` is UTC-only, so the schedule is:

1. A single `pg_cron` job runs `compute-correlations` at the top of every hour (UTC).
2. The function selects families whose `families.timezone` (IANA) resolves to a local hour of `03` at the current UTC clock time.
3. For each matching family, the function iterates each user-member of that family and writes one row per `correlation_type` (3 rows per user per run).

03:00 local time was picked so the engine runs after the user's last sleep session has been ingested for the day. Lagos (UTC+1) families compute at 02:00 UTC; US East families (UTC-5 / UTC-4 by DST) compute at 07:00–08:00 UTC. The hourly cron loop covers both transparently.

### 6.2 Cron entry

```sql
-- Schedules `compute-correlations` to run every hour on the hour (UTC).
-- Per-family fan-out is handled inside the function.
select cron.schedule(
  'compute-correlations-hourly',
  '0 * * * *',
  $$ select net.http_post(
       url := current_setting('app.compute_correlations_url'),
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);
```

The settings (`app.compute_correlations_url`, `app.service_role_key`) are configured per-environment so the same migration applies in dev, staging, and prod without env-specific edits to the cron entry.

### 6.3 Idempotency

The function writes a fresh row per run, identified by `computed_at`. Re-running the same hour does not damage data — clients always read the most recent `computed_at` per type. Pruning policy is a v1.1 follow-up.

---

## 7. Surfacing (where correlations show up)

| Surface | Behaviour |
| --- | --- |
| **Trends — correlation cards** | Up to 3 cards, one per type, where `is_meaningful = true`, sorted by `|pearson_r|` descending. See `docs/04-screens/trends.md`. |
| **Vital detail screens** | Each detail screen surfaces ONE correlation involving that vital (the meaningful one with the strongest `|r|`). Hidden if no meaningful correlation involving that vital exists. |
| **Daily Pulse AI narration** | The AI narration prompt receives `notable_correlations` per D13 §7.3 — top 1 meaningful correlation, in narrative form. Daily Pulse falls back to single-vital observations when none are meaningful. |
| **Tier-C weekly summary (Sprint 12.5)** | Generator consumes all meaningful correlations to compose the week's narrative. Until 12.5, the Trends card uses placeholder copy. |
| **Doctor PDF — Cross-vital observations** | Section 7 of the 7-section PDF (D13 §10.2). When at least one meaningful correlation exists, this section uses `narrative_long` text per type. When none are meaningful, the section reads *"No cross-vital patterns reached the meaningful threshold over the selected range."* |

---

## 8. PHI scrubbing

The engine writes `pearson_r` / `effect_size` / sample counts only — no raw vital values. Narrative templates substitute summary-level numbers (e.g., "8 points higher", "1,000 steps") that are statistically derived, not raw readings.

Analytics emitted by the cron run carry counts only:
- `correlation_computed` — `{ family_id, user_id, correlation_type, is_meaningful, sample_n }`
- `correlation_card_viewed` — `{ correlation_type, is_meaningful }`

Per CLAUDE.md data rule, no `pearson_r` value is ever sent to PostHog.

---

## 9. Future scope (NOT in v1.0)

Explicitly out of scope until justified:

- **Generic correlation explorer** — letting users pick any pair. Deferred to v1.1+.
- **Real-time recompute on every reading** — nightly is enough; correlations on a 30-day window don't move quickly. Deferred to v1.1+.
- **Correlations across users in the same family** — privacy boundary (per D13 §13.2) and arguable clinical value. Deferred indefinitely.
- **Causal claims** — the engine reports correlations, not causation. The voice rules ensure the UI doesn't drift into prescription.
- **Correlation history pruning** — the table grows ~3 rows per user per nightly run. Pruning policy lands in v1.1 once growth shape is known.

---

## 10. Acceptance criteria (Sprint 9)

- Schema migration `0005_correlations.sql` lands cleanly with RLS + service-role-write policy.
- Edge Function `compute-correlations` runs against the synthetic fixture (`supabase/seed/correlations-fixture.sql`):
  - Strong-correlation set produces `is_meaningful = true` for `sleep_x_morning_bp` with r ≤ -0.3 and p < 0.05.
  - Weak-correlation set produces no meaningful row (or `is_meaningful = false`).
- Pearson r + p-value implementation matches scipy.stats reference values within ±0.005 across the n in [14, 30] / r in [0.0, 0.9] grid.
- pg_cron entry scheduled at `0 * * * *` (UTC top of hour); function correctly fans out by `families.timezone`.
- Test against a Lagos parent (UTC+1) and a US-East caregiver (UTC-5) in the same family — both compute at 03:00 their local time, no cross-firing.
- Voice gate passes on all narrative templates.
