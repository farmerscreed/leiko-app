# ADR-0008: Vitals data correctness — identity keys, wearer-timezone rendering, no fabricated values

- **Status**: Accepted (founder sign-off 2026-06-03, decision-by-decision during the session; all built, applied to prod, and physically testable)
- **Date**: 2026-06-03
- **Sprint**: ad-hoc founder-directed audit (`plans/vitals-data-completeness.md` is the working card with the full verified findings)
- **Amends**: `docs/01-data-model.md` (readings_dedupe key; measured_at_local; sleep_session measured_at semantics), `docs/_reference/D13` §2.4 (sleep measured_at = start → superseded)
- **Touches**: migrations 0030–0034, `sync` + `generate-doctor-pdf` edge functions, every VitalDetail screen, `utils/vitalAggregators.ts`, `state/sleep.ts`, `components/BottomSheet.tsx`

## Context

A founder-directed audit (2026-06-03) compared what is **in the database**
against what each vitals screen **renders**, on the principle that a health
app must never project wrong data — *"rather take it off than have the data
wrong."* The audit found five independent correctness failures, each
verified against leiko-prod before fixing:

1. **BP duplicates (51 of 148 rows, ~34%).** Dedup was keyed on
   `(device_id, measured_at)`; pairing a second watch (U16H, 2026-06-02)
   minted a new device row and the phone re-synced the whole history under
   the new id. Every aggregate (avg/peak/low/baseline/chart/PDF) was
   double-weighted.
2. **Times rendered in the device timezone, not the wearer's.** Every
   screen formatted timestamps with `toLocaleTimeString()/getHours()/
   toDateString()` (device tz), and the caregiver-path aggregators bucketed
   "today"/"night" in UTC — despite Settings promising *"Your timezone
   controls when 'today' starts."* Storage was always correct UTC; the bug
   was render/compute-side only.
3. **Sleep fabricated its times and fragmented its nights.** The watch's
   0x07 reply carries only duration; the client synthesized
   `end = 08:00 UTC, start = end − total` and displayed those as real
   times. Because `measured_at = start` was the dedup key and the start
   drifts with the total, one night became up to 5 rows (84/72/68/50/46
   min) — and the "last night" pickers could surface the SHORTEST fragment.
4. **The doctor PDF silently truncated.** Its queries had no `.limit()`;
   PostgREST caps un-limited queries at `max_rows = 1000` — HR crosses that
   in ~3.5 days, so every report's HR section was computed from an
   arbitrary, UNORDERED ~1000-sample subset (prod: 5,266 HR rows in 30d).
5. **HR range pills all showed the same ~16h** (local slice capped at 200
   samples), and `readings.measured_at_local` stored the UTC instant under
   a "local" name.

## Decisions

### D1 — A reading's identity is the measurement, not the reporting device
`readings_dedupe` is now unique on `(family_id, measured_at)` (migration
0031; sync upserts re-keyed). Verified safe: no (family, instant) ever held
two different value sets — a person takes one BP reading at a time. The 51
prod duplicates were deleted (keep earliest), guarded transactionally.
`vitals_other` is deliberately NOT given the same key: two watches sampling
HR concurrently produce real, distinct values at the same instant (verified:
33 cross-device collisions in one overnight test window).

### D2 — Sleep is keyed by its night, and its times are never fabricated
- `sleep_session.measured_at` = the session **END** (migration 0032 +
  re-mapped sync) — the constant per-night identity; re-reads collide and
  reconcile one row. **Supersedes D13 §2.4** ("measured_at = start").
  Within-batch fragments collapse to the fullest; a no-shrink guard stops a
  shorter re-read from understating a stored night. Real start/end epochs
  remain in `value_jsonb.session_{start,end}_local` (the `_local` key name
  is historical; the values are correct epoch instants).
- Display rule: bed/wake times appear ONLY when HR-inferred (the
  morning-surge signal, `wakeSource === 'hr_inferred'`), framed as an
  estimate ("~11:14 pm → ~8:00 am", "est. from heart rate"). Otherwise the
  app shows duration only ("Last night · 7:30 slept") — no clock, ever.
  The synthesized 08:00/07:00 is a storage key, never a displayed time.
- The "last night" pickers (`computeSleepLastNight`, `state/sleep.ts
  lastNightSession`) consolidate per wake-date and return the FULLEST
  session — overlapping fragments share a wake, so the longest is the
  superset; summing would double-count.

