// Cursor-loop unit test. Mocks syncBacklog + backfillBPHistoryOlderThan
// independently — the integration against MockDevice is covered by
// syncBacklog.test.ts; here we only assert the two-phase loop semantics
// (Sprint 16.5b): forward TS=0 first, then DIR=1 walk-backward.

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

describe('syncBacklogToCompletion — two-phase loop (Sprint 16.5b)', () => {
  it('exits after a single empty forward batch and never calls backfill', async () => {
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

  it('does forward + backward batches until the watch is exhausted', async () => {
    // Forward batch: latest 50 records, newest=1737200000, oldest=1737100000.
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 50,
      latestTimestampSec: 1737200000,
      oldestTimestampSecInBatch: 1737100000,
    });
    // Backward batch 1: 50 records, anchor=1737100000, oldest=1737050000.
    mockBackfill.mockResolvedValueOnce({
      pulled: 50,
      oldestTimestampSec: 1737050000,
    });
    // Backward batch 2: 17 records, anchor=1737050000, oldest=1737000000.
    mockBackfill.mockResolvedValueOnce({
      pulled: 17,
      oldestTimestampSec: 1737000000,
    });
    // Backward batch 3: empty — watch exhausted.
    mockBackfill.mockResolvedValueOnce({
      pulled: 0,
      oldestTimestampSec: null,
    });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result.totalPulled).toBe(50 + 50 + 17 + 0);
    expect(result.batches).toBe(4); // 1 forward + 3 backward
    expect(result.hitBatchCap).toBe(false);
    expect(result.latestTimestampSec).toBe(1737200000);
    // Verify the backward anchors threaded correctly.
    expect(mockBackfill).toHaveBeenNthCalledWith(
      1,
      fakeDevice,
      fakeBleId,
      1737100000,
      expect.anything(),
    );
    expect(mockBackfill).toHaveBeenNthCalledWith(
      2,
      fakeDevice,
      fakeBleId,
      1737050000,
      expect.anything(),
    );
    expect(mockBackfill).toHaveBeenNthCalledWith(
      3,
      fakeDevice,
      fakeBleId,
      1737000000,
      expect.anything(),
    );
  });

  it('sends setTime on the forward batch (skipSetTime threads through)', async () => {
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 50,
      latestTimestampSec: 1737000000,
      oldestTimestampSecInBatch: 1737000000,
    });
    mockBackfill.mockResolvedValueOnce({
      pulled: 0,
      oldestTimestampSec: null,
    });

    await syncBacklogToCompletion(fakeDevice, fakeBleId);

    const forwardOpts = mockSyncBacklog.mock.calls[0][2];
    expect(forwardOpts.skipSetTime).toBe(false);
  });

  it('hits the batch cap when the watch keeps returning records', async () => {
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 50,
      latestTimestampSec: 1737200000,
      oldestTimestampSecInBatch: 1737100000,
    });
    // Backward never exhausts — each iteration returns 50 with a
    // monotonically-decreasing oldest.
    let anchor = 1737100000;
    mockBackfill.mockImplementation(async () => {
      anchor -= 50_000;
      return { pulled: 50, oldestTimestampSec: anchor };
    });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result.batches).toBe(20); // 1 forward + 19 backward (cap)
    expect(result.hitBatchCap).toBe(true);
    expect(result.totalPulled).toBe(50 * 20);
  });

  it('bails out if backfill returns oldest >= anchor (no progress)', async () => {
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 50,
      latestTimestampSec: 1737200000,
      oldestTimestampSecInBatch: 1737100000,
    });
    // Defensive case: watch returns a record at exactly the anchor
    // (shouldn't happen per protocol §4.5 "strictly older", but the loop
    // bails to avoid spinning).
    mockBackfill.mockResolvedValueOnce({
      pulled: 50,
      oldestTimestampSec: 1737100000,
    });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result.batches).toBe(2); // forward + 1 backward (then bail)
    expect(result.hitBatchCap).toBe(false);
    expect(mockBackfill).toHaveBeenCalledTimes(1);
  });
});
