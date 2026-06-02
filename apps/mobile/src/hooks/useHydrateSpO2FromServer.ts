// hooks/useHydrateSpO2FromServer — Sprint 16.5e.
//
// Server → local recovery for the SpO2 slice. Mirrors the HR hook.
// SpO2 cadence on the U16PRO is hourly (per the 16.5d single-byte
// finding), so 200 samples roughly covers the last 8 days — plenty for
// the overnight chart + the recent-readings list.

import { useEffect } from 'react';
import { useAuth } from '../state/auth';
import { useSpO2 } from '../state/spo2';
import { supabase } from '../services/supabase';
import type { SpO2Sample } from '../types/vitals';

const FETCH_LIMIT = 200;

interface ServerSpO2Row {
  id: string;
  family_id: string;
  device_id: string | null;
  vital_type: 'spo2';
  measured_at: string;
  /** Avg percent for the sample window. */
  value_int: number;
  /** Max in window. */
  value_int_2: number | null;
  /** Min in window. */
  value_int_3: number | null;
  value_jsonb: {
    sample_window_sec?: number;
    is_spot_check?: boolean;
    perfusion_index?: number | null;
  } | null;
}

function mapServerRowToSpO2Sample(row: ServerSpO2Row): SpO2Sample {
  const measuredAtSec = Math.floor(new Date(row.measured_at).getTime() / 1000);
  const jsonb = row.value_jsonb ?? {};
  return {
    measuredAtSec,
    percent: row.value_int,
    maxInWindow: row.value_int_2 ?? row.value_int,
    minInWindow: row.value_int_3 ?? row.value_int,
    sampleWindowSec: jsonb.sample_window_sec ?? 60 * 60,
    isSpotCheck: jsonb.is_spot_check ?? false,
    perfusionIndex: jsonb.perfusion_index ?? null,
  };
}

export function useHydrateSpO2FromServer(): void {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    const localCount =
      useSpO2.getState().recent.length + useSpO2.getState().pending.length;
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
          .eq('vital_type', 'spo2')
          .order('measured_at', { ascending: false })
          .limit(FETCH_LIMIT);
        if (cancelled || error || !rows || rows.length === 0) return;

        const mapped = (rows as ServerSpO2Row[]).map(mapServerRowToSpO2Sample);
        useSpO2.getState().seedFromServer(mapped);
      } catch {
        // Non-fatal — next Home mount retries.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
