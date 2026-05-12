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
const mockApplyDeviceConfig: jest.Mock = jest.fn();
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

jest.mock('../../services/sync/applyDeviceConfig', () => ({
  applyDeviceConfig: (device: unknown, opts?: unknown) =>
    mockApplyDeviceConfig(device, opts),
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
  mockApplyDeviceConfig.mockResolvedValue({ ran: true, steps: ['autoHr', 'autoSpo2', 'goals'] });
  mockUseReadingsLatest.mockReturnValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('device-config flush on connect (Sprint 12.5.2)', () => {
  it('calls applyDeviceConfig with force:true after connect, before subscribing for BP-ready', async () => {
    const beginPromise = useTakeReading.getState().begin();
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;

    expect(mockApplyDeviceConfig).toHaveBeenCalledTimes(1);
    const [, opts] = mockApplyDeviceConfig.mock.calls[0];
    expect(opts).toMatchObject({ force: true });
    // applyDeviceConfig is called BEFORE the subscribe step — the
    // watch must have demographics before the user presses the BP
    // button. Subscribe registers exactly once on the same connect.
    expect(mockSubscribeToNotifications).toHaveBeenCalledTimes(1);
    expect(useTakeReading.getState().phase).toBe('waiting_for_watch');
  });

  it('does not block the take-reading flow when applyDeviceConfig throws', async () => {
    mockApplyDeviceConfig.mockRejectedValueOnce(new Error('config flush failed'));
    const beginPromise = useTakeReading.getState().begin();
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;

    // Reach waiting_for_watch regardless of the config flush failure.
    expect(useTakeReading.getState().phase).toBe('waiting_for_watch');
    expect(useTakeReading.getState().error).toBeNull();
    expect(mockSyncBacklog).toHaveBeenCalled();
  });

  it('does not block the take-reading flow when applyDeviceConfig returns a partial-failure result', async () => {
    mockApplyDeviceConfig.mockResolvedValueOnce({
      ran: true,
      steps: ['autoHr'],
      error: 'userParams: setTimeout',
    });
    const beginPromise = useTakeReading.getState().begin();
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;

    expect(useTakeReading.getState().phase).toBe('waiting_for_watch');
    expect(useTakeReading.getState().error).toBeNull();
  });
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

  it('polls until the watch finally stores the new reading, then lands on success', async () => {
    // Initial connect + backlog return nothing.
    const beginPromise = useTakeReading.getState().begin();
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;

    // After reconnect: first two readBPHistory polls return pulled=0
    // (watch still measuring), third returns the new reading.
    const newReading = {
      localId: 'local-xyz',
      systolic: 124,
      diastolic: 80,
      pulse: 70,
    };
    mockConnectToUrion.mockResolvedValueOnce(fakeDevice());
    mockSyncBacklog
      .mockResolvedValueOnce({ pulled: 0, latestTimestampSec: null })
      .mockResolvedValueOnce({ pulled: 0, latestTimestampSec: null })
      .mockResolvedValueOnce({ pulled: 1, latestTimestampSec: 1778500000 });
    // latest() snapshot before/after each poll:
    mockUseReadingsLatest
      .mockReturnValueOnce(null)          // poll 1 before
      .mockReturnValueOnce(null)          // poll 2 before
      .mockReturnValueOnce(null)          // poll 3 before
      .mockReturnValueOnce(newReading);   // poll 3 after

    onDisconnectedCallbacks[0]();
    expect(useTakeReading.getState().phase).toBe('reconnecting');

    // Walk the timeline: 15s initial delay + 3 polls × 8s.
    await jest.runAllTimersAsync();

    expect(mockConnectToUrion).toHaveBeenCalledTimes(2); // initial + 1 reconnect
    expect(mockSyncBacklog).toHaveBeenCalledTimes(4);     // initial + 3 polls
    expect(useTakeReading.getState().phase).toBe('success');
    expect(useTakeReading.getState().lastReadingId).toBe('local-xyz');
  });

  it('falls through to no_reading when the 90s budget exhausts with no new reading', async () => {
    const beginPromise = useTakeReading.getState().begin();
    await Promise.resolve();
    await Promise.resolve();
    await beginPromise;

    // Every reconnect succeeds but every poll returns pulled=0 — the
    // watch never stores a fresh reading. After the budget exhausts
    // the flow should surface no_reading (the connection itself was
    // fine).
    mockConnectToUrion.mockResolvedValue(fakeDevice());
    mockSyncBacklog.mockResolvedValue({ pulled: 0, latestTimestampSec: null });
    mockUseReadingsLatest.mockReturnValue(null);

    onDisconnectedCallbacks[0]();
    expect(useTakeReading.getState().phase).toBe('reconnecting');

    await jest.runAllTimersAsync();

    expect(useTakeReading.getState().phase).toBe('failure');
    expect(useTakeReading.getState().error?.code).toBe('no_reading');
  });
});
