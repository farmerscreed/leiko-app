// hooks/useParentDailyPulseData — Sprint 17a.
//
// TanStack Query wrapper around `fetchParentPulseData`. Returns the
// `DailyPulseData` slice of the result (the shape ParentDashboard and
// the parameterized VitalDetail screens consume).
//
// Cache key: `['parent-pulse', familyId]`. Shared with
// `useParentVitalsRecent` so the two hooks share one round-trip per
// (familyId, mount) — both select different slices of the same
// cached result.
//
// Realtime invalidation lives in `useParentPulseRealtime` (mounted by
// `ParentDashboard`); see B3.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import {
  fetchParentPulseData,
  type ParentPulseFetchResult,
} from '../services/families/fetchParentPulseData';
import type { DailyPulseData } from '../state/dailyPulse';

const STALE_TIME_MS = 30_000;

export function parentPulseQueryKey(familyId: string | null) {
  return ['parent-pulse', familyId ?? ''] as const;
}

export interface UseParentDailyPulseDataResult {
  /** null while loading or when no familyId is supplied. */
  data: DailyPulseData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useParentDailyPulseData(
  familyId: string | null,
): UseParentDailyPulseDataResult {
  const query = useQuery<ParentPulseFetchResult>({
    queryKey: parentPulseQueryKey(familyId),
    enabled: !!familyId,
    queryFn: () => {
      if (!familyId) {
        // useQuery's `enabled: false` guarantees this branch never
        // runs in practice; the throw keeps the type signature honest.
        throw new Error('familyId required');
      }
      return fetchParentPulseData(supabase, familyId);
    },
    staleTime: STALE_TIME_MS,
  });
  return {
    data: query.data?.pulse ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: (query.error as Error | null) ?? null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
