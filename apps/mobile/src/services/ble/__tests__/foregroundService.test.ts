// Coverage for the JS wrapper of the BLE foreground service.

// The mock factory is hoisted above all imports by jest, so the native
// stubs must be created inside it (referencing an outer `const` here
// would throw a temporal-dead-zone ReferenceError). We pull typed
// handles to them back out after the import below.
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: {
    LeikoBleForegroundService: {
      start: jest.fn().mockResolvedValue(true),
      stop: jest.fn().mockResolvedValue(true),
      holdJsTimers: jest.fn().mockResolvedValue(1),
      releaseJsTimers: jest.fn().mockResolvedValue(true),
    },
  },
}));

// logger pulls in storage + posthog, which reach for react-native
// internals the minimal mock above doesn't provide. The wrapper's
// behaviour under test is the native start/stop calls, not analytics,
// so stub the logger out entirely.
jest.mock('../../analytics/logger', () => ({
  logger: { track: jest.fn() },
}));

import { NativeModules, Platform } from 'react-native';
import {
  _resetBleForegroundServiceForTests,
  _resetBleForegroundServiceHoldsForTests,
  isBleForegroundServiceRunning,
  startBleForegroundService,
  stopBleForegroundService,
  withBleForegroundService,
} from '../foregroundService';

const mockStart = NativeModules.LeikoBleForegroundService.start as jest.Mock;
const mockStop = NativeModules.LeikoBleForegroundService.stop as jest.Mock;
const mockHold = NativeModules.LeikoBleForegroundService.holdJsTimers as jest.Mock;
const mockRelease = NativeModules.LeikoBleForegroundService.releaseJsTimers as jest.Mock;

beforeEach(() => {
  _resetBleForegroundServiceForTests();
  _resetBleForegroundServiceHoldsForTests();
  mockStart.mockClear();
  mockStop.mockClear();
  mockHold.mockClear();
  mockRelease.mockClear();
});

describe('ble foreground service wrapper', () => {
  it('starts the native service on android', async () => {
    await startBleForegroundService();
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(true);
  });

  it('start is idempotent — second call does nothing', async () => {
    await startBleForegroundService();
    await startBleForegroundService();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('stop is a no-op if not started', async () => {
    await stopBleForegroundService();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('start then stop calls both', async () => {
    await startBleForegroundService();
    await stopBleForegroundService();
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(false);
  });

  it('no-ops on iOS', async () => {
    (Platform as { OS: string }).OS = 'ios';
    await startBleForegroundService();
    expect(mockStart).not.toHaveBeenCalled();
    expect(isBleForegroundServiceRunning()).toBe(false);
    (Platform as { OS: string }).OS = 'android';
  });
});

describe('withBleForegroundService', () => {
  // Freezer exemption for headless sync runs: the service must be held
  // for exactly the duration of fn, and released only if this call was
  // the one that started it.

  it('starts before fn, stops after, and returns the result', async () => {
    const fn = jest.fn(async () => {
      expect(isBleForegroundServiceRunning()).toBe(true);
      return 'ran';
    });
    await expect(withBleForegroundService(fn)).resolves.toBe('ran');
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(false);
  });

  it('leaves the service running when a UI flow already owns it', async () => {
    await startBleForegroundService();
    mockStart.mockClear();
    await withBleForegroundService(async () => undefined);
    expect(mockStop).not.toHaveBeenCalled();
    expect(isBleForegroundServiceRunning()).toBe(true);
  });

  it('stops the service even when fn throws, and rethrows', async () => {
    await expect(
      withBleForegroundService(async () => {
        throw new Error('sync exploded');
      }),
    ).rejects.toThrow('sync exploded');
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(false);
  });

  it('still runs fn when the native start is denied', async () => {
    // Android 12+ denies background FGS starts for non-battery-exempt
    // apps (ForegroundServiceStartNotAllowedException). The sync must
    // degrade to the freezer-budget behaviour, not skip.
    mockStart.mockRejectedValueOnce(new Error('not allowed'));
    const fn = jest.fn(async () => 'ran');
    await expect(withBleForegroundService(fn)).resolves.toBe('ran');
    expect(fn).toHaveBeenCalledTimes(1);
    // Never started, so nothing to stop.
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('overlapping scopes release only when the LAST one exits', async () => {
    // The stale-reset handoff: run #1 hangs, run #2 claims the engine,
    // run #1's finally fires later. A boolean guard let run #1 stop the
    // service under run #2; the hold-count must not.
    let releaseA!: () => void;
    const gateA = new Promise<void>((r) => { releaseA = r; });
    let releaseB!: () => void;
    const gateB = new Promise<void>((r) => { releaseB = r; });
    const scopeA = withBleForegroundService(() => gateA);
    const scopeB = withBleForegroundService(() => gateB);
    releaseA();
    await scopeA;
    // Scope B still holds — the service must survive scope A's exit.
    expect(mockStop).not.toHaveBeenCalled();
    expect(isBleForegroundServiceRunning()).toBe(true);
    releaseB();
    await scopeB;
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(false);
  });

  it('a fresh scope-group re-evaluates UI ownership after a UI stop', async () => {
    // UI starts the service, a scope runs under it (leaves it alone),
    // the UI stops it — a later scope must own and release its own hold
    // rather than inherit the stale uiOwned latch and leak the service.
    await startBleForegroundService();
    await withBleForegroundService(async () => undefined);
    expect(mockStop).not.toHaveBeenCalled();
    await stopBleForegroundService();
    mockStart.mockClear();
    mockStop.mockClear();
    await withBleForegroundService(async () => undefined);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(isBleForegroundServiceRunning()).toBe(false);
  });
});


// 2026-10-29 — RN pauses JS timers in the background unless a headless
// task is active; that froze supabase-js's token refresh and every
// background upload behind it. The BLE service holds a keep-alive task.
describe('JS-timer keep-alive', () => {
  it('holds JS timers when the service starts', async () => {
    await startBleForegroundService();
    expect(mockHold).toHaveBeenCalledTimes(1);
  });

  it('releases JS timers before the service stops', async () => {
    await startBleForegroundService();
    await stopBleForegroundService();
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(mockRelease.mock.invocationCallOrder[0]).toBeLessThan(
      mockStop.mock.invocationCallOrder[0],
    );
  });

  it('a failed hold does not stop the service from running', async () => {
    mockHold.mockRejectedValueOnce(new Error('no react context'));
    await startBleForegroundService();
    expect(isBleForegroundServiceRunning()).toBe(true);
  });
});
