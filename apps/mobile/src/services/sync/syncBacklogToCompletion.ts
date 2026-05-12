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
import { syncBacklog } from './syncBacklog';

const MAX_BATCHES = 20;

export interface BacklogLoopResult {
  totalPulled: number;
  batches: number;
  hitBatchCap: boolean;
  latestTimestampSec: number | null;
}

export async function syncBacklogToCompletion(
  device: UrionDevice,
  deviceBleId: string,
  options: { timeoutMs?: number } = {},
): Promise<BacklogLoopResult> {
  let totalPulled = 0;
  let batches = 0;
  let latestTimestampSec: number | null = null;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const result = await syncBacklog(device, deviceBleId, {
      ...options,
      // setTime once per connection; subsequent batches skip it.
      skipSetTime: i > 0,
    });
    batches++;
    totalPulled += result.pulled;
    if (result.latestTimestampSec !== null) {
      latestTimestampSec = result.latestTimestampSec;
    }
    if (result.pulled === 0) {
      return { totalPulled, batches, hitBatchCap: false, latestTimestampSec };
    }
  }
  return { totalPulled, batches, hitBatchCap: true, latestTimestampSec };
}
