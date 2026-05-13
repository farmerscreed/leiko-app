# Start here — next session (post Sprint 16.5d)

Last touched: 2026-05-13 ~22:30 Lagos. Founder asked to end the session and pick up fresh.

## 90-second context

Sprint 16.5d shipped tonight. Five commits (`bb9eb24` → `af64223`, pushed to origin). The Sleep page is fully rebuilt and protocol-honest; HR + SpO2 timestamp encoding is correct; the "server has more data than device" pattern was solved for sleep via a server-hydration hook that's now the template for the other multi-day vitals.

The bench session ended on a working state. Three things remain on the punch-list before this round of vital work is complete.

## Read in this order

1. **`memory/sprint_16_5d_close_out.md`** — the full 16.5d story, the eight hard rules, the pending list, the file matrix.
2. **`memory/sprint_16_5c_close_out.md`** — the multi-vitals partial-index fix story (still load-bearing).
3. **`memory/sprint_16_5a_close_out.md`** — the BP cursor fix (still load-bearing).
4. Skip the saga master log + the 16.5b memo — both superseded.

Optional, only if relevant to today's task:
- `tools/ble-mock/captured-traces/2026-05-13/scenario-{12-16}.log` — bench evidence
- `apps/mobile/src/hooks/useHydrateSleepFromServer.ts` — the canonical template for the new hydration hooks

## The three pending tasks (in priority order)

### 1. Activity hydration + UI fix
Same shape as Sleep. Server has 11+ days of `steps_day` + `calories_day`; watch's day-info storage rolls over so a re-sync only gets today; user reported "only one record" earlier.

What to add:
- `useActivity.seedStepsFromServer(rows)` + `seedCaloriesFromServer(rows)` — idempotent merge by `dayLocal`
- `useHydrateActivityFromServer` hook — mirror `useHydrateSleepFromServer` exactly
- Wire into `SelfBuyerHome` alongside the existing two hydration hooks
- Audit `ActivityDetail` for the same hard-cap pattern that bit SpO2 + Sleep (`buildRecentList` returning ≤ 4 hard-coded rows)
- Wire `onRangeChange` so 7d / 30d / 90d filters Activity's chart + list

### 2. Wire 7d/30d/90d on BP / HR / SpO2 / Activity
DetailShell renders `TimeRangePills` on every detail screen, but only `SleepDetail` mirrors the range into local state and re-derives data. The other four screens render the pills purely as decoration.

Per screen:
- Add `const [range, setRange] = useState<TrendRange>('7d')`
- Pass `onRangeChange={setRange}` to `DetailShell`
- Filter the screen's chart series / recent-list / correlation strip by the range
- For correlation strips: pass `tBounds={{ tMin: now - days*DAY_MS, tMax: now }}` + `axisLabels={{ left, right }}` — the props are already on `CorrelationStrip` (added in 16.5d)

### 3. Home / Daily Pulse spot-check
Just verify that the constellation tiles + the morning narration are using the now-populated server data. Probably nothing to fix; this is a "did the fix land" pass.

## Bench environment state

The user has paused. Background services may or may not still be running — run the preflight first:

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

This checks Metro on :8081, Supabase Kong on :54321, Edge Functions runtime, adb reverse forwards. If anything is red, start it:
- **Metro**: `cd apps/mobile && npx expo start --dev-client` (must run from `apps/mobile`)
- **Supabase**: `supabase start && supabase functions serve --env-file supabase/functions/.env`
- Both env files (`.env.local` at root + `apps/mobile/.env.local`) are gitignored — if missing on a fresh worktree, copy from `C:\Users\admin\Documents\APP\kena-app\`

The captures dir for tomorrow's session is at `tools/ble-mock/captured-traces/<today's date>/`. Scenario 17+ would be the next numbers.

## Recommended first action

**Start with Activity (#1).** It's the same pattern Sleep just nailed; should ship in one sitting. Once that's done, Activity has full parity with Sleep — then either close out the 7d/30d/90d wiring across the remaining screens, or stop and let the founder do a holistic verification pass.

Activity-detail-specific notes:
- The `useActivity` slice has TWO recent arrays: `recentSteps` (per-day step totals) and `recentCalories` (per-day calorie totals). The hydration hook needs to map both from `vitals_other` (vital_type `steps_day` and `calories_day` respectively).
- The DB query I ran during 16.5d showed: server has steps + calories for 2026-05-03 → 2026-05-13 (11 days). Activity should surface all of those after hydration.

## Hard rules carried over from 16.5d (don't repeat the lessons)

From `memory/sprint_16_5d_close_out.md`:
1. HR/SpO2 day-anchor timestamps use `watchVitalTimestampToUtcSec` (subtract localOff). Not BP's `watchTimestampToUtcSec`. Not no-shift.
2. SpO2 packets are SINGLE bytes per hour. Don't reintroduce pair-decoding.
3. Server is source of truth for historical day-data. Don't try to coax history out of the watch — its day-info storage rolls over within ~3-5 days.
4. `useReadings.syncPending` cap must sort by `measuredAtSec` DESC before slicing.
5. Hydration-hook gate: `localCount < FETCH_LIMIT`, not `localCount === 0`.
6. Dev panel reset must NOT touch the BP cursor. (Triggers legacy `/sync` flood per Sprint 16.5b.)
7. Wiring 7d/30d/90d means BOTH `onRangeChange` AND the screen's data selectors react to the range.
8. `CorrelationStrip` `tBounds` + `axisLabels` props are the canonical way to make the chart's x-axis match the range window.

## What was the last thing the user did

Verified the Sleep × Morning BP correlation chart with the new `tBounds` + `axisLabels` props, said "WE ARE GOOD WITH THIS", and asked to wrap so the next session can pick up cleanly.
