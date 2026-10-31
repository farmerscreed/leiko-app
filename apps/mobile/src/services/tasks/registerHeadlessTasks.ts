// Define the OS-woken tasks at app entry, where they are always reached.
//
// Why this module exists
// ----------------------
// A background wake-up gets a bare JS context: index.js evaluates and the
// task runs, but no component ever renders. App.tsx therefore never runs
// its effect, never dynamic-imports PostBootShell, and RootNavigator's
// module scope never executes. Registering the tasks there meant that on
// a truly cold wake the task was simply not defined in JS — TaskManager
// asked for a runner that did not exist and nothing happened.
//
// Confirmed on-device 2026-08-14 (Pixel 8, Android 17): after `am kill`,
// the fetch fired at 20:55:42, React Native and Sentry initialised
// ("currentActivity isn't available"), and then nothing — no BLE
// connection, no analytics. Every background sync that HAD worked ran in
// a process that still had the UI loaded from an earlier app open, which
// is why the gap stayed hidden. It covers the cases the feature exists
// for: after a reboot, after the OS reclaims the process, overnight.
//
// SEC-1 ordering
// --------------
// services/storage reads the MMKV key at module evaluation, so nothing
// storage-dependent may be imported until acquireMmkvKey() has resolved.
// This module keeps its static imports to task names plus the two Expo
// packages, and pulls everything else in with dynamic import INSIDE the
// task body, after the key is acquired — the same contract App.tsx
// follows, stated explicitly rather than implied by file placement.
//
// A pending migration is left alone: we skip the run rather than operate
// on a half-migrated store, and the next app open completes it.

import { AppRegistry, Platform } from 'react-native';
import { BACKGROUND_SYNC_TASK, KEEP_TIMERS_TASK, REMOTE_REFRESH_TASK } from './taskNames';

type TaskResult = 'ran' | 'skipped' | 'errored';

interface BackgroundFetchModule {
  BackgroundFetchResult: { NoData: number; NewData: number; Failed: number };
}
interface TaskManagerModule {
  defineTask: (name: string, runner: (body: { data?: unknown; error?: unknown }) => unknown) => void;
  isTaskDefined: (name: string) => boolean;
}

function load(): { tm: TaskManagerModule | null; bg: BackgroundFetchModule | null } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tm = require('expo-task-manager') as TaskManagerModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bg = require('expo-background-fetch') as BackgroundFetchModule;
    return { tm, bg };
  } catch {
    // JS workspace / jest — no native side. Nothing to define.
    return { tm: null, bg: null };
  }
}

/**
 * Acquire the MMKV key so storage-dependent modules can be imported.
 * Returns false when the store is mid-migration and this run should be
 * skipped entirely.
 */
async function storageReady(): Promise<boolean> {
  const { acquireMmkvKey } = await import('../secureBoot');
  const boot = await acquireMmkvKey();
  return boot.migrationStatus !== 'pending';
}

/** Run the watch sync. Every import here is deferred past storageReady(). */
async function runWatchSync(): Promise<TaskResult> {
  const { hydrateForHeadlessRun, ensureSessionForHeadlessRun } = await import(
    '../../state/hydrateForHeadlessRun'
  );
  const { useSyncOrchestrator } = await import('../../state/syncOrchestrator');
  const { withBleForegroundService, ensureJsTimersHeld } = await import('../ble/foregroundService');
  hydrateForHeadlessRun();
  await ensureJsTimersHeld();
  const t0 = Date.now();
  // Awaited BEFORE the run so uploads have a live token. A cold headless
  // process has not finished recovering its session from secure storage,
  // and nothing refreshes an expired one — every upload 401s while the
  // watch reads succeed, which is exactly what 2026-08-15 looked like.
  // Best-effort: a false here still lets the run pull and persist.
  const sessionOk = await ensureSessionForHeadlessRun();
  bgLog(`session ok=${sessionOk} in ${Date.now() - t0}ms`);
  try {
    // Hold the foreground service for the run: the cached-app freezer
    // otherwise stops this process 9–18 s after the wake, which starves
    // the vitals leg (see withBleForegroundService). A denied start
    // degrades to today's behaviour; it never throws.
    const result = await withBleForegroundService(() =>
      useSyncOrchestrator.getState().runSync('background'),
    );
    return result === 'ran' ? 'ran' : 'skipped';
  } catch (e) {
    bgLog(`run threw ${e instanceof Error ? e.message.slice(0, 80) : 'unknown'}`);
    return 'errored';
  }
}

