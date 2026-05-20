// hooks/useParentVitalsRecent — Sprint 17a.
//
// Sibling to `useParentDailyPulseData`. Returns the per-vital recent
// arrays (BP / HR / SpO2 / sleep / steps / calories) that the
// parameterized VitalDetail screens iterate. Shares the
// `['parent-pulse', familyId]` cache key so both hooks hit one
// round-trip per mount.
//
// Consumer pattern (in a parameterized VitalDetail screen):
//   const { data } = useParentVitalsRecent(familyId);
//   const recentBP = data.readings;
//
// The screens currently read singleton slices via `useReadings`,
// `useHR`, etc. — when `familyId` is supplied they swap to this
// hook's arrays. Same shape so the swap is trivial.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import {
  fetchParentPulseData,
  type ParentPulseFetchResult,
  type ParentVitalsRecent,
} from '../services/families/fetchParentPulseData';
import { parentPulseQueryKey } from './useParentDailyPulseData';

const STALE_TIME_MS = 30_000;

const EMPTY_RECENT: ParentVitalsRecent = {
  readings: [],
  hr: [],
  spo2: [],
  sleep: [],
  steps: [],
  calories: [],
};

export interface UseParentVitalsRecentResult {
  data: ParentVitalsRecent;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useParentVitalsRecent(
  familyId: string | null,
): UseParentVitalsRecentResult {
  const query = useQuery<ParentPulseFetchResult>({
    queryKey: parentPulseQueryKey(familyId),
    enabled: !!familyId,
    queryFn: () => {
      if (!familyId) {
        throw new Error('familyId required');
      }
      return fetchParentPulseData(supabase, familyId);
    },
    staleTime: STALE_TIME_MS,
  });
  return {
    data: query.data?.recent ?? EMPTY_RECENT,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: (query.error as Error | null) ?? null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