### D3 — All time rendering and day/night bucketing uses the wearer's tz
The wearer = the family owner whose body produced the readings. Self path:
the signed-in user's `users.timezone`; caregiver path: the owner's tz
(fetched via `family_members → users(timezone)`, allowed by the existing
same-family RLS); UTC as last resort. Applied to: every VitalDetail
formatter (times, part-of-day, "today" filters, chart buckets, sleep×BP
correlation), `utils/vitalAggregators.ts` (today/night windows — the
self-path slices were already tz-aware), and the doctor PDF's day
bucketing. The shared helpers live in `utils/timeInZone.ts`.

### D4 — Dense vitals aggregate in SQL; nothing trusts implicit row caps
- `hr_range_summary` RPC (0030): HRDetail's 7d/30d/90d analytics (zones,
  per-night resting, per-day trend) — exact over the full window,
  RLS-gated via `can_see_vital`.
- `doctor_report_vitals_summary` RPC (0034, service-role only): the PDF's
  HR/SpO2 sections — exact totals, per-day median/avg/min, nadir,
  desaturation events, day-bucketed in the wearer's tz.
- Everything else the PDF reads (BP, sleep, activity, notes) drains
  through `fetchAll()` pagination with a deterministic ORDER BY.
  **Rule: any query whose result feeds a user-facing number must either
  aggregate in SQL or paginate explicitly — never rely on PostgREST's
  silent `max_rows`.**

### D5 — Wrong-by-name data is removed, not tolerated
`readings.measured_at_local` (UTC mislabeled as local; unread by any code)
is NULL — existing values nulled (0033), sync writes NULL. The column stays
for a future properly tz-wired implementation.

## Consequences

- Prod data state after the migrations: readings 148→97 (dedup), sleep
  16→12 (fragments collapsed, end-keyed), `measured_at_local` 97→0
  non-null. Derived tables (`bp_baselines` etc.) were empty — no stale
  recompute needed.
- A future re-pair / second watch can no longer duplicate BP history or
  fragment sleep — verified by the new unique key + night key + guards.
- HR's *recent-readings list* still reads the capped local slice; the
  range *analytics* are exact. Full per-range browsing is the follow-up
  **VitalHistory screen** (founder-approved; see
  `plans/vitals-data-completeness.md`).
- Known pre-existing gap: 2 `resolve-routing.test.ts` deno tests fail on a
  mock-fidelity issue (verified present before this work).
- Related fix shipped alongside: `BottomSheet` unmounts on cancelled
  dismissals (an invisible mounted Modal was eating all touches —
  "the back button sometimes doesn't work" on Settings).

## Amendment (2026-06-05, physical testing)

**D6 — Scores derive from data, never from placeholders.** Stage-3 device
testing caught a sixth instance of the same failure class: ingestion
stamped `sleepScore: 0` ("computed by classifier downstream") but the
D13 §6.4 classifier was never wired into the pipeline, so the hero copy
("a more restless night than your usual"), hero ring, the sleep×BP
correlation series, and both home tiles judged every night from a
constant zero. Fix (commit 02ec8bb): display consumers recompute via
`classification.sleepScoreForSession(session)` from the real session
fields (correct for historical rows too); ingestion now stores the
computed score. Note: the efficiency + continuity components are constant
(+30) under the synthesized in-bed window / absent awake data — variance
comes from measured duration + deep ratio, so cross-night comparisons
hold. General rule going forward: **a value that drives user-facing
judgment must be computed from measured data at the point of use, or not
shown — placeholder fields are not display inputs.**

**2026-06-05 (later):** the Trends screen was found violating D3 + D4 the
same way the PDF had (raw-row fetch silently capped at max_rows=1000 — the
combined query let dense HR rows starve sleep/activity out entirely — and
UTC day bucketing). Fixed by the `trends_summary` RPC (migration 0035) +
client mapper; the narrative ("The Letter") now derives from exact data.
A focal-vital switcher also landed so every vital gets a range trend
(founder-approved A+B+C package).

Physical-testing outcomes for this ADR are recorded in
`plans/PHYSICAL_TEST_PLAN_2026-06-03.md` (stages 1, 3–7 passed on device,
2026-06-05). The report-delivery rework found in Stage 6 has its own
record: **ADR-0009**.

## Verification

Every claim above was verified against leiko-prod via SQL before and after
each change (counts, spans, collision sets), with guarded transactional
migrations (rollback on unexpected row counts). App: tsc 0 / jest 204
suites, 2441 tests / eslint 0. Edge: `deno check` clean, 192 tests pass.
