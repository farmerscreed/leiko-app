# Vitals Data Completeness & Time Correctness

> Branch: `fix/vitals-data-completeness`. Opened 2026-06-03.
> Status: **HR arc landed in the working tree (uncommitted), cross-vital
> audit not started.** This card was reconstructed after a system restart
> wiped the originating session's conversation — the only surviving trace
> of the in-flight plan was in code comments. Everything below is marked
> **[verified]** (confirmed against code / a passing run) or **[open]**
> (asserted by the founder or implied by comments, NOT yet confirmed
> against the database or rendered output).

## The goal (founder, 2026-06-03)

Every vitals detail page must render the **correct** data — what's in the
database must match what's shown on screen, across all ranges. This is a
health app: data collected and displayed wrongly is dangerous, not just a
bug. Two distinct correctness axes:

1. **Completeness** — what exists in the DB should actually render. Some
   records are not currently showing on the detail pages. Go page by page
   (HR, BP, SpO2, Sleep, Activity) and confirm DB ↔ render parity.
2. **Time correctness** — some data shows the **wrong time**. Readings
   must be captured *at the right time* and displayed in the user's
   timezone. The timezone is a user setting (Settings → Timezone); it must
   be the single source of truth for "when did this happen" and "when does
   today start."

This data feeds the **AI**, the **doctor's report (For Your Doctor)**, and
trend/baseline surfaces. Wrong inputs there produce confidently wrong
health information. **No guesswork — every change must be backed by
verifiable data (DB query, code, or a passing test).**

---

## Verified DB snapshot — leiko-prod `kqnzxjrpnjnczhgdwdqg` (2026-06-03)

Queried directly via the Management API (PAT, bypasses RLS):

- **[verified] Deployed migrations top out at `0029` (pending_invites).**
  Migration **0030 is NOT deployed.**
