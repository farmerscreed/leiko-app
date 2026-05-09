// AppState-driven trigger for the external-vitals read pipeline —
// Sprint 9.5 / Task 7.
//
// Strategy: foreground-on-app-open + 24h internal debounce in
// readExternal.runExternalVitalsFetch(). Every time the app transitions
// from background/inactive → active, we fire the read; the debounce
// silently absorbs anything inside the 24h window. As long as the user
// opens Leiko at least once a day (a reasonable assumption for a daily-
// use BP tracker), the "within 24h" SLA from the Sprint 9.5 acceptance
// criteria holds without registering an OS-level background task.
//
// expo-background-fetch (true OS-scheduled background fetch) is a v1.1
// enhancement — it would let us fire the read even when the user
// hasn't opened the app for 24h. Documented in the Sprint 9.5 close-
// out follow-ups. The structure here makes adding it trivial: a single
// new caller of runExternalVitalsFetch('background').
//
// Wired from RootNavigator.tsx alongside startOrchestrator(). Returns
// a teardown the navigator's effect-cleanup runs on unmount.

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { logger } from '../analytics/logger';
import { runExternalVitalsFetch } from './readExternal';

let _sub: NativeEventSubscription | null = null;
let _lastAppState: AppStateStatus | null = null;
let _started = false;

export function startHealthPlatformBackgroundFetch(): void {
  if (_started) return;
  _started = true;

  // Fire once on cold-start so the very first app open after install
  // (or after a 24h+ gap) always attempts the fetch. The debounce
  // makes this safe to call freely.
  void fireFetch('foreground').catch(() => {
    // already logged inside; never bubble
  });

  _sub = AppState.addEventListener('change', (next: AppStateStatus) => {
    const prev = _lastAppState;
    _lastAppState = next;
    if (next === 'active' && prev !== null && prev !== 'active') {
      void fireFetch('foreground').catch(() => {});
    }
  });
  _lastAppState = AppState.currentState;
}

export function stopHealthPlatformBackgroundFetch(): void {
  if (_sub) {
    _sub.remove();
    _sub = null;
  }
  _started = false;
  _lastAppState = null;
}

async function fireFetch(trigger: 'foreground' | 'manual' | 'background'): Promise<void> {
  const result = await runExternalVitalsFetch(trigger);
  if (result.ran) {
    // result already log-emitted inside runExternalVitalsFetch on
    // success / failure paths; no double-log here.
    return;
  }
  // Skipped — counts only telemetry. Reasons help debug the gating
  // (no-toggles, debounce hit, no profile).
  logger.track('health_platform_read_skipped', {
    trigger,
    reason: result.reason ?? 'unknown',
  });
}

// ---- test-only --------------------------------------------------------

export function __resetForTest(): void {
  stopHealthPlatformBackgroundFetch();
}
