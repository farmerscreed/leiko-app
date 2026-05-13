// Cursor loop — Sprint 7. Semantics revised in Sprint 16.5a; Phase 2
// walk-back temporarily gated off in Sprint 16.5c.
//
// Runs `syncBacklog` once per connection — forward TS=0 sync that
// captures the watch's latest 50 BP records. setTime is sent on the
// forward call. Caller owns the connection lifecycle.
//
// Lives in its own file (rather than alongside syncBacklog) so jest
// can mock the syncBacklog module entirely when testing the loop —
// same-module function references bypass jest.mock interception.
//
// Sprint 16.5a note: since syncBacklog now always queries with TS=0,
// the forward call self-completes in a single iteration.
//
// Sprint 16.5c gating of Phase 2 (this commit):
//   The Phase-2 DIR=1 walk-back introduced in 16.5b
//   (`backfillBPHistoryOlderThan`, anchored at the forward batch's
//   oldest timestamp) was pulling 30–60 historical BP records on
//   every routine sync. Each `addPendingReading` triggers
//   `useReadings.syncPending()`, which POSTs each pending BP to the
//   legacy /sync path one-by-one, each invocation cascading an
//   internal /detect-anomaly call. The resulting flood (~30 /sync +
//   ~30 internal calls in ~5s) crowded out the multi-vitals POST,
//   tripping the Edge Function's wall-clock budget and returning 500.
//   Symptom: HR/SpO2/Sleep/Activity pending arrays never drained.
//
//   `backfillBPHistoryOlderThan` remains exported from `syncBacklog.ts`
//   for deliberate use (e.g. a future one-shot "import history" flow)
//   but is no longer called from the routine sync loop.

import type { UrionDevice } from '../ble/UrionDevice';
import { syncBacklog } from './syncBacklog';

export interface BacklogLoopResult {
  totalPulled: number;
  batches: number;
  /** Reserved from the multi-batch era — always false in the single-
   *  forward-batch model. Kept on the type so syncOrchestrator's
   *  analytics call site doesn't churn. */
  hitBatchCap: boolean;
  latestTimestampSec: number | null;
}

export async function syncBacklogToCompletion(
  device: UrionDevice,
  deviceBleId: string,
  options: { timeoutMs?: number } = {},
): Promise<BacklogLoopResult> {
  const first = await syncBacklog(device, deviceBleId, {
    ...options,
    skipSetTime: false,
  });
  return {
    totalPulled: first.pulled,
    batches: 1,
    hitBatchCap: false,
    latestTimestampSec: first.latestTimestampSec,
  };
}
