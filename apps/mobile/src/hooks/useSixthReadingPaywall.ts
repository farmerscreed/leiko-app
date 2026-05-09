// useSixthReadingPaywall — Sprint 10a auto-paywall trigger.
//
// Per D8a §9.1 + docs/09-paywall-and-iap.md §3:
//   "Paywall fires on the 6th reading per identity, OR on tapping a
//    paywalled feature."
//   "Auto-fires once per family per month."
//
// Implementation:
//   • Count readings (synced + pending) within the current calendar
//     month. Source = the readings store's pending + recent arrays;
//     the recent buffer caps at 60 rows which is well above 6.
//   • Compare against MMKV-persisted `leiko.paywall.sixthReading.<familyId>`
//     which stores the YYYY-MM the trigger was last shown for that
//     family. A new month invalidates the flag and the trigger may
//     fire again.
//   • Plus / trial / grace users skip the trigger — there's nothing to
//     upsell.
//
// Mounting:
//   The hook returns `{ visible, dismiss }`. Home screens render a
//   PaywallSheet bound to those values. Dismiss is final for the
//   current month: tapping "Maybe later" or completing a purchase
//   both write the flag forward.

import { useCallback, useEffect, useState } from 'react';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { useReadings } from '../state/readings';
import { usePlusEntitlement } from './usePlusEntitlement';

const FREE_MONTHLY_READING_THRESHOLD = 6;

function flagKey(familyId: string): string {
  return `${STORAGE_KEYS.sixthReadingShown}.${familyId}`;
}

function currentMonthKey(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function readingsThisMonth(
  capturedAtMsList: number[],
  now: Date = new Date(),
): number {
  const startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return capturedAtMsList.filter((ms) => ms >= startMs).length;
}

export interface SixthReadingPaywall {
  visible: boolean;
  dismiss: () => void;
}

/**
 * Drives the 6th-reading auto-paywall surface for a single family.
 * Pass the active family_id (Trends's parents[0]?.familyId pattern).
 * Pass null to disable (e.g., before a family is created in onboarding).
 */
export function useSixthReadingPaywall(familyId: string | null): SixthReadingPaywall {
  const { isPlus } = usePlusEntitlement();
  const pendingCount = useReadings((s) => s.pending.length);
  const recentCount = useReadings((s) => s.recent.length);
  const pendingTimes = useReadings((s) => s.pending);
  const recentTimes = useReadings((s) => s.recent);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!familyId || isPlus) {
      setVisible(false);
      return;
    }
    const flag = mmkv.getString(flagKey(familyId));
    const month = currentMonthKey();
    if (flag === month) {
      // Already shown this month — don't reopen on every readings tick.
      return;
    }
    const all = [
      ...pendingTimes.map((r) => r.capturedAtMs),
      ...recentTimes.map((r) => r.capturedAtMs),
    ];
    const monthCount = readingsThisMonth(all);
    if (monthCount >= FREE_MONTHLY_READING_THRESHOLD) {
      setVisible(true);
    }
    // pendingCount + recentCount are tracked in the deps so this re-runs
    // on each readings change. We read the times themselves from the
    // store snapshot above to avoid re-creating the array on every
    // selector hit.
  }, [familyId, isPlus, pendingCount, recentCount, pendingTimes, recentTimes]);

  const dismiss = useCallback(() => {
    if (familyId) {
      mmkv.set(flagKey(familyId), currentMonthKey());
    }
    setVisible(false);
  }, [familyId]);

  return { visible, dismiss };
}

// Test surface — exported so unit tests can assert the pure helpers
// without booting the hook.
export const _testHelpers = {
  currentMonthKey,
  readingsThisMonth,
  flagKey,
  FREE_MONTHLY_READING_THRESHOLD,
};
