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
  isBleForegroundServiceRunning,
  startBleForegroundService,
  stopBleForegroundService,
} from '../foregroundService';

const mockStart = NativeModules.LeikoBleForegroundService.start as jest.Mock;
const mockStop = NativeModules.LeikoBleForegroundService.stop as jest.Mock;

beforeEach(() => {
  _resetBleForegroundServiceForTests();
  mockStart.mockClear();
  mockStop.mockClear();
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
