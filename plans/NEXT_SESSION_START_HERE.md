# Start here — next session

Last touched: 2026-05-13 ~11:35 Lagos. Founder asked to stop and pick up fresh.

## 30-second context

Sprint 16.5a fixed the BP cursor bug (Phase A, end of 2026-05-12). Sprint 16.5b started 2026-05-13 — shipped 5 of 9 queued Phase A bugs + confirmed the multi-vitals server-sync drain root cause (Supabase Edge Function CPU soft limit). **Chunking fix is shipped (commit `389fb80`) but NOT YET VERIFIED on-device** — that's the first thing.

A separate intermittent finding surfaced: BP value mismatch (watch face shows X/Y, app stores different X/Y for the same timestamp). Trace site added (`722d8c2`), waiting for the next mismatch to capture raw bytes.

## Read in this order

1. **`memory/sprint_16_5a_close_out.md`** — the canonical Phase A reference. Cursor model fix, what's been refuted (saga master log claims), hard rules.
2. **`memory/sprint_16_5b_session_2026_05_13.md`** — today's full progress note. Commits, what's verified vs not, what's open.
3. (Optional, if interested in raw evidence) `tools/ble-mock/captured-traces/2026-05-13/scenario-{07,08}.log` — byte-level traces.

Skip the saga master log — both 16.5a and 16.5b supersede it.

## Three things you should know up front

1. **The multi-vitals server-sync drain is a CPU soft limit issue on the Edge Function.** The function log shows `CPU time soft limit reached: isolate: ...`. Chunking is the right move. Latest iteration uses 100-sample HR chunks + a separate "small vitals" POST with NO HR. Worst case: 30+1 POSTs for a 3000-sample backfill.

2. **The first action is force-stop + reopen Leiko on the phone, then watch HR pending drop.** No code changes needed first. If HR drops from 3092 → 0 over ~60s, drain is fixed. If `multi_vitals_sync_failed` shows up with a status code (504/500/401/etc.), the new error log will tell us what to do next.

3. **The BP value mismatch is intermittent.** One cycle this morning had it (133/80 → 160/93). Another cycle 30 min later didn't (145/85 → 145/85). The added trace site logs raw bytes on every BP cycle going forward; next mismatch is captured automatically.

## Bench environment state

The user paused mid-bench. Background processes may still be running OR they may have closed the laptop. Either way, run the preflight first:

```powershell
& "$PWD\scripts\dev-phone-reconnect.ps1"
```

This checks (and tells you to start) all of:
- Phone tethered via USB
- Metro on :8081
- Supabase local on :54321
- Edge Functions runtime
- adb reverse tcp:8081 + tcp:54321

If anything is RED, start it:
- **Metro** (must run from this worktree): `cd apps/mobile && npx expo start --dev-client`
- **Supabase**: needs Docker Desktop running first; then `supabase start` (long warmup) then `supabase functions serve --env-file supabase/functions/.env` (the env file is gitignored; if missing, copy from `C:\Users\admin\Documents\APP\kena-app\supabase\functions\.env`)
- **Env files**: `.env.local` files at both repo root + apps/mobile are gitignored. If they're missing in the worktree (e.g. fresh `git worktree add`), copy from the main repo at `C:\Users\admin\Documents\APP\kena-app\` (both root and apps/mobile).

The captured-traces directory for today is at `tools/ble-mock/captured-traces/2026-05-13/`. Scenario 9 would be the next number.

## The verify-chunking ritual

```sh
# Clear logcat buffer
adb logcat -c

# Capture to scenario 9 (background)
adb logcat -v time ReactNativeJS:V '*:S' \
  > tools/ble-mock/captured-traces/2026-05-13/scenario-09-chunked-v2-verify.log 2>&1 &
```

Then on the phone:
1. Force-stop Leiko (Settings → Apps → Leiko → Force Stop, or long-press icon → App info → Force Stop).
2. Reopen Leiko.
3. Open Vitals Debug Panel.
4. Watch HR pending count for 60-90 seconds. Should drop visibly.
5. Screenshot the panel timeline.

What you're looking for:
- **Win:** many `vital_sync_accepted hr · N` events on the timeline, HR pending → 0
- **Loss:** `multi_vitals_sync_failed /sync invoke failed: <STATUS_CODE> <statusText> [hr=100]`
   - 504 / timeout → still CPU. Reduce `MULTIVITALS_HR_CHUNK_SIZE` to 50 or look at server optimisation.
   - 401 → auth. Token expired, refresh path broken.
   - 400 → schema/validation. Server rejecting a sample field.
   - 500 → server bug. Look at supabase function logs.

## Things that are explicitly NOT in scope tonight

- The deferred Phase A bugs needing fresh bench captures: HR cursor encoding (#4), sleep richness decode (#6), activity hourly wire-up (#7), sports records ingest (#8). All queued for a future session.
- The BLE_TRACE strip — gated behind `typeof __DEV__ !== 'undefined' && __DEV__`, safe to keep. Strip during Phase 16.5b cleanup once chunking + BP mismatch are both resolved.

## Hard rules (don't repeat work already paid for)

From `memory/sprint_16_5a_close_out.md` — these stay forever:
1. Don't use `TS=cursor` with DIR=1 for incremental BP sync. Use TS=0.
2. Don't think the watch's transferable BP register is "stuck" — it's not. The cursor model was broken.
3. Don't propose factory reset of the watch as a fix. That hypothesis is dead.
4. Don't drop `addPendingReading`'s identity-dedupe.
5. Don't change the cursor's units (raw watch firmware seconds).
6. Don't ship `BLE_TRACE = true` — always gate behind `typeof __DEV__ !== 'undefined' && __DEV__`.

## What was the last thing the user did

They took a fresh BP cycle on the watch at 11:23 Lagos. Watch face showed 145/85. App's `lates` showed 145/85 p75. That cycle did NOT have the value mismatch — values matched perfectly. But the HR pending was still 3092 at that point, with `multi_vitals_sync_failed` firing on every sync. That's when chunking-v2 was shipped (commit `389fb80`) and the user paused.

So next session: app needs to reload to pick up `389fb80`, then we verify drain.
