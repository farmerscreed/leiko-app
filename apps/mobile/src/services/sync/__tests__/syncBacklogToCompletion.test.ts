// Sprint 16.5c: Phase-2 walk-back was gated off because it was
// flooding the Edge Function with per-record legacy /sync POSTs and
// crowding out the multi-vitals POST. The function now performs a
// single forward TS=0 batch. `backfillBPHistoryOlderThan` is still
// exported from `syncBacklog.ts` for deliberate one-shot use; these
// tests just assert that the routine loop never invokes it.

const mockSyncBacklog: jest.Mock = jest.fn();
const mockBackfill: jest.Mock = jest.fn();

jest.mock('../syncBacklog', () => ({
  syncBacklog: (device: unknown, deviceBleId: string, opts?: unknown) =>
    mockSyncBacklog(device, deviceBleId, opts),
  backfillBPHistoryOlderThan: (
    device: unknown,
    deviceBleId: string,
    anchorTs: number,
    opts?: unknown,
  ) => mockBackfill(device, deviceBleId, anchorTs, opts),
}));

import { syncBacklogToCompletion } from '../syncBacklogToCompletion';
import type { UrionDevice } from '../../ble/UrionDevice';

beforeEach(() => {
  mockSyncBacklog.mockReset();
  mockBackfill.mockReset();
});

const fakeDevice = {} as unknown as UrionDevice;
const fakeBleId = 'AA:BB:CC:DD:E4:F2';

describe('syncBacklogToCompletion — single forward batch (Sprint 16.5c)', () => {
  it('runs syncBacklog once and never calls the walk-back helper', async () => {
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 0,
      latestTimestampSec: null,
      oldestTimestampSecInBatch: null,
    });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result).toEqual({
      totalPulled: 0,
      batches: 1,
      hitBatchCap: false,
      latestTimestampSec: null,
    });
    expect(mockSyncBacklog).toHaveBeenCalledTimes(1);
    expect(mockBackfill).not.toHaveBeenCalled();
  });

  it('does NOT walk backward even when the forward batch returns 50 records', async () => {
    // Pre-16.5c, a full 50-record forward batch would trigger Phase 2
    // walk-back. After the gating, the loop ends here regardless of
    // how full the forward batch was.
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 50,
      latestTimestampSec: 1737200000,
      oldestTimestampSecInBatch: 1737100000,
    });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result).toEqual({
      totalPulled: 50,
      batches: 1,
      hitBatchCap: false,
      latestTimestampSec: 1737200000,
    });
    expect(mockSyncBacklog).toHaveBeenCalledTimes(1);
    expect(mockBackfill).not.toHaveBeenCalled();
  });

  it('threads skipSetTime=false through to the forward call', async () => {
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 1,
      latestTimestampSec: 1737000000,
      oldestTimestampSecInBatch: 1737000000,
    });

    await syncBacklogToCompletion(fakeDevice, fakeBleId);

    const forwardOpts = mockSyncBacklog.mock.calls[0][2];
    expect(forwardOpts.skipSetTime).toBe(false);
  });

  it('forwards a custom timeoutMs through to syncBacklog', async () => {
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 0,
      latestTimestampSec: null,
      oldestTimestampSecInBatch: null,
    });

    await syncBacklogToCompletion(fakeDevice, fakeBleId, { timeoutMs: 5_000 });

    const forwardOpts = mockSyncBacklog.mock.calls[0][2];
    expect(forwardOpts.timeoutMs).toBe(5_000);
  });
});
