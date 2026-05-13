// Cursor loop — Sprint 7. Semantics revised in Sprint 16.5a.
//
// Runs syncBacklog repeatedly until the watch returns no new readings
// (or we hit the safety cap). setTime is sent once per connection
// (first batch only); subsequent batches reuse the open link. Caller
// owns the connection lifecycle: connect before, disconnect after.
//
// Lives in its own file (rather than alongside syncBacklog) so jest
// can mock the syncBacklog module entirely when testing the loop —
// same-module function references bypass jest.mock interception.
//
// Sprint 16.5a note: since syncBacklog now always queries with TS=0,
// the loop self-terminates after at most one productive iteration —
// the watch returns the same latest 50 every time, the filter rejects
// everything ≤ cursor on the second pass, pulled=0, exit. The loop
// stays as a safety net (e.g. if a new reading lands between batch 1
// and batch 2) and to preserve the test harness contract. Historical
// backfill beyond the latest 50 readings is a separate concern handled
// in Phase 16.5c.
//
// MAX_BATCHES is a defensive ceiling against firmware bugs that might
// never return an empty page. 20 × 50 = 1000 readings = ~1 year of
// 3-readings-a-day; if a single sync session pulls more, something
// else is wrong and we want to bail rather than spin forever.

import type { UrionDevice } from '../ble/UrionDevice';
import { backfillBPHistoryOlderThan, syncBacklog } from './syncBacklog';

const MAX_BATCHES = 20;

export interface BacklogLoopResult {
  totalPulled: number;
  batches: number;
  hitBatchCap: boolean;
  latestTimestampSec: number | null;
}

/**
 * Sprint 16.5b — two-phase BP sync:
 *   1. Forward (TS=0): pulls the watch's latest 50 records via
 *      `syncBacklog`. This is what every routine sync needs.
 *   2. Backward (DIR=1 walk): if the watch has more than 50 records
 *      stored (the user was offline a long time, never synced before,
 *      etc.), walks backward in 50-record chunks anchored at the
 *      previous batch's oldest timestamp until the watch's history is
 *      exhausted OR MAX_BATCHES (20 × 50 = 1000 readings ≈ 1 year of
 *      3/day) is hit.
 *
 * The forward phase is the steady-state path. The backward phase
 * exists for first-ever syncs after a fresh install / Reset Cursors /
 * long-offline period, when there's >50 records of history to recover.
 */
export async function syncBacklogToCompletion(
  device: UrionDevice,
  deviceBleId: string,
  options: { timeoutMs?: number } = {},
): Promise<BacklogLoopResult> {
  let totalPulled = 0;
  let batches = 0;
  let latestTimestampSec: number | null = null;

  // Phase 1 — forward sync (TS=0, returns latest 50).
  const first = await syncBacklog(device, deviceBleId, {
    ...options,
    skipSetTime: false,
  });
  batches++;
  totalPulled += first.pulled;
  if (first.latestTimestampSec !== null) {
    latestTimestampSec = first.latestTimestampSec;
  }
  // If the watch returned nothing, there's no backfill to do either.
  if (first.oldestTimestampSecInBatch === null) {
    return { totalPulled, batches, hitBatchCap: false, latestTimestampSec };
  }

  // Phase 2 — backward walk via DIR=1 + decreasing anchor. Each
  // iteration anchors at the previous batch's oldest timestamp; the
  // watch returns up to 50 records strictly < anchor. We stop when
  // the watch returns nothing OR the new "oldest" doesn't decrease
  // (defensive — shouldn't happen per protocol, but prevents loops).
  let anchorTs = first.oldestTimestampSecInBatch;
  for (let i = 1; i < MAX_BATCHES; i++) {
    const back = await backfillBPHistoryOlderThan(device, deviceBleId, anchorTs, options);
    batches++;
    totalPulled += back.pulled;
    if (back.pulled === 0 || back.oldestTimestampSec === null) break;
    if (back.oldestTimestampSec >= anchorTs) {
      // No progress — watch returned a record at-or-above our anchor.
      // Bail to avoid spinning. Shouldn't happen per protocol §4.5
      // ("strictly older than TS"), but defensive.
      break;
    }
    anchorTs = back.oldestTimestampSec;
  }

  return {
    totalPulled,
    batches,
    hitBatchCap: batches >= MAX_BATCHES,
    latestTimestampSec,
  };
}
