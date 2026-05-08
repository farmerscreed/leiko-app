// useTrendsData — Sprint 9 Trends-screen data source.
//
// Fetches BP readings + the four `vitals_other` shapes from Supabase
// scoped to a family + range, then routes the rows through the pure
// `aggregateTrends` aggregator (utils/trends-aggregate.ts) to produce
// the chart series + summary headlines.
//
// Why Supabase rather than slice-only:
//   • Caregiver mode reads a parent's data from another device — local
//     MMKV doesn't have it.
//   • Self-buyer mode's local slices cap at ~7 days of HR samples
//     (RECENT_SAMPLES_CAP = 200) and can't render 30d / 90d / 1y
//     trends from local cache alone.
//   • RLS scopes the query to families the user is in; no extra
//     access-control work needed at this layer.
//
// TanStack Query owns caching: keyed by (familyId, range), so chip
// switches refetch (different range, different fetch) but stay cached
// per range. Realtime invalidation is wired separately by the screen
// (mirrors useFamilyReadings's pattern); this hook stays a pure data
// source.
//
// Sprint 9 simplification: the hook does not yet fall back to a
// "warm window" merge from local slices. For self-buyer mode, this
// means a fresh manual reading lands in the chart only after /sync
// completes. Polish pass after Sprint 9 acceptance can layer in the
// pending-row merge — the aggregator is already pure, so wiring is
// straightforward.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../services/supabase';
import {
  aggregateTrends,
  rangeStartIso,
  type TrendsData,
  type TrendsRange,
} from '../utils/trends-aggregate';
import type {
  Database,
  ReadingRow,
  VitalsOtherRow,
  CorrelationRow,
} from '../types/database';

const TRENDS_QUERY_KEY = ['trends-data'] as const;
const CORRELATIONS_QUERY_KEY = ['trends-correlations'] as const;

// Stale time matches the engine's nightly cadence on the correlation
// side and a 60-second freshness window on the data side. Realtime
// invalidations override staleness when they arrive.
const TRENDS_DATA_STALE_MS = 60_000;
const CORRELATIONS_STALE_MS = 60 * 60_000;

export interface UseTrendsDataOptions {
  /** Override the Supabase client — the test seam. */
  supabase?: SupabaseClient<Database>;
  /** Override the wall clock (for fixture-pinned tests). */
  nowMs?: number;
}

export interface UseTrendsDataResult {
  data: TrendsData | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
}

export function useTrendsData(
  familyId: string | null,
  range: TrendsRange,
  options: UseTrendsDataOptions = {},
): UseTrendsDataResult {
  const client = options.supabase ?? defaultSupabase;
  const nowMs = options.nowMs ?? Date.now();
  const queryKey = useMemo(
    () => [...TRENDS_QUERY_KEY, familyId, range] as const,
    [familyId, range],
  );

  const query = useQuery({
    queryKey,
    enabled: familyId !== null,
    staleTime: TRENDS_DATA_STALE_MS,
    queryFn: async (): Promise<TrendsData> => {
      if (!familyId) {
        return aggregateTrends({ readings: [], vitalsOther: [] });
      }
      const startIso = rangeStartIso(range, nowMs);
      const [readingsRes, vitalsRes] = await Promise.all([
        client
          .from('readings')
          .select('*')
          .eq('family_id', familyId)
          .gte('measured_at', startIso)
          .order('measured_at', { ascending: true }),
        client
          .from('vitals_other')
          .select('*')
          .eq('family_id', familyId)
          .gte('measured_at', startIso)
          .order('measured_at', { ascending: true }),
      ]);
      if (readingsRes.error) throw readingsRes.error;
      if (vitalsRes.error) throw vitalsRes.error;
      return aggregateTrends({
        readings: (readingsRes.data ?? []) as ReadingRow[],
        vitalsOther: (vitalsRes.data ?? []) as VitalsOtherRow[],
      });
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

export interface UseTrendsCorrelationsResult {
  /** At most 3 rows, sorted by |pearson_r| desc, latest computed_at per
   *  type, only `is_meaningful = true`. Empty array when no meaningful
   *  correlations exist for this user. */
  correlations: CorrelationRow[];
  isLoading: boolean;
  error: Error | null;
}

/** Latest meaningful correlations for the user, scoped to the family
 *  via RLS. The Trends screen feeds these to the correlation cards. */
export function useTrendsCorrelations(
  familyId: string | null,
  userId: string | null,
  options: UseTrendsDataOptions = {},
): UseTrendsCorrelationsResult {
  const client = options.supabase ?? defaultSupabase;
  const queryKey = useMemo(
    () => [...CORRELATIONS_QUERY_KEY, familyId, userId] as const,
    [familyId, userId],
  );

  const query = useQuery({
    queryKey,
    enabled: familyId !== null && userId !== null,
    staleTime: CORRELATIONS_STALE_MS,
    queryFn: async (): Promise<CorrelationRow[]> => {
      if (!familyId || !userId) return [];
      // Pull every meaningful row (capped at 12 — 3 types × ~4 recent
      // runs is ample for the latest-per-type filter below). The
      // service-side `correlations_meaningful` partial index covers
      // this access path.
      const res = await client
        .from('correlations')
        .select('*')
        .eq('family_id', familyId)
        .eq('user_id', userId)
        .eq('is_meaningful', true)
        .order('computed_at', { ascending: false })
        .limit(12);
      if (res.error) throw res.error;
      const rows = (res.data ?? []) as CorrelationRow[];
      return latestPerTypeSortedByEffect(rows);
    },
  });

  return {
    correlations: query.data ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}

/** Pure helper, exported for tests. Picks the most recent row per
 *  correlation_type, then sorts by `|pearson_r|` descending, capped
 *  at 3 (D13 §10.1). Rows with null `pearson_r` are dropped. */
export function latestPerTypeSortedByEffect(
  rows: CorrelationRow[],
): CorrelationRow[] {
  const latestByType = new Map<string, CorrelationRow>();
  for (const row of rows) {
    const prev = latestByType.get(row.correlation_type);
    if (!prev || row.computed_at > prev.computed_at) {
      latestByType.set(row.correlation_type, row);
    }
  }
  return Array.from(latestByType.values())
    .filter((r) => r.pearson_r !== null)
    .sort((a, b) => Math.abs(b.pearson_r ?? 0) - Math.abs(a.pearson_r ?? 0))
    .slice(0, 3);
}
