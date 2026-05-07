// Sprint 7 — caregiver-home query + Realtime subscription.
//
// On the OWNING phone the sync orchestrator pulls from the watch and
// posts to /sync, which inserts into public.readings. On every other
// signed-in caregiver phone (intent memo §2 — "Caregiver mode, parent
// in another city, parent installed Leiko"), this hook is the read
// path. TanStack Query owns the cache; Supabase Realtime invalidates
// it on insert so the home re-renders without polling.
//
// Hook returns:
//   parents       — ParentSummary[] (one per family the user is in)
//   isLoading     — first fetch
//   isRefreshing  — pull-to-refresh in flight
//   error         — last error (Query swallows transient ones via retry)
//   refresh       — manual refresh trigger (orchestrator + invalidate)
//
// MMKV-backed local readings (state/readings.ts) remain the offline
// source of truth for the OWNING phone; this hook supplements them
// for the cross-phone case. Sprint 8 (self-buyer home) reuses the
// same hook with a different consumer shape.

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { fetchParentSummaries, type ParentSummary } from '../services/families/fetchParentSummaries';
import { useAuth } from '../state/auth';
import { useSyncOrchestrator } from '../state/syncOrchestrator';
import { logger } from '../services/analytics/logger';

const QUERY_KEY = ['family-readings'] as const;

export interface UseFamilyReadingsResult {
  parents: ParentSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  /** Pull-to-refresh: kicks the orchestrator + invalidates the query. */
  refresh: () => Promise<void>;
}

export function useFamilyReadings(): UseFamilyReadingsResult {
  const userId = useAuth((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const forceSync = useSyncOrchestrator((s) => s.runSync);

  const queryKey = useMemo(() => [...QUERY_KEY, userId] as const, [userId]);

  const query = useQuery({
    queryKey,
    enabled: userId !== null,
    queryFn: () => {
      if (!userId) return Promise.resolve<ParentSummary[]>([]);
      return fetchParentSummaries(supabase, userId);
    },
  });

  // Realtime subscription — one channel per family the user is a
  // member of. INSERT on public.readings invalidates the query, which
  // refetches and refreshes the ParentSummary list. Unsubscribe on
  // unmount or when the family list changes.
  const familyIds = useMemo(
    () => (query.data ?? []).map((p) => p.familyId).sort(),
    [query.data],
  );
  const familyIdsKey = familyIds.join(',');

  useEffect(() => {
    if (!userId || familyIds.length === 0) return;
    const channels = familyIds.map((familyId) => {
      const channel = supabase
        .channel(`readings:${familyId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'readings',
            filter: `family_id=eq.${familyId}`,
          },
          () => {
            logger.track('reading_realtime_received', { familyId });
            void queryClient.invalidateQueries({ queryKey });
          },
        )
        .subscribe();
      return channel;
    });
    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
    // queryKey + queryClient + familyIds are derived from userId +
    // familyIdsKey; this dep list is intentionally narrowed to those
    // keys to avoid re-subscribing on every parents render.
  }, [userId, familyIdsKey, familyIds, queryClient, queryKey]);

  return {
    parents: query.data ?? [],
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: (query.error as Error | null) ?? null,
    refresh: async () => {
      void forceSync('manual_force');
      await queryClient.invalidateQueries({ queryKey });
    },
  };
}
