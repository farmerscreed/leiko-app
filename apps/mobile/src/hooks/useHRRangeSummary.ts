// hooks/useHRRangeSummary — vitals data-completeness fix (Stage 2).
//
// Backs HRDetail's range-driven surfaces (zones, per-night resting →
// baseline + sleep×HR correlation, per-day stats) with server-computed
// aggregates over the selected 7d/30d/90d window, via the
// `hr_range_summary` RPC (migration 0030). This sidesteps the local HR
// slice's 200-sample (~16h) cap, which made every range render the same
// ~16h of data.
//
// Why a server RPC just for HR: HR is the only vital dense enough
// (~26k rows over 90d at the 5-min cadence) that pulling the raw window
// to the device is impractical. BP/SpO2/sleep/activity are small and use
// direct date-windowed selects instead.
//
// Offline: React Query holds an in-memory cache only (per RootNavigator —
// MMKV is the offline source of truth). When the query has no data
// (offline / loading / error), the caller falls back to computing from
// the local slice — HRDetail keeps that path for the hero + "today"
// surfaces regardless, so the screen still functions with no network.
//
// `familyId` is resolved by the caller: the tapped parent's id on the
// caregiver path, or the signed-in user's own family
// (useOnboarding(s => s.familyId)) on the self-buyer path.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuth } from '../state/auth';
import type { TrendRange } from '../components/TimeRangePills';
import type { HrRangeSummary } from '../types/database';

const RANGE_TO_DAYS: Record<TrendRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STALE_TIME_MS = 60_000;

export function hrRangeSummaryQueryKey(
  familyId: string | null,
  range: TrendRange,
): readonly [string, string | null, TrendRange] {
  return ['hr-range-summary', familyId, range] as const;
}

export interface UseHRRangeSummaryResult {
  data: HrRangeSummary | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useHRRangeSummary(
  familyId: string | null,
  range: TrendRange,
): UseHRRangeSummaryResult {
  const timezone = useAuth((s) => s.profile?.timezone ?? null);

  const query = useQuery<HrRangeSummary>({
    queryKey: hrRangeSummaryQueryKey(familyId, range),
    enabled: !!familyId,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      if (!familyId) {
        throw new Error('familyId required');
      }
      const nowMs = Date.now();
      const fromMs = nowMs - RANGE_TO_DAYS[range] * MS_PER_DAY;
      const { data, error } = await supabase.rpc('hr_range_summary', {
        _family_id: familyId,
        _tz: timezone ?? 'UTC',
        _from: new Date(fromMs).toISOString(),
        _to: new Date(nowMs).toISOString(),
      });
      if (error) {
        throw error;
      }
      return data as HrRangeSummary;
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: (query.error as Error | null) ?? null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
