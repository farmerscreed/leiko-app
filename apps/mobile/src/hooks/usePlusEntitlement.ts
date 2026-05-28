// usePlusEntitlement — Sprint 10a live entitlement gate.
//
// Reads families.subscription_status for the signed-in user's family
// and re-renders consumers when it changes. Per docs/09-paywall-and-iap.md
// §4 the families row is the source of truth; this hook is the read
// path. The /revenuecat-webhook Edge Function is the write path.
//
// Realtime invalidation:
//   We subscribe to UPDATE events on public.families filtered to the
//   user's family_id and call queryClient.invalidateQueries on a hit.
//   That covers two flows:
//     1. The family_owner purchases / restores → webhook → families
//        update → caregivers in the same circle see Plus features
//        without an app reload.
//     2. EXPIRATION → families.subscription_status flips to 'free' →
//        any open Plus surface reverts to the gated state.
//
// Family selection:
//   The user might be in multiple families. We mirror the existing
//   pattern (useFamilyReadings, Trends.tsx) — pick the first non-removed
//   membership. Multi-family caregiver flows are a future-sprint concern.
//
// Contract:
//   • `tier` — the families.subscription_status value, or 'free' when no
//     family is found.
//   • `isPlus` — true iff tier ∈ {plus, plus_trial, plus_grace}.
//   • `isLoading` — true while the initial fetch is in flight.
//   • `refetch` — manual trigger so the paywall can request an immediate
//     fetch after a purchase completes (faster than waiting for the
//     webhook → realtime path on a flaky network).
//
// Test surface:
//   The default `client` parameter is the singleton supabase client.
//   Tests pass an injected client via the legacy `__test__` re-export.

import { useEffect, useId } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../services/supabase';
import { useAuth } from '../state/auth';
import type { Database, SubscriptionStatus } from '../types/database';

export interface PlusEntitlement {
  tier: SubscriptionStatus;
  /** True when the tier grants Plus features (active / trial / grace). */
  isPlus: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
  /**
   * Optimistically tag the entitlement query cache as Plus right after a
   * local RevenueCat purchase resolves. The RC webhook is still
   * authoritative; this just bridges the few seconds between Google
   * Play returning "purchased" on-device and the webhook landing in
   * Supabase, so the user does not see the paywall blink back to "free"
   * after a successful buy. The realtime UPDATE that follows will
   * overwrite this with the server-side tier (which will agree).
   */
  markPlusOptimistic: () => void;
}

const PLUS_TIERS: ReadonlySet<SubscriptionStatus> = new Set([
  'plus',
  'plus_trial',
  'plus_grace',
]);

export function isPlusTier(tier: SubscriptionStatus): boolean {
  return PLUS_TIERS.has(tier);
}

const ENTITLEMENT_KEY = 'plus-entitlement';

interface FetchResult {
  familyId: string | null;
  tier: SubscriptionStatus;
}

async function fetchEntitlement(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<FetchResult> {
  const { data, error } = await client
    .from('family_members')
    .select('family_id, families(subscription_status)')
    .eq('user_id', userId)
    .is('removed_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { familyId: null, tier: 'free' };
  // PostgREST returns the joined row as either an object or a one-row
  // array depending on the relationship cardinality. Handle both.
  const fam = Array.isArray(data.families) ? data.families[0] : data.families;
  const tier = (fam?.subscription_status ?? 'free') as SubscriptionStatus;
  return { familyId: data.family_id as string, tier };
}

export function usePlusEntitlement(
  client: SupabaseClient<Database> = defaultSupabase,
): PlusEntitlement {
  const userId = useAuth((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  // Per-consumer id — supabase-js rejects a second postgres_changes
  // registration on a channel that's already subscribed, so the
  // channel name MUST be unique per consumer. Without this, mounting
  // a second usePlusEntitlement caller on the same screen (e.g. via
  // useDailyNarration) crashes with "cannot add postgres_changes
  // callbacks for realtime:families…". Same fix useFamilyReadings
  // applied in Sprint 7.7b.
  const subscriberId = useId();

  const query = useQuery({
    queryKey: [ENTITLEMENT_KEY, userId],
    queryFn: () => {
      if (!userId) return Promise.resolve({ familyId: null, tier: 'free' as SubscriptionStatus });
      return fetchEntitlement(client, userId);
    },
    // Entitlement is sticky — a one-minute stale time keeps re-renders
    // cheap when the screen mounts, while still refetching on
    // foreground transitions per QueryClient defaults.
    staleTime: 60_000,
    enabled: true,
  });

  const familyId = query.data?.familyId ?? null;

  useEffect(() => {
    if (!familyId) return;
    const channel = client
      .channel(`families:${familyId}:${subscriberId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'families',
          filter: `id=eq.${familyId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: [ENTITLEMENT_KEY, userId] });
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, familyId, queryClient, userId, subscriberId]);

  const tier: SubscriptionStatus = query.data?.tier ?? 'free';
  return {
    tier,
    isPlus: isPlusTier(tier),
    isLoading: query.isLoading,
    refetch: async () => {
      await query.refetch();
    },
    markPlusOptimistic: () => {
      const existing = query.data;
      // Only flip free → plus optimistically; never downgrade a real
      // server-side value. If the server is already plus/trial/grace
      // we have nothing to do.
      if (existing && isPlusTier(existing.tier)) return;
      queryClient.setQueryData<FetchResult>(
        [ENTITLEMENT_KEY, userId],
        {
          familyId: existing?.familyId ?? null,
          tier: 'plus',
        },
      );
      // Schedule a real fetch so the optimistic value gets reconciled
      // against the server once the webhook has had time to land.
      // Three seconds is the worst-case RC → Supabase webhook latency
      // we've seen in practice; the realtime channel usually beats it.
      setTimeout(() => {
        void query.refetch();
      }, 3000);
    },
  };
}