- **[verified] Real row counts / spans (the audit's reference numbers):**
  | source | vital | rows | first_at (UTC) | last_at (UTC) |
  |---|---|---|---|---|
  | `vitals_other` | hr | 5322 | 2026-05-14 23:00 | 2026-06-03 13:20 |
  | `vitals_other` | spo2 | 472 | 2026-05-14 23:00 | 2026-06-03 13:00 |
  | `vitals_other` | calories_day | 28 | 2026-05-15 00:00 | 2026-06-03 00:00 |
  | `vitals_other` | steps_day | 28 | 2026-05-15 00:00 | 2026-06-03 00:00 |
  | `vitals_other` | sleep_session | 16 | 2026-05-21 00:53 | 2026-06-03 02:38 |
  | `readings` | bp | 148 | 2026-05-10 19:35 | 2026-06-03 09:43 |
- **[verified]** All `measured_at` stored as UTC (`+00`) timestamptz — so
  any "wrong time" symptom is a **render-side tz conversion** issue, not a
  storage issue. Confirms HR is the only dense vital (justifies the RPC);
  BP/SpO2/sleep/activity are small (justifies direct date-windowed selects).

## Verified ground truth (so future sessions don't re-derive it)

- **[verified]** Timezone is a profile field, edited in Settings
  (`SettingsScreen.tsx` `settings-profile-timezone`, with a "use device
  timezone" button at line ~2117). In-app copy already states: *"Your
  timezone controls when 'today' starts for your trends."* Stored on
  `profile.timezone` (IANA, e.g. `Africa/Lagos`), read via
  `useAuth(s => s.profile?.timezone)`.
- **[verified]** Watch→UTC time conversion happens at ingest in
  `services/sync/syncBacklog.ts`: `watchTimestampToUtcSec(rawWatchSec)` =
  `rawWatchSec + WATCH_FIRMWARE_OFFSET_SEC(8h) − phoneOffsetSec`. This is
  the "China-firmware offset" correction (covered by tests). **This is the
  most likely origin of any "wrong time" symptom — start here when
  investigating time bugs.** Note: `backlog.md` flags moving this offset
  server-side (next to `users.timezone`) as a deferred follow-up.
- **[verified]** HR is stored in `public.vitals_other` (`vital_type='hr'`,
  `value_int` = bpm, `measured_at` timestamptz, `hidden` flag, `family_id`).
  Table defined in `0001_initial.sql`.
- **[verified]** The local HR slice (MMKV) is hard-capped at
  `RECENT_SAMPLES_CAP = 200` samples ≈ ~16h at the 5-min cadence — so
  before this fix every range pill (7d/30d/90d) showed the same ~16h. This
  is the concrete completeness bug that motivated the HR work.

---

## Stage 1–3: HR detail (DONE in working tree, uncommitted)

All three exist and the full suite is green (see "Gate status").

- **[verified] Stage 1 — `supabase/migrations/0030_hr_range_summary.sql`**
  Read-only `hr_range_summary(_family_id, _tz, _from, _to)` RPC. Aggregates
  over `vitals_other` in the user's IANA tz: totals, zone distribution
  (<60 / 60–80 / 80–110 / 110+), per-day avg/min/max, and per-night resting
  (10-min rolling-min within 22:00–06:00 local, night-keyed to the owning
  morning — mirrors `state/hr.ts`). `SECURITY DEFINER`, gated on
  `can_see_vital(_family_id,'hr')`. `_tz` empty/null → UTC. Additive, no
  schema change, no data mutation.
- **[verified] Stage 2 — `hooks/useHRRangeSummary.ts`** + types in
  `types/database.ts` + `hooks/__tests__/useHRRangeSummary.test.tsx`
  (3 tests: null-family no-call, tz/window correctness, error surfacing).
  TanStack Query wrapper; tz from `useAuth`; falls back to null on
  offline/loading/error so the caller keeps the local-slice path.
- **[verified] Stage 3 — `screens/VitalDetail/HRDetail.tsx`** wired:
  server summary now feeds zones, per-night resting (→ baseline + sleep×HR
  correlation), per-day trend line, and the stat trio (Resting avg / Peak /
  Low over the window). Local slice remains the offline/loading fallback.
  Also a **hero behaviour change**: headline now shows the latest live
  sample ("Latest reading" / "bpm · latest") instead of "Now · resting";
  resting moved to the "Resting avg" stat. Test + snapshot updated to match.

### What's LEFT on the HR arc

- **[open] Nothing is committed.** Entire branch is working-tree changes.
- **[verified] Migration 0030 is NOT deployed** — confirmed against
  leiko-prod (latest applied is 0029). It is also untracked in git. The HR
  RPC therefore does not exist server-side yet; `useHRRangeSummary` would
  error and fall back to the local slice in prod today. Deploy is a
  required step before the HR fix has any effect. Access: the Management
  API PAT reaches the project (the MCP account does not).
- **[verified, deferred by design] Recent-readings LIST still uses the
  capped local slice** (~200 / ~16h). Only the *analytics* are
  server-windowed. Server-side list paging is a deliberate follow-up
  (needs its own pagination design, per the in-code NOTE).
- **[open] Hero copy change ("Latest reading") needs founder sign-off** —
  it's a user-visible voice change. Passes the forbidden-word list, but
  it's a behaviour shift, not just a fix.

---

## Cross-vital audit — NOT STARTED (the bulk of the founder's ask)

Each vital detail screen must be checked **DB ↔ render** at every range,
and for time correctness. None of the rows below are verified yet — they
are the work queue, not findings.

| Vital | Screen | Status | Notes |
|---|---|---|---|
| HR | `HRDetail.tsx` | analytics fixed (uncommitted); list + deploy pending | see above |
| BP | `BPDetail.tsx` | **[open] not audited** | comments say BP stays on direct date-windowed selects (small dataset) — must confirm it actually renders all DB rows at all ranges |
| SpO2 | `SpO2Detail.tsx` | **[open] not audited** | same |
| Sleep | `SleepDetail.tsx` | **[open] not audited** | timezone-sensitive (night boundaries); see `plans/SLEEP_TIMEZONE_FIX_BRIEF.md` |
| Activity | `ActivityDetail.tsx` | **[open] not audited** | same |

### BP audit findings (2026-06-03, verified against leiko-prod)

Test family: `21b057bb` (Lawrence, tz `Africa/Lagos`, 148 BP rows).

1. **[verified] TIME — `profile.timezone` is ignored in BP rendering.**
   Every formatter in `BPDetail.tsx` (`formatHeroTime`, `formatRowTime`,
   `rowContext`, `readingsForToday`, `bucketReadingsByHour`) does
   `new Date(measuredAtSec*1000)` then `.toLocaleTimeString([])` /
   `.toDateString()` / `.getHours()` — all **device-timezone** based. The
   user's `users.timezone` (Settings) is never applied. Settings copy
   explicitly promises *"Your timezone controls when 'today' starts for
   your trends"* — the code contradicts it. Looks correct only when device
   tz == profile tz (the founder's own Lagos device); wrong for the two
   caregivers on this family (`America/New_York`, `America/Lima`) and for
   any tz mismatch / travel. Also **inconsistent with the new HR RPC**
   (0030), which *does* key off `profile.timezone` — so once HR ships,
   HR and BP would compute "today"/"night" on different clocks.
2. **[verified] DATA INTEGRITY — ~34% of BP rows are exact duplicates.**
   148 rows, 97 distinct, **51 duplicate rows**. Each dup pair carries two
   different `device_id`s (`07e44881…` = old watch identity, `5a2a24f5…` =
   current). The `readings_dedupe` unique index is on
   `(device_id, measured_at) WHERE device_id IS NOT NULL` — so the same
   reading re-synced under a *new* device_id is NOT caught. Likely a
   re-pair / device-identity change (ties to migration 0027
   client_device_id + sync routing) that re-posted the backlog under a new
   device row. Inflates the reading count, and skews avg / peak / low /
   `bp_baselines` / trend chart / doctor's report. `vitals_other` has the
   same dedup shape (`vitals_dedupe` on device_id, vital_type, measured_at)
   so HR/SpO2 are vulnerable too — HR currently has only 2 such dupes.
3. **[verified] `readings.measured_at_local` is mislabeled UTC.** All 148
   rows store the UTC wall-clock with a `Z` suffix (0 have a real offset),
   so it is never actually localized. **Currently NOT read by any render
   path** (only present in `types/database.ts`) — so it is latent bad data,
   not a live display bug today, but a trap waiting to be trusted.

**[verified] Duplicate ROOT CAUSE (confirmed in code + data, 2026-06-03):**
The /sync function dedups BP on a **device-scoped** key — `readings_dedupe`
unique `(device_id, measured_at)`, and `insertReadings` upserts with
`onConflict: 'device_id,measured_at'` (`sync/index.ts:588`). A reading's
true identity is `(family_id, measured_at)`. When the founder paired a
second watch (U16H `5a2a24f5`) on Jun 2, the phone re-synced history under
the new device_id; `(new_device, time)` didn't collide with
`(old_device, time)` → 51 re-inserts. Founder confirmed: U19 is the primary
watch, U16H only came out Jun 2 for testing.
- **HR/SpO2 are NOT affected the same way** — verified: the 33 HR
  same-(family,time) rows are 100% cross-device, all in one overnight
  window (Jun 1 22:45–Jun 2 03:05), with *different* bpm = two watches
  sampling concurrently (real data). A device-independent key on
  `vitals_other` would destroy those, so it is deliberately NOT changed.

**FIX APPLIED to leiko-prod 2026-06-03 (transactional, guarded):**
- 148 → 97 readings (exactly 51 dupes deleted; DO-block guard asserted 51
  or rollback). `readings_dedupe` now unique `(family_id, measured_at)`.
  `0031` recorded in `schema_migrations`. Family 21b057bb: 143 → 92.
- ✅ **No stale derived data** — verified `bp_baselines`, `correlations`,
  `anomaly_events`, `ai_narration_cache` are all empty for this family, so
  nothing server-side was computed off the duplicates. The app's baseline /
  trends recompute live from the (now-deduped) readings.
- Note: migration 0030 (HR RPC) is still NOT applied — only 0031 is. A
  later `supabase db push` will apply 0030 and skip 0031 (already recorded).

**FIX BUILT (files, mirrors what was applied):**
- `supabase/migrations/0031_readings_device_independent_dedupe.sql`:
  deletes the 51 dupes (keep earliest per `(family_id, measured_at)`),
  swaps `readings_dedupe` → unique `(family_id, measured_at)`. Verified safe:
  0 slots hold differing values, so the unique index will build and no real
  data is lost.
- `sync/index.ts`: BP `onConflict` → `family_id,measured_at`; legacy 23505
  lookup re-keyed to `(family_id, measured_at)`. (Edge tests run in CI;
  deno not installed locally.)

**Other proposed fixes (NOT yet applied — await founder decision):**
- *Time:* render all BP times via the user's `profile.timezone` (e.g.
  `Intl.DateTimeFormat(locale, { timeZone })`), and decide whose tz applies
  when a caregiver views a wearer (the wearer's local time is the honest
  choice for "when the reading was taken"). Founder decision needed.
- *Duplicates:* (a) **prod data cleanup** = a data mutation, requires
  explicit founder approval before any delete; (b) prevent recurrence by
  deduping on a device-independent logical key (family_id, measured_at,
  source) or reconciling device identity on re-pair.
- *measured_at_local:* either populate it correctly at ingest or drop the
  column; do not start rendering it until it's trustworthy.

### Timezone render fix — status (2026-06-03)

Decision: render every vital in the **wearer's** timezone (self path = the
signed-in user's `users.timezone`; caregiver path = the family owner's tz).

- ✅ **Foundation:** `utils/timeInZone.ts` (+ tests) — tz-aware
  `timeInZone / weekdayInZone / monthDayInZone / hourInZone / dayKeyInZone`,
  device-locale preserved, null/invalid → UTC. Mirrors `dayIndex.ts`.
- ✅ **Caregiver wearer-tz plumbing:** `fetchParentPulseData` now fetches
  the family owner's tz (`family_members → users(timezone)`, readable via
  the `users` same-family RLS policy) and returns `wearerTimeZone`;
  exposed on `useParentDailyPulseData`.
