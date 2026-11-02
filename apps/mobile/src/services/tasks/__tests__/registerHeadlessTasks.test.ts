// Guards the regression that made background sync a no-op on a cold
// wake: the task bodies must be defined without any component rendering,
// and nothing storage-dependent may be imported until the MMKV key is up.

const defineTask = jest.fn();
const isTaskDefined = jest.fn(() => false);

jest.mock(
  'expo-task-manager',
  () => ({ defineTask, isTaskDefined }),
  { virtual: true },
);
jest.mock(
  'expo-background-fetch',
  () => ({ BackgroundFetchResult: { NoData: 1, NewData: 2, Failed: 3 } }),
  { virtual: true },
);

import {
  BACKGROUND_SYNC_TASK,
  REMOTE_REFRESH_TASK,
} from '../taskNames';
import { registerHeadlessTasks } from '../registerHeadlessTasks';

describe('registerHeadlessTasks', () => {
  it('defines both OS tasks at import time, with no UI mounted', () => {
    registerHeadlessTasks();
    const names = defineTask.mock.calls.map((c) => c[0]);
    expect(names).toContain(BACKGROUND_SYNC_TASK);
    expect(names).toContain(REMOTE_REFRESH_TASK);
  });

  it('is idempotent — a second call does not redefine', () => {
    const before = defineTask.mock.calls.length;
    registerHeadlessTasks();
    expect(defineTask.mock.calls.length).toBe(before);
  });

  it('skips the run while a storage migration is pending', async () => {
    // Half-migrated store: better to do nothing and let the next app open
    // finish the migration than to read/write across both stores.
    jest.doMock('../../secureBoot', () => ({
      acquireMmkvKey: jest.fn(async () => ({ migrationStatus: 'pending' })),
      getCachedStatus: jest.fn(() => 'pending'),
    }));
    const runner = defineTask.mock.calls.find(
      (c) => c[0] === BACKGROUND_SYNC_TASK,
    )?.[1] as () => Promise<number>;
    await expect(runner()).resolves.toBe(1); // NoData
  });

  it('runs once the migration finished later in the same process (2026-10-31)', async () => {
    // Fresh install: the memoised acquire result still says 'pending',
    // but App.tsx has since completed the migration. The gate must read
    // the live status, or background sync skips until the app restarts.
    jest.resetModules();
    const runWatch = jest.fn(async () => 'ran');
    jest.doMock('../../secureBoot', () => ({
      acquireMmkvKey: jest.fn(async () => ({ migrationStatus: 'pending' })),
      getCachedStatus: jest.fn(() => 'completed'),
    }));
    jest.doMock('../../../state/hydrateForHeadlessRun', () => ({
      hydrateForHeadlessRun: jest.fn(),
      ensureSessionForHeadlessRun: jest.fn(async () => true),
    }));
    jest.doMock('../../../state/syncOrchestrator', () => ({
      useSyncOrchestrator: { getState: () => ({ runSync: runWatch }) },
    }));
    jest.doMock('../../ble/foregroundService', () => ({
      withBleForegroundService: (fn: () => Promise<unknown>) => fn(),
      ensureJsTimersHeld: jest.fn(async () => undefined),
    }));
    const runner = defineTask.mock.calls.find(
      (c) => c[0] === BACKGROUND_SYNC_TASK,
    )?.[1] as () => Promise<number>;
    await expect(runner()).resolves.toBe(2); // NewData
    expect(runWatch).toHaveBeenCalledWith('background');
  });

  it('holds the foreground service before the storage gate (2026-11-02)', async () => {
    // Play build 25: the freezer stopped every cold wake ~10 s in, while
    // the run was still booting JS and reading the keystore — before the
    // service started — so nothing uploaded. The hold must come first.
    jest.resetModules();
    const order: string[] = [];
    jest.doMock('../../secureBoot', () => ({
      acquireMmkvKey: jest.fn(async () => {
        order.push('acquire');
        return { migrationStatus: 'completed' };
      }),
      getCachedStatus: jest.fn(() => 'completed'),
    }));
    jest.doMock('../../../state/hydrateForHeadlessRun', () => ({
      hydrateForHeadlessRun: jest.fn(),
      ensureSessionForHeadlessRun: jest.fn(async () => true),
    }));
    jest.doMock('../../../state/syncOrchestrator', () => ({
      useSyncOrchestrator: {
        getState: () => ({ runSync: jest.fn(async () => (order.push('sync'), 'ran')) }),
      },
    }));
    jest.doMock('../../ble/foregroundService', () => ({
      withBleForegroundService: async (fn: () => Promise<unknown>) => {
        order.push('hold');
        try {
          return await fn();
        } finally {
          order.push('release');
        }
      },
      ensureJsTimersHeld: jest.fn(async () => undefined),
    }));
    const runner = defineTask.mock.calls.find(
      (c) => c[0] === BACKGROUND_SYNC_TASK,
    )?.[1] as () => Promise<number>;
    await expect(runner()).resolves.toBe(2); // NewData
    expect(order[0]).toBe('hold');
    expect(order.indexOf('acquire')).toBeGreaterThan(0);
    expect(order[order.length - 1]).toBe('release');
  });

  it('releases the hold when storage is not ready', async () => {
    jest.resetModules();
    const released = jest.fn();
    jest.doMock('../../secureBoot', () => ({
      acquireMmkvKey: jest.fn(async () => ({ migrationStatus: 'pending' })),
      getCachedStatus: jest.fn(() => 'pending'),
    }));
    jest.doMock('../../ble/foregroundService', () => ({
      withBleForegroundService: async (fn: () => Promise<unknown>) => {
        try {
          return await fn();
        } finally {
          released();
        }
      },
    }));
    const runner = defineTask.mock.calls.find(
      (c) => c[0] === BACKGROUND_SYNC_TASK,
    )?.[1] as () => Promise<number>;
    await expect(runner()).resolves.toBe(1); // NoData
    expect(released).toHaveBeenCalledTimes(1);
  });
});
