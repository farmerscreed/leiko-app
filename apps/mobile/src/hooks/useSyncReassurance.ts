// useSyncReassurance — Sprint 16.
//
// Polls the failure-tracker once a minute and returns whether the
// current failure streak has crossed the 24h threshold (per the
// sprint card AC: "After 24h of failed /sync, calm reassurance
// banner"). The banner consumer renders only when this returns true.
//
// Why polling vs. event subscription: MMKV doesn't expose change
// events, and the orchestrator writes to it from outside React's
// render cycle. A 1-minute poll is well under the 24h threshold's
// resolution and costs nothing relative to render budgets.

import { useEffect, useState } from 'react';
import { getLastSyncFailedAt } from '../services/sync/syncFailureTracker';

export const REASSURANCE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 60_000;

export function useSyncReassurance(
  nowProvider: () => number = Date.now,
  pollIntervalMs: number = POLL_INTERVAL_MS,
): boolean {
  const [showBanner, setShowBanner] = useState<boolean>(() =>
    computeShouldShow(nowProvider()),
  );

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      setShowBanner(computeShouldShow(nowProvider()));
    };
    tick();
    const interval = setInterval(tick, pollIntervalMs);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [nowProvider, pollIntervalMs]);

  return showBanner;
}

export function computeShouldShow(nowMs: number): boolean {
  const failedAt = getLastSyncFailedAt();
  if (failedAt === null) return false;
  return nowMs - failedAt >= REASSURANCE_THRESHOLD_MS;
}
