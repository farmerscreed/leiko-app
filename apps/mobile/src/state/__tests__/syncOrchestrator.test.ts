// Orchestrator state-machine tests. Mocks the entire BLE +
// syncBacklog layer so this lives in the pure jest project (no
// react-native runtime needed). The integration with real BLE is
// covered by the syncBacklog/syncBacklogToCompletion tests + manual
// e2e on the dev phone.

const mockConnectToUrion: jest.Mock = jest.fn();
const mockObserveBluetoothState: jest.Mock = jest.fn(() => ({
  remove: () => undefined,
}));
const mockSubscribeToNotifications: jest.Mock = jest.fn(() => () => undefined);
const mockSyncBacklogToCompletion: jest.Mock = jest.fn();
const mockUseReadingsSync: jest.Mock = jest.fn(async () => undefined);
const mockTakeReadingPhase = { current: 'idle' as string };

// Pure project has no react-native mock; stub the bits the orchestrator
// imports. AppState.addEventListener returns a NativeEventSubscription
// shape; the orchestrator only ever calls .remove() on it.
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../../services/ble/bleManager', () => ({
  connectToUrion: (deviceId: string) => mockConnectToUrion(deviceId),
  observeBluetoothState: (cb: (state: string) => void) =>
    mockObserveBluetoothState(cb),
}));

jest.mock('../../services/ble/notify', () => ({
  subscribeToNotifications: (device: unknown, handlers: unknown) =>
    mockSubscribeToNotifications(device, handlers),
}));

jest.mock('../../services/sync/syncBacklogToCompletion', () => ({
  syncBacklogToCompletion: (device: unknown, deviceBleId: string) =>
    mockSyncBacklogToCompletion(device, deviceBleId),
}));

jest.mock('../readings', () => ({
  useReadings: {
    getState: () => ({ syncPending: mockUseReadingsSync }),
  },
}));

jest.mock('../pairing', () => ({
  usePairing: {
    getState: () => ({
      pairedDevice: { bleId: 'AA:BB:CC:DD:E4:F2', macSuffix: 'e4f2', name: 'Leiko Watch', pairedAt: 0 },
    }),
  },
}));

jest.mock('../takeReading', () => ({
  useTakeReading: {
    getState: () => ({ phase: mockTakeReadingPhase.current }),
  },
}));

import { useSyncOrchestrator } from '../syncOrchestrator';

function fakeDevice(): unknown {
  return { disconnect: jest.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  useSyncOrchestrator.getState().reset();
  mockTakeReadingPhase.current = 'idle';
  mockConnectToUrion.mockResolvedValue(fakeDevice());
  mockSyncBacklogToCompletion.mockResolvedValue({
    totalPulled: 0,
    batches: 1,
    hitBatchCap: false,
    latestTimestampSec: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useSyncOrchestrator.runSync', () => {
  it('flushes pending writes, connects, runs the cursor loop, and goes live', async () => {
    const result = await useSyncOrchestrator.getState().runSync('cold_start');
    expect(result).toBe('ran');
    expect(mockUseReadingsSync).toHaveBeenCalledTimes(1);
    expect(mockConnectToUrion).toHaveBeenCalledWith('AA:BB:CC:DD:E4:F2');
    expect(mockSyncBacklogToCompletion).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToNotifications).toHaveBeenCalledTimes(1);
    expect(useSyncOrchestrator.getState().status).toBe('live');
    expect(useSyncOrchestrator.getState().lastError).toBeNull();
  });

  it('skips when take-reading is mid-flow (mutex)', async () => {
    mockTakeReadingPhase.current = 'waiting_for_watch';
    const result = await useSyncOrchestrator.getState().runSync('app_foreground');
    expect(result).toBe('skipped');
    expect(mockConnectToUrion).not.toHaveBeenCalled();
  });

  it('skips when a sync is already in flight', async () => {
    // Block the first sync mid-connect so we can race a second.
    let resolveConnect: ((value: unknown) => void) | null = null;
    mockConnectToUrion.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const first = useSyncOrchestrator.getState().runSync('cold_start');
    // Let the first run reach 'connecting'.
    await Promise.resolve();
    const second = await useSyncOrchestrator.getState().runSync('app_foreground');
    expect(second).toBe('skipped');
    if (resolveConnect) (resolveConnect as (v: unknown) => void)(fakeDevice());
    await first;
  });

  it('debounces back-to-back triggers within 5s, but manual_force bypasses', async () => {
    await useSyncOrchestrator.getState().runSync('cold_start');
    // Immediate second trigger → skipped (too_recent).
    const second = await useSyncOrchestrator.getState().runSync('app_foreground');
    expect(second).toBe('skipped');
    // Manual force ignores debounce.
    const third = await useSyncOrchestrator.getState().runSync('manual_force');
    expect(third).toBe('ran');
  });

  it('marks status=error and preserves lastSyncAt when connect fails', async () => {
    mockConnectToUrion.mockRejectedValueOnce(new Error('connect timeout'));
    const result = await useSyncOrchestrator.getState().runSync('manual_force');
    expect(result).toBe('ran');
    expect(useSyncOrchestrator.getState().status).toBe('error');
    expect(useSyncOrchestrator.getState().lastError).toBe('connect timeout');
    // lastSyncAt unchanged so the debounce doesn't gate the retry.
    expect(useSyncOrchestrator.getState().lastSyncAt).toBeNull();
  });

  it('marks no_paired_device runs as ran (pending flush still useful)', async () => {
    // Override the pairing mock for this test only.
    const pairingMod = jest.requireMock('../pairing') as {
      usePairing: { getState: () => { pairedDevice: unknown } };
    };
    const orig = pairingMod.usePairing.getState;
    pairingMod.usePairing.getState = () => ({ pairedDevice: null });
    try {
      const result = await useSyncOrchestrator.getState().runSync('cold_start');
      expect(result).toBe('ran');
      expect(mockConnectToUrion).not.toHaveBeenCalled();
      expect(useSyncOrchestrator.getState().lastSyncAt).not.toBeNull();
    } finally {
      pairingMod.usePairing.getState = orig;
    }
  });

  it('idle timer disconnects the device after IDLE_DISCONNECT_MS', async () => {
    const device = fakeDevice();
    mockConnectToUrion.mockResolvedValueOnce(device);
    await useSyncOrchestrator.getState().runSync('cold_start');
    expect(useSyncOrchestrator.getState().status).toBe('live');

    jest.advanceTimersByTime(45_000);
    // Idle timer fired: disconnect was called.
    expect((device as { disconnect: jest.Mock }).disconnect).toHaveBeenCalled();
    expect(useSyncOrchestrator.getState().status).toBe('idle');
  });
});