function bgLog(message: string): void {
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return;
  console.log(`[leiko-bg] ${message}`);
}

/** Does a JS timer fire in this context? Races a 1 s setTimeout against a
 *  3 s native (OS-driven) delay. "paused" means every JS timer — auth
 *  refresh back-off, fetch abort — is frozen here. */
async function probeJsTimers(): Promise<void> {
  try {
    const { headlessDelay } = await import('../ble/headlessDelay');
    const fired = await Promise.race([
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1000)),
      headlessDelay(3000).then(() => false),
    ]);
    bgLog(`js timers ${fired ? 'running' : 'PAUSED'}`);
  } catch {
    /* diagnostics only */
  }
}

async function track(result: TaskResult): Promise<void> {
  try {
    const { logger } = await import('../analytics/logger');
    logger.track('background_sync_fired', { result });
  } catch {
    // telemetry must never fail the task
  }
}

let registered = false;

/**
 * Idempotent. Called from index.js at entry so it runs in every context —
 * headless wake-up and normal launch alike.
 */
export function registerHeadlessTasks(): void {
  if (registered) return;
  registered = true;

  // Keep-alive for JS timers (2026-10-29). The native BLE service starts
  // this task and finishes it on stop; while it is active React Native
  // keeps firing setTimeout/setInterval even with the app backgrounded.
  // The promise deliberately never settles — native owns its lifetime.
  // Guarded: a failure here must never stop the OS tasks below from
  // being defined.
  if (Platform?.OS === 'android' && typeof AppRegistry?.registerHeadlessTask === 'function') {
    try {
      AppRegistry.registerHeadlessTask(KEEP_TIMERS_TASK, () => () => new Promise<void>(() => {}));
    } catch {
      /* already registered (fast refresh) or unavailable */
    }
  }

  const { tm, bg } = load();
  if (!tm || !bg) return;

  if (!tm.isTaskDefined(BACKGROUND_SYNC_TASK)) {
    tm.defineTask(BACKGROUND_SYNC_TASK, async () => {
      // 2026-10-30 release audit: background runs on a fresh install read
      // the watch but never uploaded, and release builds had no way to say
      // why. These breadcrumbs (labels and timings only) reach logcat as
      // ReactNativeJS "[leiko-bg]" lines.
      bgLog('task fired');
      void probeJsTimers();
      try {
        if (!(await storageReady())) {
          bgLog('storage not ready — skipped');
          return bg.BackgroundFetchResult.NoData;
        }
        const result = await runWatchSync();
        bgLog(`task result=${result}`);
        await track(result);
        if (result === 'ran') return bg.BackgroundFetchResult.NewData;
        if (result === 'errored') return bg.BackgroundFetchResult.Failed;
        return bg.BackgroundFetchResult.NoData;
      } catch {
        // A throw here would leave the OS with no result at all; report a
        // failure so it schedules a shorter retry.
        return bg.BackgroundFetchResult.Failed;
      }
    });
  }

  if (!tm.isTaskDefined(REMOTE_REFRESH_TASK)) {
    tm.defineTask(REMOTE_REFRESH_TASK, async ({ data, error }) => {
      if (error) return;
      try {
        if (!(await storageReady())) return;
        const mod = await import('../notifications/remoteRefreshTask');
        if (!mod.isRemoteRefreshData(data)) return;
        await mod.triggerRemoteRefresh('background');
      } catch {
        // Same rationale as above: never throw out of a task body.
      }
    });
  }
}
