# Start here — next session (post Sprint 16.5e)

Last touched: 2026-05-14 Lagos.

## 90-second context

Sprint 16.5e shipped today on `claude/vigilant-almeida-0bbc5e`. Two commits (`27fe7ca` + `29507dc`). It closes the first two pending tasks from the 16.5d handoff: Activity now has server-side hydration (the same shape as Sleep got in 16.5d), and ActivityDetail's 7d / 30d / 90d pills are wired through — chart, stat trio, and Recent-days list all react. The silent "today + 3 prior days" cap on the Recent-days list (which was hiding history) is gone.

Worktree note: this branch needed a fast-forward merge from `claude/silly-solomon-1be49b` at session start to pick up the 16.5d foundations. The merge is in `1a5f5a2..58a248d`.

## Read in this order

1. **`memory/sprint_16_5e_close_out.md`** — today's full story + the new state matrix + the worktree-jest gotcha.
2. **`memory/sprint_16_5d_close_out.md`** — the eight hard rules carried over.
3. **`memory/sprint_16_5c_close_out.md`** — the multi-vitals partial-index fix story (still load-bearing).
4. **`memory/sprint_16_5a_close_out.md`** — the BP cursor fix (still load-bearing).
5. Skip the saga master log + the 16.5b memo — both superseded.

Optional, only if relevant to today's task:
- `apps/mobile/src/hooks/useHydrateActivityFromServer.ts` — the just-shipped activity hook, near-identical to the sleep one
- `apps/mobile/src/screens/VitalDetail/ActivityDetail.tsx` — current canonical example of "range-wired detail screen"
- `tools/ble-mock/captured-traces/2026-05-13/scenario-{12-16}.log` — 16.5d bench evidence (still relevant for any HR/SpO2 protocol work)

## The three pending tasks (in priority order)

### 1. Daily Pulse spot-check (carried from 16.5d)
On the bench phone, verify that:
- The 5 constellation tiles all surface today's data (post the activity + sleep hydration that now fire from Self-Buyer Home)
- The morning narration uses the now-populated server data
- The `7d / 30d / 90d` pills on `ActivityDetail` re-render chart + stats + list correctly when tapped
- The `7d / 30d / 90d` pills on the OTHER four screens (BP / HR / SpO2 / Sleep) still feel like decoration (they are, until task #3 lands — Sleep was fixed in 16.5d, the others not yet)

Probably nothing new to fix in this pass; it's a "did the fixes land" pass.

### 2. HR + SpO2 server hydration
Same shape as Activity (and Sleep before it). The two slices already have `pending` + `recent` but no `seedFromServer`. Pattern:
- `useHR.seedFromServer(rows)` + `useSpO2.seedFromServer(rows)` — idempotent merge by `measuredAtSec` (per-sample, not per-day; that's the difference from Sleep + Activity)
- `useHydrateHRFromServer` + `useHydrateSpO2FromServer` hooks
- Wire both into `SelfBuyerHome`

Be careful with the keys — HR samples can land at minute granularity, so dedup by exact `measuredAtSec` is the right key. Sleep / Activity dedup by `dayLocal` because they're per-day.

### 3. Wire 7d / 30d / 90d on BP / HR / SpO2 detail screens
Same shape as the ActivityDetail rewrite that just shipped. Per screen:
- Add `const [range, setRange] = useState<TrendRange>('7d')`
- Pass `onRangeChange={setRange}` to `DetailShell`
- Filter the screen's chart series / recent-list / correlation strip by the range
- For correlation strips: pass `tBounds={{ tMin: now - days*DAY_MS, tMax: now }}` + `axisLabels={{ left, right }}` — props live on `CorrelationStrip` (added in 16.5d)

`BPDetail.tsx` has a `VitalTrendChart` of its own — audit before changing how it consumes the range.

### 4. (Cleanup) Regenerate ActivityDetail snapshot
The stale `ActivityDetail.test.tsx.snap` was deleted in `29507dc`. The next jest run in the founder's regular kena-app setup will write a fresh one; commit it.

## Bench environment state

Background services may or may not still be running. Preflight first:

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

This checks Metro on :8081, Supabase Kong on :54321, Edge Functions runtime, adb reverse forwards. If anything is red, start it:
- **Metro**: `cd apps/mobile && npx expo start --dev-client` (must run from `apps/mobile`)
- **Supabase**: `supabase start && supabase functions serve --env-file supabase/functions/.env`
- Both env files (`.env.local` at root + `apps/mobile/.env.local`) are gitignored — if missing on a fresh worktree, copy from `C:\Users\admin\Documents\APP\kena-app\`

The captures dir for the next session is at `tools/ble-mock/captured-traces/<today's date>/`. Scenario 17+ would be the next numbers.

## Worktree note

If you're working in a `.claude\worktrees\...` worktree, jest won't find tests in-worktree — the `__dirname` path contains `\.claude\` which collides with glob escape rules. Code verified with `tsc --noEmit` + `eslint` only. Tests run fine in the founder's regular kena-app checkout. Don't try to fix this in the worktree config.

Also: a fresh worktree starts with no `node_modules`. Junction the parent repo's into both the worktree root AND `apps/mobile`:

```cmd
mklink /J node_modules C:\Users\admin\Documents\APP\kena-app\node_modules
mklink /J apps\mobile\node_modules C:\Users\admin\Documents\APP\kena-app\apps\mobile\node_modules
```

## Recommended first action

**Spot-check on the bench (#1).** Cheap, and tells you whether the just-shipped activity + sleep hydration is doing what the diff says it should. Then make a call: either HR + SpO2 hydration (#2) or close out the 7d/30d/90d wiring across BP/HR/SpO2 (#3), depending on what feels more user-visible at the moment.

## Hard rules carried over from 16.5d / 16.5e (don't repeat the lessons)

1. HR/SpO2 day-anchor timestamps use `watchVitalTimestampToUtcSec` (subtract localOff). Not BP's `watchTimestampToUtcSec`. Not no-shift.
2. SpO2 packets are SINGLE bytes per hour. Don't reintroduce pair-decoding.
3. Server is source of truth for historical day-data. Don't try to coax history out of the watch — its day-info storage rolls over within ~3-5 days.
4. `useReadings.syncPending` cap must sort by `measuredAtSec` DESC before slicing.
5. Hydration-hook gate: `localCount < FETCH_LIMIT`, not `localCount === 0`.
6. Dev panel reset must NOT touch the BP cursor. (Triggers legacy `/sync` flood per Sprint 16.5b.)
7. Wiring 7d/30d/90d means BOTH `onRangeChange` AND the screen's data selectors react to the range.
8. `CorrelationStrip` `tBounds` + `axisLabels` props are the canonical way to make the chart's x-axis match the range window.
9. (New 16.5e) The `buildRecentReadings`-style hard cap is dead. When you add server hydration to a vital, AUDIT its detail screen's recent-list builder for the same pattern (Activity had `added < 3`; SpO2 had a similar one fixed in 16.5d). Surface every row in the chosen range, newest first, and let the user scroll.

## What was the last thing the user did

Asked to pick up at Activity per the 16.5d handoff, then to work without stopping for clarifying questions.
