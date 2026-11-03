// realtimeBatch — coalesce bursts of Supabase Realtime events (2026-11-03).
//
// One watch sync inserts hundreds of vitals_other rows (an HR sample every
// few minutes), and every INSERT reached the Home screens as its own
// realtime event: one full refetch + one analytics event each. In the
// background that kept the JS thread busy after every sync — Android
// killed the cached process for excessive CPU (8.8 s in 5 min, 11-02).
//
// A batcher turns a burst into ONE flush, `delayMs` after the last event,
// and only while the app is on screen. Events that arrive in the
// background mark it dirty; the flush runs once on the next 'active'.

import { AppState, type AppStateStatus } from 'react-native';

export const REALTIME_BATCH_DELAY_MS = 1_500;

export interface RealtimeBatcher {
  /** Call from the realtime callback. Cheap; never flushes synchronously. */
  notify(): void;
  /** Stop timers and the AppState listener (effect cleanup). */
  dispose(): void;
}

export function createRealtimeBatcher(
  onFlush: (eventCount: number) => void,
  delayMs: number = REALTIME_BATCH_DELAY_MS,
): RealtimeBatcher {
  let count = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const isActive = (state: AppStateStatus | null = AppState.currentState) =>
    state === 'active' || state == null || state === 'unknown';

  const flush = () => {
    timer = null;
    if (disposed || count === 0) return;
    if (!isActive()) return; // stays dirty until the app comes back
    const n = count;
    count = 0;
    onFlush(n);
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  };

  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active' && count > 0 && !disposed) schedule();
  });

  return {
    notify() {
      if (disposed) return;
      count += 1;
      // Background: no timer at all — nothing wakes the JS thread.
      if (isActive()) schedule();
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      sub.remove();
    },
  };
}