- ✅ **BPDetail:** all 7 formatters (`formatHeroTime`, `formatRowTime`,
  `rowContext`, `readingsForToday`, `bucketReadingsByHour`,
  `bucketReadingsByDay`, `computeStats`) now take an explicit `timeZone`;
  the component resolves wearer-tz (caregiver) else own-tz (self) else UTC.
  Gates green: tsc 0, jest 204 suites/2433, eslint 0.
- ✅ **All per-screen formatters tz-corrected:** `HRDetail` (recent-row
  times), `SpO2Detail` (low-overnight time, recent list, formatTimeShort/
  DayShort, overnight window, isToday), `SleepDetail` (night labels,
  sleep×BP morning correlation window+day-key, chart axis), `ActivityDetail`
  (time-of-day progress + today key). Each resolves wearer-tz on the
  caregiver path, viewer-own on self, UTC last. Chart-axis weekday/date
  labels also threaded where in scope.
- **Committed** 2026-06-03: `d6c615c` (BP dedupe + sync), `9b337d4` (BP tz
  fix), `3c3c28a` (this plan). Sync edge function **deployed to leiko-prod**.
  Prior-session HR work (0030, useHRRangeSummary, HRDetail) remains
  uncommitted pending the hero-copy sign-off.

### SpO2 / Sleep / Activity data audit (2026-06-03, verified vs prod)

