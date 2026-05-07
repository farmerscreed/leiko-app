// Cursor-loop unit test. Mocks syncBacklog itself — the integration
// against MockDevice is already covered by syncBacklog.test.ts;
// here we only care about the loop's exit conditions.

const mockSyncBacklog: jest.Mock = jest.fn();

jest.mock('../syncBacklog', () => ({
  syncBacklog: (device: unknown, deviceBleId: string, opts?: unknown) =>
    mockSyncBacklog(device, deviceBleId, opts),
}));

import { syncBacklogToCompletion } from '../syncBacklogToCompletion';
import type { UrionDevice } from '../../ble/UrionDevice';

beforeEach(() => {
  mockSyncBacklog.mockReset();
});

const fakeDevice = {} as unknown as UrionDevice;
const fakeBleId = 'AA:BB:CC:DD:E4:F2';

describe('syncBacklogToCompletion — cursor loop', () => {
  it('stops after a single empty page and reports one batch', async () => {
    mockSyncBacklog.mockResolvedValueOnce({ pulled: 0, latestTimestampSec: null });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result).toEqual({
      totalPulled: 0,
      batches: 1,
      hitBatchCap: false,
      latestTimestampSec: null,
    });
    expect(mockSyncBacklog).toHaveBeenCalledTimes(1);
  });

  it('keeps looping while batches return rows, stopping on empty', async () => {
    mockSyncBacklog
      .mockResolvedValueOnce({ pulled: 50, latestTimestampSec: 1737100000 })
      .mockResolvedValueOnce({ pulled: 50, latestTimestampSec: 1737200000 })
      .mockResolvedValueOnce({ pulled: 17, latestTimestampSec: 1737300000 })
      .mockResolvedValueOnce({ pulled: 0, latestTimestampSec: null });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result.totalPulled).toBe(117);
    expect(result.batches).toBe(4);
    expect(result.hitBatchCap).toBe(false);
    // Empty page returns null for latestTimestampSec; we keep the
    // last productive cursor so the orchestrator can surface it.
    expect(result.latestTimestampSec).toBe(1737300000);
  });

  it('sends setTime on the first batch only (skipSetTime threads through)', async () => {
    mockSyncBacklog
      .mockResolvedValueOnce({ pulled: 50, latestTimestampSec: 1737000000 })
      .mockResolvedValueOnce({ pulled: 0, latestTimestampSec: null });

    await syncBacklogToCompletion(fakeDevice, fakeBleId);

    const firstCallOpts = mockSyncBacklog.mock.calls[0][2];
    const secondCallOpts = mockSyncBacklog.mock.calls[1][2];
    expect(firstCallOpts.skipSetTime).toBe(false);
    expect(secondCallOpts.skipSetTime).toBe(true);
  });

  it('hits the batch cap when the watch never returns an empty page', async () => {
    mockSyncBacklog.mockResolvedValue({ pulled: 50, latestTimestampSec: 1737000000 });

    const result = await syncBacklogToCompletion(fakeDevice, fakeBleId);

    expect(result.batches).toBe(20);
    expect(result.hitBatchCap).toBe(true);
    expect(result.totalPulled).toBe(50 * 20);
  });
});
