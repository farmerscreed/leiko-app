// hooks/useVitalHistory — TanStack wrappers for services/vitalHistory.
//
// `useVitalHistory` pages the full server window for the VitalHistory
// screen (infinite scroll). `useVitalHistoryCount` is the lightweight
// head-count behind the "View all · N" link on the detail screens — it
// shows the TRUE window total even though the local list is capped.
//
// Online-only by design (mirrors the caregiver fetch contract): offline,
// the detail screens' capped local slices remain the view; this history
// is a browse-everything surface, not the offline source of truth.

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import type { TrendRange } from '../components/TimeRangePills';
import {
  HISTORY_PAGE_SIZE,
  countVitalHistory,
  fetchVitalHistoryPage,
  historyFromIso,
  type VitalHistoryKind,
  type VitalHistoryPage,
  type VitalHistoryRow,
} from '../services/vitalHistory';

export interface UseVitalHistoryResult {
  rows: VitalHistoryRow[];
  /** Exact window total (from page 0); null while loading. */
  totalCount: number | null;
  isLoading: boolean;
  isFetchingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

export function useVitalHistory(
  kind: VitalHistoryKind,
  familyId: string | null,
  range: TrendRange,
): UseVitalHistoryResult {
  const query = useInfiniteQuery<VitalHistoryPage>({
    queryKey: ['vital-history', kind, familyId, range],
    enabled: !!familyId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      if (!familyId) throw new Error('familyId required');
      return fetchVitalHistoryPage(
        supabase,
        kind,
        familyId,
        historyFromIso(range),
        pageParam as number,
      );
    },
    getNextPageParam: (lastPage, pages) =>
      lastPage.rows.length < HISTORY_PAGE_SIZE ? undefined : pages.length,
    staleTime: 30_000,
  });

  const rows = query.data?.pages.flatMap((p) => p.rows) ?? [];
  return {
    rows,
    totalCount: query.data?.pages[0]?.totalCount ?? null,
    isLoading: query.isLoading,
    isFetchingMore: query.isFetchingNextPage,
    error: (query.error as Error | null) ?? null,
    hasMore: query.hasNextPage ?? false,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refresh: async () => {
      await query.refetch();
    },
  };
}

export function useVitalHistoryCount(
  kind: VitalHistoryKind,
  familyId: string | null,
  range: TrendRange,
): number | null {
  const query = useQuery<number>({
    queryKey: ['vital-history-count', kind, familyId, range],
    enabled: !!familyId,
    queryFn: () => {
      if (!familyId) throw new Error('familyId required');
      return countVitalHistory(supabase, kind, familyId, historyFromIso(range));
    },
    staleTime: 30_000,
  });
  return query.data ?? null;
}
