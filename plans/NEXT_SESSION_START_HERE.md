# Start here — vitals data correctness + timezone overhaul (2026-06-03)

Last touched: 2026-06-03. Branch `fix/vitals-data-completeness`
(forked from `claude/consolidated-build`; contains all its ~237 commits
plus this session's 16). Supersedes the 2026-06-02 ADR-0006/0007 handoff.

## 60-second context

This session was a founder-directed **data-correctness audit and fix**
across every vitals surface, driven by one rule: *a health app must never
project wrong data — rather show nothing than something wrong.* Every
finding was verified against leiko-prod SQL before fixing; every fix is
tested, committed, and **live in prod**. The full decision record is
**ADR-0008** (`docs/_adr/0008-vitals-data-correctness.md`); the working
card with all verified findings is `plans/vitals-data-completeness.md`.

## What was found and fixed (all live)

1. **BP duplicates** — 51 of 148 rows (~34%) were re-sync duplicates from
   pairing a second test watch. Root: dedup keyed on the device. Now
   device-independent `(family_id, measured_at)` (migration 0031 + sync).
   Prod deduped 148 → 97.
2. **Timezone** — every screen rendered times in the DEVICE tz and the
   caregiver aggregators bucketed today/night in UTC. Now everything
   renders/buckets in the **wearer's** tz (`utils/timeInZone.ts`;
   caregiver path fetches the owner's tz). Storage was always correct UTC.
3. **Sleep** — times were fabricated (synthesized 08:00 displayed as a
   real wake) and nights fragmented into up to 5 rows. Now: bed/wake show
   ONLY when HR-inferred (est. framing), else duration-only;
   `measured_at` = session END (constant night key, migration 0032,
   supersedes D13 §2.4); fullest-session consolidation + no-shrink guard.
   Prod 16 → 12 sleep rows.
4. **Doctor PDF silently truncated** — no `.limit()` + PostgREST
   `max_rows=1000` meant the HR section used ~1000 arbitrary unordered
   samples (of 5,266 in 30d). Now exact: SQL aggregation RPC
   (`doctor_report_vitals_summary`, 0034) + `fetchAll()` pagination +
   wearer-tz day bucketing.
5. **HR range pills** — all showed the same ~16h (200-sample slice cap).
   Analytics now server-windowed via `hr_range_summary` RPC (0030);
   hero is live-first ("Latest reading").
6. **`measured_at_local`** — UTC mislabeled as local, unread → nulled
   (0033), sync writes NULL.
7. **BottomSheet touch-eater** — cancelled dismiss animations left an
   invisible Modal eating all taps ("back button sometimes doesn't work"
   on Settings). Fixed + 3 regression tests.

## Prod state (leiko-prod `kqnzxjrpnjnczhgdwdqg`)

- **Migrations applied: 0029 → 0034** (all recorded in schema_migrations).
- **Edge functions deployed**: `sync` (device-independent BP dedup, sleep
  end-key + collapse + no-shrink, measured_at_local NULL),
  `generate-doctor-pdf` (exact full-window data).
- Data: readings 97 (92 in the main family), sleep 12 (one row per
  night), HR 5.3k+, SpO2 470+. No stale derived data (those tables were
  empty when the dedups ran).
- Access for sessions: `apps/mobile/.env.local` has the URL + anon key;
  the Supabase **Management API PAT** reaches this project (curl
  User-Agent needed; the MCP supabase tools are authed to a DIFFERENT
  account and can NOT reach leiko-prod).

## Gates (must stay green)

tsc 0 · jest 206 suites / 2455 tests · eslint 0 errors ·
`deno check` clean on changed functions · deno tests 192 pass
(**known pre-existing failure**: 2 tests in `sync/resolve-routing.test.ts`
— mock fidelity, present before this session; not a regression).

## In flight / next steps (priority order)

1. **VitalHistory screen — BUILT for BP/SpO2/Sleep/Activity** (commit on
   branch): "View all · N" (true server count) under each recent list →
   shared `screens/VitalHistory/` pages the FULL window (50/page infinite
   scroll, wearer-tz day sections, exact totals; `services/vitalHistory` +
   `hooks/useVitalHistory`). **Remaining: the HR per-day drill-down**
   (day list from `hr_range_summary.per_day` → tap a day → that day's
   samples) — designed, not built. Needs an on-device pass too.
2. **Physical testing** in progress on device `43230DLJH001YY` (debug
   build via `npx expo run:android`; metro-tethered). Release APK needs
   the founder's `LEIKO_RELEASE_*` keystore env (`npm run
   release:android:apk`). Test checklist: BP list deduped + Lagos-local
   times; HR pills differ per range; sleep duration-only unless inferred;
   fresh-reading sync adds exactly 1; caregiver sees wearer-tz times.
3. **Merge to `main`** remains the long-standing loose end (branch is
   ~250 commits ahead).
4. Pre-existing deferrals from the 2026-06-02 handoff still stand (old
   invite functions dormant; no store listing/join page;
   `account_type` column inert but present).

## Hard-won operational notes

- Prod mutations are applied via the Management API
  (`/v1/projects/{ref}/database/query`) inside guarded `DO $$` blocks that
  abort on unexpected row counts, then recorded in
  `supabase_migrations.schema_migrations` manually.
- Edge deploys: `SUPABASE_ACCESS_TOKEN=<PAT> npx supabase functions deploy
  <fn> --project-ref kqnzxjrpnjnczhgdwdqg --use-api` (no Docker needed).
- Deno is installed locally now (`~/.deno/bin`) — run `deno check` + the
  function tests before any edge deploy.
- The founder's standing rule (treat as law): **no guesswork — verify
  every data claim against the DB/code/tests before acting on it.**
