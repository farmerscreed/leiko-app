// useRemoteRefreshNudge — silent-first remote refresh, human-confirmed
// visible fallback.
//
// When a caregiver pulls to refresh we fire a SILENT push (the wearer's
// phone syncs invisibly when it can). Android does not reliably deliver
// silent pushes to a backgrounded/Doze phone, so this hook watches for
// fresh data to land; if none arrives within the wait window, it surfaces a
// calm "Send a reminder" affordance. Only the caregiver's deliberate tap
// sends the VISIBLE 'sync_nudge' — so the wearer is never nagged on a false
// positive (e.g. they simply hadn't taken a new reading).
//
//   idle ── beginWaiting() ──► waiting ── fresh data ──► idle
//                                 │
//                            wait elapsed
//                                 ▼
//                               offer ── sendReminder() ──► sent
//                                 │                           │
//                            fresh data ──────────────────────┴──► idle
//
// `freshDataSignal` is a monotonically-increasing counter the screen bumps
// whenever new readings/vitals land (its Realtime INSERT subscription).

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestRemoteRefresh } from '../../services/sync/requestRemoteRefresh';

export type RemoteRefreshNudgeState = 'idle' | 'waiting' | 'offer' | 'sent';

export interface UseRemoteRefreshNudgeParams {
  familyId: string;
  /** Increments whenever fresh data arrives for this family. */
  freshDataSignal: number;
  /** How long to wait for fresh data before offering the reminder. */
  waitMs?: number;
}

export interface RemoteRefreshNudge {
  state: RemoteRefreshNudgeState;
  /** Call right after firing the silent refresh request. */
  beginWaiting: () => void;
  /** Caregiver tapped "Send a reminder" → send the visible nudge. */
  sendReminder: () => void;
}

const DEFAULT_WAIT_MS = 20_000;

export function useRemoteRefreshNudge({
  familyId,
  freshDataSignal,
  waitMs = DEFAULT_WAIT_MS,
}: UseRemoteRefreshNudgeParams): RemoteRefreshNudge {
  const [state, setState] = useState<RemoteRefreshNudgeState>('idle');
  // The fresh-data counter value captured when we started waiting; any
  // change past it means new data landed.
  const baselineRef = useRef<number>(freshDataSignal);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of `state` for use inside callbacks/effects without re-subscribing.
  const stateRef = useRef<RemoteRefreshNudgeState>('idle');
  stateRef.current = state;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const beginWaiting = useCallback(() => {
    baselineRef.current = freshDataSignal;
    clearTimer();
    setState('waiting');
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // Only advance to the offer if we're still waiting (fresh data could
      // have already resolved it).
      if (stateRef.current === 'waiting') setState('offer');
    }, waitMs);
  }, [freshDataSignal, waitMs, clearTimer]);

  const sendReminder = useCallback(() => {
    clearTimer();
    setState('sent');
    void requestRemoteRefresh(familyId, { escalate: true });
  }, [familyId, clearTimer]);

  // Fresh data arrived → the sync worked; clear any pending offer/reminder.
  useEffect(() => {
    if (state === 'idle') return;
    if (freshDataSignal !== baselineRef.current) {
      clearTimer();
      setState('idle');
    }
  }, [freshDataSignal, state, clearTimer]);

  // A different family is in view → reset. Intentionally keyed on familyId
  // ONLY: re-running on freshDataSignal would re-baseline mid-wait and
  // defeat the silent-sync detection. clearTimer is a stable callback.
  useEffect(() => {
    clearTimer();
    setState('idle');
    baselineRef.current = freshDataSignal;
  }, [familyId]);

  // Unmount cleanup.
  useEffect(() => clearTimer, [clearTimer]);

  return { state, beginWaiting, sendReminder };
}
