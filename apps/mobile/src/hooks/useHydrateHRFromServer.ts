// hooks/useHydrateHRFromServer — Sprint 16.5e.
//
// Server → local recovery for the HR slice. Mirrors the activity + sleep
// hydration pattern. HR samples are per-sample (not per-day) so the
// dedup key is `measuredAtSec`. The U16PRO records at ~5 min cadence;
// FETCH_LIMIT of 200 covers roughly the last 16 hours of dense
// auto-sampling — enough for HRDetail's recent-readings list, the daily
// trend chart, and the sleep × resting-HR correlation.
//
// Fires once per Self-Buyer Home mount when local has fewer than
// FETCH_LIMIT rows. Idempotent against re-fires via the slice's
// dedup-by-measuredAtSec.

import { useEffect } from 'react';
import { useAuth } from '../state/auth';
import { useHR } from '../state/hr';
import { supabase } from '../services/supabase';
import type { HRSample, HRMotionState } from '../types/vitals';

const FETCH_LIMIT = 200;

interface ServerHRRow {
  id: string;
  family_id: string;
  device_id: string | null;
  vital_type: 'hr';
  measured_at: string;
  value_int: number;
  value_jsonb: {
    sample_window_sec?: number;
    motion_state?: HRMotionState;
    is_spot_check?: boolean;
  } | null;
}

function mapServerRowToHRSample(row: ServerHRRow): HRSample {
  const measuredAtSec = Math.floor(new Date(row.measured_at).getTime() / 1000);
  const jsonb = row.value_jsonb ?? {};
  return {
    measuredAtSec,
    bpm: row.value_int,
    sampleWindowSec: jsonb.sample_window_sec ?? 5 * 60,
    motionState: jsonb.motion_state ?? 'unknown',
    isSpotCheck: jsonb.is_spot_check ?? false,
  };
}

export function useHydrateHRFromServer(): void {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    const localCount =
      useHR.getState().recent.length + useHR.getState().pending.length;
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
            'id, family_id, device_id, vital_type, measured_at, value_int, value_jsonb',
          )
          .eq('family_id', familyId)
          .eq('vital_type', 'hr')
          .order('measured_at', { ascending: false })
          .limit(FETCH_LIMIT);
        if (cancelled || error || !rows || rows.length === 0) return;

        const mapped = (rows as ServerHRRow[]).map(mapServerRowToHRSample);
        useHR.getState().seedFromServer(mapped);
      } catch {
        // Non-fatal — next Home mount retries.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
