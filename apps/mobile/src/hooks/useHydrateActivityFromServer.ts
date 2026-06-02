// hooks/useHydrateActivityFromServer — Sprint 16.5e.
//
// Server → local recovery for the activity slice (steps + calories).
// Mirrors the BP + sleep hydration pattern: when the watch's day-info
// storage rolls over after a few days, a re-sync returns only today's
// step + calorie totals even though the server retains every day the
// family ever synced. Without this hook ActivityDetail's weekly bars,
// stat trio, and Recent-days list show a single row.
//
// Fires once per Self-Buyer Home mount when EITHER local slice has
// fewer than FETCH_LIMIT rows (steps + calories tracked independently —
// either can be sparse on its own). Queries the last 90 server rows
// per vital type and seeds via the slice's idempotent seed methods.
//
// This DOES NOT replace the offline-first contract — pending rows are
// still written locally before /sync. This only tops up the `recent`
// arrays (the synced-and-acknowledged side) from the server.

import { useEffect } from 'react';
import { useAuth } from '../state/auth';
import { useActivity } from '../state/activity';
import { supabase } from '../services/supabase';
import type { ActivityDay, CaloriesDay } from '../types/vitals';

const FETCH_LIMIT = 90;

interface ServerActivityRow {
  id: string;
  family_id: string;
  device_id: string | null;
  vital_type: 'steps_day' | 'calories_day';
  measured_at: string;
  value_int: number;
  value_jsonb: {
    day_local?: string;
    target_steps?: number;
    last_sample_at?: string;
    hourly?: number[];
    target_kcal?: number | null;
    activity_kcal?: number;
    bmr_kcal?: number;
  } | null;
}

function dayLocalFromMeasuredAt(measuredAt: string): string {
  return new Date(measuredAt).toISOString().slice(0, 10);
}

function mapServerRowToActivityDay(row: ServerActivityRow): ActivityDay {
  const measuredAtSec = Math.floor(new Date(row.measured_at).getTime() / 1000);
  const jsonb = row.value_jsonb ?? {};
  const dayLocal = jsonb.day_local ?? dayLocalFromMeasuredAt(row.measured_at);
  const lastSampleAtSec = jsonb.last_sample_at
    ? Math.floor(new Date(jsonb.last_sample_at).getTime() / 1000)
    : measuredAtSec;
  const hourly = Array.isArray(jsonb.hourly) && jsonb.hourly.length === 24
    ? jsonb.hourly
    : Array.from({ length: 24 }, () => 0);
  return {
    dayLocal,
    measuredAtSec,
    totalSteps: row.value_int,
    targetSteps: jsonb.target_steps ?? 6000,
    lastSampleAtSec,
    hourly,
  };
}

function mapServerRowToCaloriesDay(row: ServerActivityRow): CaloriesDay {
  const measuredAtSec = Math.floor(new Date(row.measured_at).getTime() / 1000);
  const jsonb = row.value_jsonb ?? {};
  const dayLocal = jsonb.day_local ?? dayLocalFromMeasuredAt(row.measured_at);
  return {
    dayLocal,
    measuredAtSec,
    totalKcal: row.value_int,
    activityKcal: jsonb.activity_kcal ?? 0,
    bmrKcal: jsonb.bmr_kcal ?? 0,
    targetKcal: jsonb.target_kcal ?? null,
  };
}

export function useHydrateActivityFromServer(): void {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    // Top-up semantics (16.5d rule #5) — skip only when BOTH slices are
    // already at FETCH_LIMIT. If either is sparse, query both vital
    // types and let the slice's seed methods dedup.
    const stepsCount =
      useActivity.getState().recentSteps.length +
      useActivity.getState().pendingSteps.length;
    const caloriesCount =
      useActivity.getState().recentCalories.length +
      useActivity.getState().pendingCalories.length;
    if (stepsCount >= FETCH_LIMIT && caloriesCount >= FETCH_LIMIT) return;

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
          .in('vital_type', ['steps_day', 'calories_day'])
          .order('measured_at', { ascending: false })
          .limit(FETCH_LIMIT * 2);
        if (cancelled || error || !rows || rows.length === 0) return;

        const stepsRows: ActivityDay[] = [];
        const caloriesRows: CaloriesDay[] = [];
        for (const row of rows as ServerActivityRow[]) {
          if (row.vital_type === 'steps_day') {
            stepsRows.push(mapServerRowToActivityDay(row));
          } else if (row.vital_type === 'calories_day') {
            caloriesRows.push(mapServerRowToCaloriesDay(row));
          }
        }
        if (stepsRows.length > 0) {
          useActivity.getState().seedStepsFromServer(stepsRows);
        }
        if (caloriesRows.length > 0) {
          useActivity.getState().seedCaloriesFromServer(caloriesRows);
        }
        // No analytics event for this — the typed logger event list
        // doesn't cover non-BP hydration. The seed counts are observable
        // via the slice's `recent.length` change.
      } catch {
        // Network failure is non-fatal. Next Home mount retries.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
