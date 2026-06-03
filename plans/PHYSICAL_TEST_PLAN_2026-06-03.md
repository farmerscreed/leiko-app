# Physical Test Plan — vitals data correctness session (2026-06-03)

> Gate: **main merge waits for this plan to pass.** Every fix below is
> live in prod (migrations 0029→0034 + `sync` + `generate-doctor-pdf`)
> and on the branch `fix/vitals-data-completeness` (pushed). The debug
> build with all client fixes installed on `43230DLJH001YY` at 21:15.
> Decision record: `docs/_adr/0008-vitals-data-correctness.md`.

## Setup

| Thing | Value |
|---|---|
| Wearer account | `lawonecloud@gmail.com` (Lawrence) · tz **Africa/Lagos** |
| Caregiver account | `lawonecloud+caregiver@gmail.com` · tz **America/Lima** (second phone/emulator) |
| Watches | **U19** = primary (`07e44881…`) · **U16H** = test watch (`5a2a24f5…`) |
| Build | Debug, metro-tethered: run `npx expo start --dev-client` in `apps/mobile/`, open the app, keep USB/Wi-Fi up. Reload (shake → Reload) to pick up the latest JS. |
| SQL checkpoints | Ask the assistant to run them, or use the Supabase SQL editor. Counts are LIVE — always compare screen vs a fresh query, not vs the numbers in this doc. |

Baseline truth queries (run before starting; note the numbers):

```sql
-- BP total for the main family (post-dedup; was 92 at plan time)
select count(*) from readings
 where family_id='21b057bb-7aa4-4e47-9185-48afc43d19f6' and not hidden;

-- per-vital counts
select vital_type, count(*) from vitals_other
 where family_id='21b057bb-7aa4-4e47-9185-48afc43d19f6' and not hidden
 group by vital_type;
```

---

## Stage 1 — BP correctness (dedupe + timezone)

