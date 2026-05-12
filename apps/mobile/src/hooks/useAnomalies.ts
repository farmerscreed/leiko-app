// useAnomalies — Sprint 15.
//
// Hydrate the anomaly store from the server on mount + return the
// most-severe-unacknowledged event for the current family. Variants:
//
//   useMostSevereAnomaly()       — Home banner (any vital, any family member)
//   useMostSevereAnomalyForVital(vital) — Vital Detail banner
//   useAnomalyForReading(serverId)      — Reading Detail banner

import { useEffect, useMemo } from 'react';
import { useAuth } from '../state/auth';
import {
  useAnomalies,
  pickMostSevere,
  pickMostSevereForVital,
  findEventForReading,
  type AnomalyVital,
  type AnomalyEvent,
} from '../state/anomalies';
import { supabase } from '../services/supabase';

function useResolvedFamilyId(): string | null {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id ?? null;
  const hydrated = useAnomalies((s) => s.hydrated);
  const hydrate = useAnomalies((s) => s.hydrate);

  useEffect(() => {
    if (!userId || hydrated) return;
    let cancelled = false;
    void (async () => {
      const { data: membership } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)
        .is('removed_at', null)
        .limit(1)
        .maybeSingle();
      if (cancelled || !membership) return;
      const fid = (membership as { family_id: string }).family_id;
      await hydrate(fid);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, hydrated, hydrate]);

  // Return cached family id from auth profile if attached; the hook
  // is otherwise a fire-and-forget hydrator.
  return null;
}

export function useMostSevereAnomaly(): AnomalyEvent | null {
  useResolvedFamilyId();
  const events = useAnomalies((s) => s.events);
  return useMemo(() => pickMostSevere(events), [events]);
}

export function useMostSevereAnomalyForVital(vital: AnomalyVital): AnomalyEvent | null {
  useResolvedFamilyId();
  const events = useAnomalies((s) => s.events);
  return useMemo(() => pickMostSevereForVital(events, vital), [events, vital]);
}

export function useAnomalyForReading(readingServerId: string | null): AnomalyEvent | null {
  useResolvedFamilyId();
  const events = useAnomalies((s) => s.events);
  return useMemo(() => {
    if (!readingServerId) return null;
    return findEventForReading(events, readingServerId);
  }, [events, readingServerId]);
}