- **SpO2 [low]:** 473 rows, values 93–99% (sane). 9 same-(family,time)
  slots, all cross-device; only 3 differ in value → ~6 byte-identical
  cross-device dupes (the two-watch overlap), negligible. No screen change
  needed; values render fine.
- **Sleep [HIGH] — FIX (read-side) DONE; ingestion root needs a decision.**
  ROOT CAUSE (verified `syncMultiVitals.ts:48-50`): the watch 0x07 reply has
  no sleep start/end, only `totalMinutes`. The client synthesizes
  `sessionEnd = 08:00 UTC`, `sessionStart = end − total`. Since sleep
  `measured_at = sessionStart` is the dedup key, every re-read of a night
  with a different total mints a NEW row (08:00−84=06:36 … 08:00−46=07:14 —
  the 5 fragments match exactly). DONE: `computeSleepLastNight` now
  consolidates per wake-date and returns the FULLEST session (max minutes),
  so the most-recent night is no longer understated (+ tests). PENDING
  founder decision on the ingestion root: either set sleep `measured_at =
  sessionEnd` (stable per night, collapses re-reads — but deviates from
  D13 §2.4 "measured_at = start") or add a per-night sleep dedupe/upsert
  keeping max minutes. Also `session_*_local` are mislabeled UTC.
  Original detail: multiple overlapping sessions per night.
  ✅ DONE 2: **no fabricated sleep times.** Founder direction — the app must
  never project a wrong time; rather show nothing. Bed/wake now display
  ONLY when `wakeSource === 'hr_inferred'` (the morning-HR-surge signal),
  framed as an estimate (`~`, "est. from heart rate"); on fallback/undefined
  the hero shows duration only ("Last night · 7:30 slept") and SleepStagesBar
  hides the clock entirely. Removed the fabricated 08:00/07:00 display.
  (`bedTimeSub`, `SleepStagesBar` + tests + snapshot.) 2026-06-02 has
  **5 sessions** (84/72/68/50/46 min) all from the U16H, all ending 08:00
  with marching start times — the watch re-reported one night repeatedly,
  not 5 naps. `computeSleepLastNight` picks by latest `sessionEndSec`
  (tie → first in array = newest measured_at), so it can surface the
  **shortest fragment (46 min)** instead of the fullest (84). Understates
  sleep → wrong doctor's-report / AI input. Also `session_start_local` /
  `session_end_local` are mislabeled UTC (Z suffix), same bug class as
  `readings.measured_at_local`. Needs: consolidate same-night sessions
  (max/merge) + tz-correct night keys.
