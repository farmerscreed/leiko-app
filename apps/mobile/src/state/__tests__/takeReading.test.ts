// takeReading store — Sprint 12.5.1 disconnect-resilience.
//
// Focused on the mid-measurement disconnect path. Other flows (manual
// entry, initial connect failure, 0x73 → fetch success) are exercised
// by TakeReadingScreen.test.tsx and the manual e2e on the dev phone.
//
// Pure project: mocks the BLE + sync + pairing layer so this lives in
// the pure jest project (no react-native runtime needed).

type DisconnectCallback = () => void;
type NotifyHandlers = { onBP?: () => void };

const mockConnectToUrion: jest.Mock = jest.fn();
const mockSyncBacklog: jest.Mock = jest.fn();
const mockSubscribeToNotifications: jest.Mock = jest.fn(() => () => undefined);
const mockUseReadingsLatest: jest.Mock = jest.fn(() => null);
const mockAddPendingReading: jest.Mock = jest.fn();
const onDisconnectedCallbacks: DisconnectCallback[] = [];
const notifyHandlers: NotifyHandlers[] = [];

jest.mock('../../services/ble/bleManager', () => ({
  connectToUrion: (deviceId: string, opts?: unknown) =>
    mockConnectToUrion(deviceId, opts),
}));

jest.mock('../../services/ble/notify', () => ({
  subscribeToNotifications: (device: unknown, handlers: NotifyHandlers) => {
    notifyHandlers.push(handlers);
    return mockSubscribeToNotifications(device, handlers);
  },
}));

jest.mock('../../services/sync/syncBacklog', () => ({
  syncBacklog: (device: unknown, bleId: string, opts?: unknown) =>
    mockSyncBacklog(device, bleId, opts),
}));

jest.mock('../../services/analytics/logger', () => ({
  logger: { track: jest.fn() },
}));

jest.mock('../readings', () => ({
  useReadings: {
    getState: () => ({
      latest: mockUseReadingsLatest,
      addPendingReading: mockAddPendingReading,
    }),
  },
}));

jest.mock('../pairing', () => ({
  usePairing: {
    getState: () => ({
      pairedDevice: { bleId: 'AA:BB:CC:DD:E4:F2', macSuffix: 'e4f2', name: 'Leiko Watch', pairedAt: 0 },
    }),
  },
}));

import { useTakeReading } from '../takeReading';

function fakeDevice(): unknown {
  return {
    disconnect: jest.fn().mockResolvedValue(undefined),
    onDisconnected: (cb: DisconnectCallback) => {
      onDisconnectedCallbacks.push(cb);
      return () => undefined;
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  onDisconnectedCallbacks.length = 0;
  notifyHandlers.length = 0;
  useTakeReading.getState().reset();
  mockConnectToUrion.mockResolvedValue(fakeDevice());
  mockSyncBacklog.mockResolvedValue({ pulled: 0, latestTimestampSec: null });
  mockUseReadingsLatest.mockReturnValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('mid-measurement disconnect (Sprint 12.5.1)', () => {
  it('transitions to "reconnecting" instead of failing when GATT drops during waiting_for_watch', async () => {
    const beginPromise = useTakeReading.getState().begin();
    // Resolve the initial connect + initial backlog sync; reach waiting.
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;
    expect(useTakeReading.getState().phase).toBe('waiting_for_watch');

    // Fire the onDisconnected callback registered during begin().
    expect(onDisconnectedCallbacks.length).toBeGreaterThan(0);
    onDisconnectedCallbacks[0]();

    expect(useTakeReading.getState().phase).toBe('reconnecting');
    expect(useTakeReading.getState().error).toBeNull();
  });

  it('reconnects, pulls the new reading, and lands on success', async () => {
    // Initial connect + backlog return nothing (waiting for the user).
    const beginPromise = useTakeReading.getState().begin();
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;

    // Set up the reconnect attempt to return a fresh device + a real
    // pulled reading. addPendingReading's return shape only needs the
    // localId for the success path; latest() picks up the new row.
    const newReading = {
      localId: 'local-xyz',
      systolic: 124,
      diastolic: 80,
      pulse: 70,
    };
    mockUseReadingsLatest.mockReturnValueOnce(null); // before
    mockUseReadingsLatest.mockReturnValueOnce(newReading); // after
    mockConnectToUrion.mockResolvedValueOnce(fakeDevice());
    mockSyncBacklog.mockResolvedValueOnce({
      pulled: 1,
      latestTimestampSec: 1778500000,
    });

    onDisconnectedCallbacks[0]();
    expect(useTakeReading.getState().phase).toBe('reconnecting');

    // Drain the FIRST_DELAY_MS sleep.
    await jest.advanceTimersByTimeAsync(5_000);
    // Drain the connect + syncBacklog microtasks.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockConnectToUrion).toHaveBeenCalledTimes(2);
    expect(useTakeReading.getState().phase).toBe('success');
    expect(useTakeReading.getState().lastReadingId).toBe('local-xyz');
  });

  it('falls through to failure when every reconnect attempt fails', async () => {
    const beginPromise = useTakeReading.getState().begin();
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;

    // Every subsequent reconnect attempt rejects.
    mockConnectToUrion.mockRejectedValue(new Error('connect timeout'));

    onDisconnectedCallbacks[0]();
    expect(useTakeReading.getState().phase).toBe('reconnecting');

    // Walk the attempt ladder: 5s initial wait + 6 attempts ×
    // 5s back-off. Run timers in full to drain the loop.
    await jest.runAllTimersAsync();

    expect(useTakeReading.getState().phase).toBe('failure');
    expect(useTakeReading.getState().error?.code).toBe('connect_failed');
  });
});
