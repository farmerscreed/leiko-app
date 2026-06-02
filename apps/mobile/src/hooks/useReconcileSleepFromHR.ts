// hooks/useReconcileSleepFromHR — Sprint 18.
//
// Backfills HR-derived wake times across stored sleep sessions whose
// `wakeSource` is missing or 'fallback'. Runs after the SleepDetail
// + Home screens mount (which is when both `useSleep` and `useHR`
// have been hydrated from MMKV + topped up from the server).
//
// Pattern mirrors `useHydrateSleepFromServer`: fire-and-forget,
// idempotent, cheap to re-run because `reconcileWakeSources` is a
// no-op for sessions already pinned to 'hr_inferred'. The hook re-runs
// when either slice's `recent.length` or `pending.length` changes, so
// freshly-arrived HR samples trigger a retry.
//
// Why a hook (not just a one-shot at boot): HR samples drift into the
// slice across multiple BLE sync rounds — the very first ingest of a
// new sleep session may happen before tonight's HR samples are in the
// slice. The reconcile needs to re-run as more HR data lands. Keeping
// it as a hook driven off state subscriptions handles this naturally.

import { useEffect } from 'react';
import { useSleep } from '../state/sleep';
import { useHR } from '../state/hr';
import { useUserTz } from '../utils/userTz';

export function useReconcileSleepFromHR(): void {
  const tz = useUserTz();
  // Subscribe to the lengths only — the reconcile body reads the
  // full arrays via getState() to avoid re-running on every sample
  // mutation. The lengths advance whenever a real new sample lands.
  const sleepCount = useSleep((s) => s.recent.length + s.pending.length);
  const hrCount = useHR((s) => s.recent.length + s.pending.length);

  useEffect(() => {
    if (!tz) return;
    if (sleepCount === 0) return;
    // No point reconciling if HR is empty — every call would just
    // tag everything as 'fallback'. Wait for HR to arrive.
    if (hrCount === 0) return;
    const hr = useHR.getState();
    const samples = [...hr.pending, ...hr.recent];
    useSleep.getState().reconcileWakeSources(samples, tz);
  }, [tz, sleepCount, hrCount]);
}
