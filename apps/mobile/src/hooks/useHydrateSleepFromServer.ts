// hooks/useHydrateSleepFromServer — Sprint 16.5c.
//
// Server → local recovery for the sleep slice. The U16PRO watch's
// day-info storage rolls over after a few days — a re-sync after that
// rollover returns `sleep min=0` for the older days even though the
// server retains every session the family ever synced. Sleep is
// per-night data we want to keep on hand for the SleepDetail screen's
// "Recent nights" list, nightly bar chart, and morning-BP correlation,
// none of which can be reconstructed if the device's slice has only
// last night.
//
// This hook mirrors `useHydrateReadingsFromServer` (BP) — fires once
// per Self-Buyer Home mount when the local sleep slice has fewer than
// FETCH_LIMIT rows, queries the last 90 sessions, and seeds them via
// useSleep.seedFromServer (idempotent — dedupes by sessionStartSec).
//
// This DOES NOT replace the offline-first contract — pending sessions
// are still written locally before /sync. This only tops up `recent`
// (the synced-and-acknowledged side) from the server when local has
// gaps.

import { useEffect } from 'react';
import { useAuth } from '../state/auth';
import { useSleep } from '../state/sleep';
import { supabase } from '../services/supabase';
import type { SleepSession, SleepStage } from '../types/vitals';

const FETCH_LIMIT = 90;

interface ServerSleepRow {
  id: string;
  family_id: string;
  device_id: string | null;
  vital_type: 'sleep_session';
  measured_at: string;
  /** Total sleep minutes (matches the slice's `totalMinutes`). */
  value_int: number;
  /** Deep sleep minutes. */
  value_int_2: number | null;
  /** REM minutes (always 0 on the U16PRO firmware, kept for forward
   *  compatibility). */
  value_int_3: number | null;
  value_jsonb: {
    session_start_local?: string;
    session_end_local?: string;
    light_minutes?: number;
    awake_minutes?: number;
    awake_count?: number;
    transitions?: { atSec: number; stage: SleepStage }[];
    sleep_score?: number;
  } | null;
}

function mapServerRowToSession(row: ServerSleepRow): SleepSession {
  const sessionStartSec = Math.floor(new Date(row.measured_at).getTime() / 1000);
  const totalMinutes = row.value_int;
  const deepMinutes = row.value_int_2 ?? 0;
  const remMinutes = row.value_int_3 ?? 0;
  const jsonb = row.value_jsonb ?? {};
  const lightMinutes = jsonb.light_minutes ?? 0;
  const awakeMinutes = jsonb.awake_minutes ?? 0;
  const awakeCount = jsonb.awake_count ?? 0;
  const transitions = jsonb.transitions ?? [];
  const sleepScore = jsonb.sleep_score ?? 0;
  // sessionEndSec — if the server has a local-end string we round-trip
  // through Date, otherwise derive from start + totalMinutes.
  const sessionEndSec = jsonb.session_end_local
    ? Math.floor(new Date(jsonb.session_end_local).getTime() / 1000)
    : sessionStartSec + totalMinutes * 60;
  const sessionStartLocal = jsonb.session_start_local
    ?? new Date(sessionStartSec * 1000).toISOString();
  const sessionEndLocal = jsonb.session_end_local
    ?? new Date(sessionEndSec * 1000).toISOString();
  return {
    sessionStartSec,
    sessionEndSec,
    sessionStartLocal,
    sessionEndLocal,
    totalMinutes,
    deepMinutes,
    remMinutes,
    lightMinutes,
    awakeMinutes,
    awakeCount,
    transitions,
    sleepScore,
  };
}

export function useHydrateSleepFromServer(): void {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    // Skip when local is already adequately populated. Same FETCH_LIMIT
    // threshold as the BP hook — if the user has 90+ nights locally,
    // we don't need a server top-up.
    const localCount = useSleep.getState().recent.length +
      useSleep.getState().pending.length;
    if (localCount >= FETCH_LIMIT) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data: membership } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('user_id', userId)
          .is('removed_at', null)
          .limit(1)
          .maybeSingle();
        if (cancelled || !membership) return;
        const familyId = (membership as { family_id: string }).family_id;

        const { data: rows, error } = await supabase
          .from('vitals_other')
          .select(
            'id, family_id, device_id, vital_type, measured_at, value_int, value_int_2, value_int_3, value_jsonb',
          )
          .eq('family_id', familyId)
          .eq('vital_type', 'sleep_session')
          .order('measured_at', { ascending: false })
          .limit(FETCH_LIMIT);
        if (cancelled || error || !rows || rows.length === 0) return;

        const mapped = (rows as ServerSleepRow[]).map(mapServerRowToSession);
        useSleep.getState().seedFromServer(mapped);
        // No analytics event for this — the analytics logger's typed
        // event list doesn't cover non-BP hydration. The seed-count is
        // observable via the slice's `recent.length` change.
      } catch {
        // Network failure is non-fatal. Next Home mount retries.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
