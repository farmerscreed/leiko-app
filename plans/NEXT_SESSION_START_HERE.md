# Start here — next session (post Sprint 16.5e batch 2)

Last touched: 2026-05-14 Lagos.

## 90-second context

Sprint 16.5e is **fully shipped**. Five commits on
`claude/vigilant-almeida-0bbc5e` close the entire 16.5d / 16.5e
state matrix:

| Vital    | Recent list | Server hydration | 7d/30d/90d wired |
|----------|-------------|------------------|------------------|
| BP       | ✓           | ✓                | ✓                |
| HR       | ✓           | ✓ (16.5e)        | ✓ (16.5e)        |
| SpO2     | ✓           | ✓ (16.5e)        | ✓ (16.5e)        |
| Sleep    | ✓           | ✓ (16.5d)        | ✓ (16.5d)        |
| Activity | ✓           | ✓ (16.5e)        | ✓ (16.5e)        |

What this means for the user: on next rebuild, opening Home will
pull the family's full vitals history from the server (BP, HR, SpO2,
sleep sessions, daily steps, daily calories) and seed the local
slices. Every detail screen's recent-readings list now surfaces that
history — capped only by the `RECENT_*_CAP` (90 days for daily
vitals, 200 samples for per-sample vitals). Every detail screen's
`7d / 30d / 90d` pill re-renders the chart / stats / recent list.

## Read in this order

1. **`memory/sprint_16_5e_close_out.md`** — full story + file matrix
   + the worktree-jest gotcha.
2. **`memory/sprint_16_5d_close_out.md`** — the eight hard rules
   carried over (plus rule #9 added in 16.5e).
3. **`memory/sprint_16_5c_close_out.md`** — multi-vitals partial-
   index fix (still load-bearing).
4. **`memory/sprint_16_5a_close_out.md`** — BP cursor fix (still
   load-bearing).
5. Skip the saga master log + the 16.5b memo — both superseded.

## The remaining tasks (verification only, not code)

### 1. Bench spot-check
On the bench phone with a Self-Buyer account that has multi-day
server-side history, verify:

- All 5 constellation tiles surface today's data on cold-start Home.
- Each detail screen's recent-readings list shows server-side
  history (not just whatever's left in the watch's day-info storage).
- Tapping `7d / 30d / 90d` on each detail screen re-renders the
  chart / stats / recent list. The SpO2 stat trio + overnight chart
  stay overnight-focused regardless of the pill — that's intentional.
- Morning narration uses the now-populated server data.

If anything looks wrong, the most likely culprit is the dailyPulse
selector — none of 16.5e touched it. Any "tile shows wrong value"
symptom is probably upstream of hydration.

### 2. Regenerate snapshot
`ActivityDetail.test.tsx.snap` was deleted in commit `29507dc`.
First jest run in the founder's regular kena-app setup writes a
fresh one; commit it. The other detail-screen snapshots (BP / HR /
SpO2) may also need regen — the useState additions show up as new
hooks in the call order, but visible content at the 7d default
shouldn't have changed.

### 3. (Bigger follow-up, deferred) Caregiver Home hydration
The hydration hooks fire from `SelfBuyerHome`. CaregiverHome does
NOT call them today. When the caregiver-mode work gets cycled back
to, audit CaregiverHome for the same self-heal pattern — but the
data shape is different (the caregiver is looking AT a parent's
readings, not their own), so it's not a copy-paste.

## Bench environment state

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

Checks Metro on :8081, Supabase Kong on :54321, Edge Functions
runtime, adb reverse forwards. If anything is red, start it:
- **Metro**: `cd apps/mobile && npx expo start --dev-client` (must
  run from `apps/mobile`)
- **Supabase**: `supabase start && supabase functions serve --env-file supabase/functions/.env`
- Both env files (`.env.local` at root + `apps/mobile/.env.local`)
  are gitignored — if missing on a fresh worktree, copy from
  `C:\Users\admin\Documents\APP\kena-app\`

## Worktree note

If you're in a `.claude\worktrees\...` worktree, jest won't find
tests — the `__dirname` path contains `\.claude\` which collides
with glob escape rules. Code was verified with `tsc --noEmit` +
`eslint` only this session. Tests run fine in the founder's regular
kena-app checkout.

Also: a fresh worktree starts with no `node_modules`. Junction the
parent repo's into both the worktree root AND `apps/mobile`:

```cmd
mklink /J node_modules C:\Users\admin\Documents\APP\kena-app\node_modules
mklink /J apps\mobile\node_modules C:\Users\admin\Documents\APP\kena-app\apps\mobile\node_modules
```

## Recommended first action

**Rebuild the dev APK + open Self-Buyer Home on the bench phone.**
The hook chain (BP / sleep / activity / HR / SpO2) fires once per
Home mount. After ~1s the local slices should be populated; opening
Activity / HR / SpO2 / BP detail should show real history, not just
today.

## Hard rules carried over from 16.5d / 16.5e (don't repeat the lessons)

1. HR/SpO2 day-anchor timestamps use `watchVitalTimestampToUtcSec`
   (subtract localOff). Not BP's `watchTimestampToUtcSec`. Not no-shift.
2. SpO2 packets are SINGLE bytes per hour. Don't reintroduce
   pair-decoding.
3. Server is source of truth for historical day-data. Don't try to
   coax history out of the watch — its day-info storage rolls over
   within ~3-5 days.
4. `useReadings.syncPending` cap must sort by `measuredAtSec` DESC
   before slicing.
5. Hydration-hook gate: `localCount < FETCH_LIMIT`, not
   `localCount === 0`.
6. Dev panel reset must NOT touch the BP cursor.
7. Wiring 7d/30d/90d means BOTH `onRangeChange` AND the screen's
   data selectors react to the range.
8. `CorrelationStrip`'s `tBounds` + `axisLabels` props are the
   canonical way to make the chart's x-axis match the range window.
9. The `buildRecentReadings`-style hard cap is dead. When you add
   server hydration to a vital, AUDIT its detail screen's
   recent-list builder for the same pattern. Surface every row in
   the chosen range, newest first.

## What was the last thing the user did

Asked to "round up everything" + ensure the activity page surfaces
multiple values + then complete all remaining tasks. The full code
side is now done across all 5 vitals; the activity-page "only one
value" symptom is addressed by the activity hydration shipped in
commits `27fe7ca` + `29507dc`. Rebuild required for the user to see
the fix land.