1. Open **BP detail** (self path, Lawrence's phone).
   - [ ] Recent list shows **no doubled rows** (e.g. the Jun-2 151/89 appears once).
   - [ ] Row times are **Lagos local** (a reading stored 09:43 UTC shows **10:43 am**).
   - [ ] Hero "Latest · {time}" matches the newest reading's Lagos time.
   - [ ] 7d/30d/90d stat trio (avg/lowest/highest) changes per pill and
         matches a SQL spot-check:
     ```sql
     select round(avg(systolic)) sys, round(avg(diastolic)) dia, count(*)
     from readings where family_id='21b057bb-…' and not hidden
       and measured_at >= now() - interval '7 days';
     ```
2. **Fresh-reading sync (the dedupe regression test).** Take one BP
   reading on the **U19**; let it sync.
   - [ ] The list grows by **exactly 1**; SQL count +1.
3. **Second-watch regression (the original 51-dupe bug).** Connect the
   **U16H** and let it sync.
   - [ ] SQL count does **NOT** jump (history must not re-import):
     the device-independent `(family_id, measured_at)` key blocks it.

## Stage 2 — Timezone (every screen, both paths)

1. On Lawrence's phone (device tz = Lagos = profile tz): HR / SpO2 rows
   show Lagos times; Activity "Today · …" matches the Lagos day.
2. **The real test — caregiver path.** On the second phone, sign in as
   the caregiver (profile tz **America/Lima**) and open Lawrence's vitals.
   - [ ] BP/HR/SpO2 times show in **Lagos** time (the wearer's), NOT Lima.
   - [ ] "Today"/day sections split at **Lagos midnight**.
3. Optional torture test: change the phone's device tz in Android
   settings to something absurd (e.g. Asia/Tokyo) → reload → all reading
   times must NOT move (they follow the profile tz, not the device).

## Stage 3 — Sleep honesty

1. Open **Sleep detail**.
   - [ ] Hero shows duration; bed→wake clock appears **only** with the
         `~` estimate framing ("~11:14 pm → ~8:00 am", "est. from heart
         rate"). If inference isn't confident: **"Last night · H:MM
         slept"** and NO clock anywhere. A fixed "9:00 am" wake must
         never appear.
   - [ ] History shows **one row per night** (the old June-2 night = one
         84-min entry, not five fragments).
2. **Overnight regression**: after the next night's wear, the new night
   lands as **one** row (SQL: `select count(*) from vitals_other where
   vital_type='sleep_session' and measured_at::date = current_date;` → 1).

## Stage 4 — HR (live hero + real ranges)

1. Open **HR detail**.
   - [ ] Hero reads "**Latest reading**" with a recent bpm (≤ ~5 min old
         when the watch is worn).
   - [ ] Switching **7d → 30d → 90d genuinely changes** zones, trend
         line, and the stat trio (pre-fix all three showed the same ~16h).
         Spot-check 7d sample count: the trend/zones should reflect
         thousands of samples, not hundreds:
     ```sql
     select count(*) from vitals_other where family_id='21b057bb-…'
       and vital_type='hr' and measured_at >= now() - interval '7 days';
     ```
   - [ ] Recent-row times are Lagos local.
   - [ ] Airplane mode → reload: screen still renders (local-slice
         fallback); turn network back on → ranges fill in.

## Stage 5 — VitalHistory ("View all" — NEW, never device-tested)

For **each of BP, SpO2, Sleep, Activity**:
1. [ ] Under the recent list: "**View all · N {readings|nights|days}**"
       where **N equals the SQL count** for the selected range.
2. [ ] Tap → full-screen list: day headers ("Monday · Jun 2") split at
       **Lagos midnight**; rows newest-first; BP/SpO2 rows show clock
       times, sleep rows say "night", activity rows no clock.
3. [ ] Scroll to the bottom (BP 90d is the best case: >50 rows) →
       infinite scroll loads the rest; the last row matches the OLDEST
       in-range row in SQL.
4. [ ] Header count matches N from the link; Back returns to the detail.
5. [ ] Caregiver phone: same screen works and shows **Lagos** days.
6. [ ] Airplane mode → the link/screen degrade calmly (no crash; error
       state with retry).

## Stage 6 — Doctor PDF (exact data)

1. Generate the **For Your Doctor** PDF at **30d**.
   - [ ] HR section's sample count ≈ the SQL 30d count (thousands —
         pre-fix it silently used ~1,000 arbitrary rows).
   - [ ] Day-by-day points span the full window in **Lagos** days.
   - [ ] BP count in the report == SQL 30d count (post-dedup).
2. Generate at **7d** and sanity-check the same.

## Stage 7 — Settings back button (BottomSheet fix)

1. Settings → open a profile field sheet → dismiss by tapping the
   backdrop **mid-animation**; repeat fast 3–5×; also drag-dismiss then
   instantly tap.
2. [ ] **Back always works** afterwards; no dead/frozen screen (pre-fix
       a cancelled close left an invisible touch-eating overlay).

## Stage 8 — Regression sweep (untouched-behaviour spot checks)

- [ ] Home constellation renders; orbs/tab bar fine.
- [ ] Take Reading flow unchanged; new reading appears on Home + BP.
- [ ] Trends renders; Learn opens; Connect/invite sheets open + dismiss.

---

## Exit criteria → main

All Stage 1–7 boxes ticked (Stage 8 spot-checked). Then merge:
our 18 commits **rebase cleanly onto main** (PR #8 already squashed the
consolidated history; main's content is identical to our branch's base —
verified `git diff origin/main 836fc68` = empty). Any failed box: report
the screen + what you saw; the assistant traces it against prod SQL
before anything lands on main.

Known accepted items (NOT blockers, documented):
- HR per-day drill-down not built yet (VitalHistory excludes HR by design).
- 2 pre-existing `resolve-routing` deno test failures (mock fidelity).
- Debug build is metro-tethered; release APK needs `LEIKO_RELEASE_*`.
