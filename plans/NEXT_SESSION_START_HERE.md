# Start here — vitals correctness + physical testing + report delivery (2026-06-05)

Last touched: 2026-06-05. Branch `fix/vitals-data-completeness` (pushed,
tracking origin). Supersedes the 2026-06-03 version of this file.

## 60-second context

Two arcs are complete on this branch:

1. **The vitals data-correctness overhaul (2026-06-03)** — full audit +
   fixes, all LIVE in prod. Decision record: **ADR-0008**
   (`docs/_adr/0008-vitals-data-correctness.md`). Working evidence:
   `plans/vitals-data-completeness.md`.
2. **Physical testing + live fixes (2026-06-05)** — the founder ran
   `plans/PHYSICAL_TEST_PLAN_2026-06-03.md` on device `43230DLJH001YY`.
   **Stages 1, 3, 4, 5, 6, 7 PASSED** (results recorded in that file's
   header). Testing surfaced two real defects, both fixed live, plus a
   founder-directed feature set — see below. Decision record for the
   report-delivery work: **ADR-0009**
   (`docs/_adr/0009-doctor-report-delivery.md`).

Standing founder rules (treat as law): **never show fabricated or
placeholder-derived values — rather show nothing**; **verify every data
claim against DB/code/tests**; **document everything for the next
session**.

## What landed 2026-06-05 (all committed + pushed)

1. **Sleep score was a constant-0 placeholder** → "a more restless night
   than your usual" fired for every night. Display now recomputes via
   `classification.sleepScoreForSession()`; ingest stores the real score
   (ADR-0008 amendment D6, commit 02ec8bb).
2. **Doctor report delivery reworked (ADR-0009)**: generation now
   downloads the PDF and opens the new **PdfPreview** screen
   (react-native-pdf) — Share hands the actual FILE (old flow shared a
   text URL that expired in 1 hour), and **"Download to phone"** saves
   into the public Downloads via the MediaStore. All device-verified
   (WhatsApp attachment delivered; file present in /sdcard/Download).
   Commits 1c64550, b55644c, 8fb31f2 (+ docs ee51561).
3. **Four new stack pins** (founder-approved, in `docs/00-tech-stack.md`):
   expo-file-system 19.0.x, expo-sharing 14.0.x, react-native-pdf 7.0.x,
   react-native-blob-util 0.24.x. **Native modules → any build older than
   2026-06-05 must be rebuilt** (the dev client was; the release APK
   pipeline will pick them up on next run).

## Earlier (2026-06-03) — summary, full detail in ADR-0008

BP dedupe device-independent (51 prod dupes removed) · all rendering +
day/night bucketing in the **wearer's tz** · sleep night-keyed
(`measured_at` = session END, supersedes D13 §2.4) with never-fabricated
display times · doctor-PDF 1000-row silent truncation fixed (SQL
aggregation RPC 0034 + pagination) · HR range analytics server-windowed
(RPC 0030) · `measured_at_local` nulled (0033) · BottomSheet
cancelled-dismiss touch-eater fixed · **VitalHistory** "View all · N"
screen for BP/SpO2/Sleep/Activity.

## Prod state (leiko-prod `kqnzxjrpnjnczhgdwdqg`)

- Migrations **0029 → 0034** applied; `sync` + `generate-doctor-pdf`
  edge functions deployed (all of 2026-06-03; nothing server-side changed
  on 06-05 — the delivery rework is client-side).
- Access: `apps/mobile/.env.local` (URL + anon key); Supabase Management
  API PAT reaches this project (curl User-Agent required; the MCP
  supabase tools are authed to a DIFFERENT account — they can NOT reach
  leiko-prod).

## Gates

tsc 0 · jest **208 suites / 2468 tests** · eslint 0 errors · deno check
clean · deno tests 192 pass (2 pre-existing `resolve-routing` failures —
mock fidelity, predate everything here).

## Remaining before the main merge (the gate is the test plan's exit criteria)

1. **Stage 2 — caregiver cross-tz** (needs the second phone, Lima-tz
   account; wearer's readings must show Lagos times).
2. **Stage 8 — 2-minute spot sweep** (Trends renders, Learn opens,
   Connect sheet opens/dismisses).
3. **U16H connect regression** (deferred from Stage 1): BP count must
   stay flat when the second watch syncs.
4. **THE MERGE PATH (important discovery):** PR **#8 already
   squash-merged** the consolidated-build work to main (2026-06-02), and
   main's content is **byte-identical** to this branch's base commit
   `836fc68` (verified: `git diff origin/main 836fc68` is empty). So do
   NOT `git merge` (the squash would conflict everywhere) — **rebase this
   branch's commits since 836fc68 onto origin/main** (applies clean), or
   cherry-pick equivalently. Pushing main triggers `db-migrate.yml`
   (`supabase db push`) — safe: versions 0030–0034 are already recorded
   in `schema_migrations`, so it skips them.

## Backlog after the merge

- HR per-day drill-down for VitalHistory (designed: day list from
  `hr_range_summary.per_day` → tap a day → its samples).
- Release APK rebuild + untethered test (`npm run release:android:apk`,
  needs founder's `LEIKO_RELEASE_*` keystore env).
- iOS verification of the share/download paths once an iOS build exists.
- Pre-existing deferrals from the 2026-06-02 handoff (dormant old invite
  functions; store listing/join page; inert `account_type` column).

## Hard-won operational notes

- Prod mutations: Management API `database/query` inside guarded
  `DO $$` blocks (abort on unexpected row counts), then record the
  version in `supabase_migrations.schema_migrations` manually.
- Edge deploys: `SUPABASE_ACCESS_TOKEN=<PAT> npx supabase functions
  deploy <fn> --project-ref kqnzxjrpnjnczhgdwdqg --use-api`.
- Deno is installed (`~/.deno/bin`) — `deno check` + tests before any
  edge deploy.
- **Metro stale-cache trap:** a long-running metro can serve a stale
  transform cache — a fix "doesn't take effect" on device even after an
  app restart. Kill metro and restart with `--clear`, then cold-relaunch
  the app. (Cost us a confusing round during Stage 3.)
- Driving the device: `adb shell uiautomator dump` + `input tap` works
  for verification, but a human's three taps beat fifty blind ones —
  hybrid flow (founder taps, assistant verifies via SQL/logcat/screencap)
  is the efficient pattern.
- Git pushes work via `credential.helper store` (configured repo-local).
