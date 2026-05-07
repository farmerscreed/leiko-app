// Cursor loop — Sprint 7.
//
// Runs syncBacklog repeatedly until the watch returns an empty page
// (or we hit the safety cap). setTime is sent once per connection
// (first batch only); subsequent batches reuse the open link. Caller
// owns the connection lifecycle: connect before, disconnect after.
//
// Lives in its own file (rather than alongside syncBacklog) so jest
// can mock the syncBacklog module entirely when testing the loop —
// same-module function references bypass jest.mock interception.
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
