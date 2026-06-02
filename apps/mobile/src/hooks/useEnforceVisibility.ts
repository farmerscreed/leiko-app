// hooks/useEnforceVisibility — Sprint 17b.
//
// Subscribes to UPDATEs on the signed-in user's own `family_members`
// row(s). When the family_owner toggles a vital off via
// CaregiverVisibilityScreen, the corresponding column changes and
// this hook receives the Realtime event. It then:
//
//   1. Diffs the new `vital_visibility` JSON against the persisted
//      last-known snapshot in MMKV.
//   2. For every vital that flipped visible → hidden, purges the
//      matching singleton-slice's `recent` array (pending preserved).
//   3. Invalidates the family-readings + parent-pulse TanStack Query
//      caches so server-driven views (CaregiverHome constellation,
//      ParentDashboard) refetch with RLS-filtered data.
//   4. Persists the new visibility snapshot for the next diff.
//
// Why a client-side hook on top of the server RLS (migration 0022):
//   - RLS stops NEW reads of hidden vitals, but offline-first slices
//     have cached `recent` arrays in MMKV from BEFORE the toggle.
//     Without the purge, the caregiver sees stale data even after
//     the owner hides a vital.
//   - The TanStack caches similarly hold pre-toggle results.
//
// Mounted once at the RootNavigator level. No-ops when there's no
// signed-in session.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuth } from '../state/auth';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { useReadings } from '../state/readings';
import { useHR } from '../state/hr';
import { useSpO2 } from '../state/spo2';
import { useSleep } from '../state/sleep';
import { useActivity } from '../state/activity';
import { DEFAULT_VISIBILITY } from '../services/families/visibility';
import { logger } from '../services/analytics/logger';
import type { VitalVisibility } from '../types/database';

type VitalKey = keyof VitalVisibility;
const VITAL_KEYS: VitalKey[] = ['bp', 'hr', 'spo2', 'sleep', 'activity'];

function readPersisted(): VitalVisibility {
  const raw = mmkv.getString(STORAGE_KEYS.lastKnownVisibility);
  if (!raw) return { ...DEFAULT_VISIBILITY };
  try {
    const parsed = JSON.parse(raw) as Partial<VitalVisibility>;
    return {
      bp: typeof parsed.bp === 'boolean' ? parsed.bp : DEFAULT_VISIBILITY.bp,
      hr: typeof parsed.hr === 'boolean' ? parsed.hr : DEFAULT_VISIBILITY.hr,
      spo2:
        typeof parsed.spo2 === 'boolean' ? parsed.spo2 : DEFAULT_VISIBILITY.spo2,
      sleep:
        typeof parsed.sleep === 'boolean'
          ? parsed.sleep
          : DEFAULT_VISIBILITY.sleep,
      activity:
        typeof parsed.activity === 'boolean'
          ? parsed.activity
          : DEFAULT_VISIBILITY.activity,
    };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

function writePersisted(v: VitalVisibility): void {
  mmkv.set(STORAGE_KEYS.lastKnownVisibility, JSON.stringify(v));
}

function normalizeFromRow(
  raw: Partial<VitalVisibility> | null | undefined,
): VitalVisibility {
  if (!raw) return { ...DEFAULT_VISIBILITY };
  return {
    bp: true, // always-on; defence in depth (server also coerces).
    hr: typeof raw.hr === 'boolean' ? raw.hr : DEFAULT_VISIBILITY.hr,
    spo2:
      typeof raw.spo2 === 'boolean' ? raw.spo2 : DEFAULT_VISIBILITY.spo2,
    sleep:
      typeof raw.sleep === 'boolean' ? raw.sleep : DEFAULT_VISIBILITY.sleep,
    activity:
      typeof raw.activity === 'boolean'
        ? raw.activity
        : DEFAULT_VISIBILITY.activity,
  };
}

/** Pure helper — returns the vital keys that flipped visible → hidden
 *  between `prev` and `next`. Exported for tests. */
export function diffHiddenVitals(
  prev: VitalVisibility,
  next: VitalVisibility,
): VitalKey[] {
  return VITAL_KEYS.filter((k) => prev[k] === true && next[k] === false);
}

function purgeSlice(key: VitalKey): void {
  switch (key) {
    case 'bp':
      useReadings.getState().clearRecent();
      return;
    case 'hr':
      useHR.getState().clearRecent();
      return;
    case 'spo2':
      useSpO2.getState().clearRecent();
      return;
    case 'sleep':
      useSleep.getState().clearRecent();
      return;
    case 'activity':
      useActivity.getState().clearRecent();
      return;
  }
}

export function useEnforceVisibility(): void {
  const userId = useAuth((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      // Sign-out: wipe the snapshot so the next session starts clean.
      mmkv.remove(STORAGE_KEYS.lastKnownVisibility);
      return;
    }

    let cancelled = false;

    // 1. Seed the persisted snapshot from the server on mount (the
    // diff against an unknown initial state is otherwise unreliable
    // — e.g. on a fresh install we don't want a one-time purge cycle
    // just because MMKV says everything's visible).
    void (async () => {
      const { data } = await supabase
        .from('family_members')
        .select('vital_visibility')
        .eq('user_id', userId)
        .is('removed_at', null)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const next = normalizeFromRow(
        (data as { vital_visibility?: Partial<VitalVisibility> } | null)
          ?.vital_visibility ?? null,
      );
      writePersisted(next);
    })();

    // 2. Subscribe to UPDATEs on this user's family_members row(s).
    // Filter by user_id so the channel only fires for the caller's
    // membership changes. RLS still gates row visibility — the user
    // can read their own row via "members see members".
    const channel = supabase
      .channel(`enforce-visibility:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'family_members',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = normalizeFromRow(
            (payload.new as { vital_visibility?: Partial<VitalVisibility> } | null)
              ?.vital_visibility ?? null,
          );
          const prev = readPersisted();
          const hidden = diffHiddenVitals(prev, next);
          if (hidden.length === 0) {
            writePersisted(next);
            return;
          }
          for (const key of hidden) {
            purgeSlice(key);
            logger.track('visibility_slice_purged', { vital: key });
          }
          // Invalidate the family-scoped query caches so the server
          // refetch returns RLS-filtered data.
          void queryClient.invalidateQueries({ queryKey: ['family-readings'] });
          void queryClient.invalidateQueries({ queryKey: ['parent-pulse'] });
          writePersisted(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