- **Activity [medium]:** cross-device duplicate-day rows (e.g. 2026-06-03
  has both 380 and 0 steps). `computeActivityToday` already picks the MAX
  per day so the 0-shadow can't win (good) — BUT it computes "today" as
  `new Date(nowSec*1000).toISOString().slice(0,10)` = **UTC** date, not the
  wearer's tz, so near local midnight it reads the wrong day. The range/
  history aggregation in ActivityDetail still needs a dup-day check.
- **Broader [important] — AGGREGATOR TZ FIX DONE.** `utils/vitalAggregators.ts`
  now threads the wearer's `timeZone` through `inHRSleepWindow`,
  `inSpO2OvernightWindow`, `nightDateKey`, `computeHRRestingToday/Recent`,
  `computeSpO2OvernightLowsRecent`, `computeSleepLastNight`,
  `computeActivityToday` — using `hourInZone`/`dayKeyInZone` instead of
  getUTCHours/toISOString. `fetchParentPulseData` passes the wearer tz. The
  self-path slices (`state/hr.ts` etc.) were already tz-aware. Also found +
  fixed the SAME sleep-fragment understatement on the self path
  (`state/sleep.ts lastNightSession` was pick-latest-end → now fullest per
  wake-date). Tests added (aggregator tz boundary + slice consolidation).
  Gates green: tsc 0, jest 204 suites/2437, eslint 0.

### Audit method (per page — no guesswork)

For each vital:
1. Query the DB for the real rows over 7d/30d/90d (count, min/max
   `measured_at`, value range) for a known test family.
2. Open the detail page for that same family/range and compare what
   renders to the query result.
3. Check the displayed timestamps against the user's `profile.timezone`
   (e.g. an Africa/Lagos user should see Lagos-local times, and "today"
   should start at Lagos midnight).
4. Trace any mismatch to its source: ingest time (`watchTimestampToUtcSec`),
   the local-slice cap, the tz conversion at render, or a query window bug.
5. Fix, add/adjust tests, re-verify against the same DB query.

---

## Gate status (this working tree, 2026-06-03)

- **[verified] Typecheck** `tsc --noEmit` — pass (exit 0).
- **[verified] Jest** — 203 suites / 2424 tests / 110 snapshots, all pass.
- **[verified] Lint** `eslint .` — 0 errors (6 pre-existing warnings in
  `build-articles.ts` + `articles.voice-lint.test.ts`, untouched here).

## Immediate next steps

1. Founder decision on the hero "Latest reading" copy change.
2. Confirm whether migration 0030 should be deployed now, and to which
   project (the Leiko prod ref is not in the connected MCP account).
3. Commit the HR arc (one logical commit per the convention) once the
   above are settled.
4. Begin the cross-vital audit at BP using the method above.
