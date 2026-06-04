// services/vitalHistory — the "spool ALL data for the selected period"
// backend (founder direction, 2026-06-03; see ADR-0008 follow-up note +
// plans/vitals-data-completeness.md).
//
// The VitalDetail recent lists read capped local slices (BP 30, sleep 60,
// activity 90, HR/SpO2 200) — fine as an offline-first summary, but the
// range pills imply "this period's data" and a 90d window can hold far
// more than the cap. This module pages the FULL server window for a
// vital + range, with an exact total count, so the VitalHistory screen
// can show everything without ever trusting PostgREST's silent max_rows.
//
// HR is deliberately NOT served here: ~26k rows / 90d at the 5-min
// cadence isn't a browsable flat list. HR's full-window view is the
// per-day drill-down built on the hr_range_summary RPC (migration 0030).
//
// Pure-async, no React. The hook wrapper lives in hooks/useVitalHistory.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { TrendRange } from '../components/TimeRangePills';

export type VitalHistoryKind = 'bp' | 'spo2' | 'sleep' | 'activity';

export const HISTORY_PAGE_SIZE = 50;

const RANGE_TO_DAYS: Record<TrendRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Window start (ISO) for a range, anchored at `nowMs`. */
export function historyFromIso(range: TrendRange, nowMs: number = Date.now()): string {
  return new Date(nowMs - RANGE_TO_DAYS[range] * MS_PER_DAY).toISOString();
}

export interface VitalHistoryRow {
  id: string;
  measuredAtSec: number;
  /** Main value, e.g. "144/91" / "97%" / "7:30 slept" / "6,800 steps". */
  value: string;
  /** Secondary fact, e.g. "Pulse 78" / "Deep 0:54". Null when none. */
  detail: string | null;
}

export interface VitalHistoryPage {
  rows: VitalHistoryRow[];
  /** Exact window total. Requested on page 0 only; null on later pages. */
  totalCount: number | null;
}

// ── Row mappers (pure; exported for tests) ──────────────────────────

interface BPRow {
  id: string;
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

interface VitalsRow {
  id: string;
  measured_at: string;
  value_int: number | null;
  value_int_2: number | null;
  value_int_3: number | null;
}

function atSec(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

/** Minutes → "h:mm" (e.g. 450 → "7:30"). */
function hm(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function bpHistoryRow(r: BPRow): VitalHistoryRow {
  return {
    id: r.id,
    measuredAtSec: atSec(r.measured_at),
    value: `${r.systolic}/${r.diastolic}`,
    detail: r.pulse !== null ? `Pulse ${r.pulse}` : null,
  };
}

export function spo2HistoryRow(r: VitalsRow): VitalHistoryRow {
  return {
    id: r.id,
    measuredAtSec: atSec(r.measured_at),
    value: `${r.value_int ?? '—'}%`,
    // value_int_3 is the within-window minimum; surface it when it dips
    // below the window average so brief lows are visible in the list.
    detail:
      r.value_int_3 !== null && r.value_int !== null && r.value_int_3 < r.value_int
        ? `low ${r.value_int_3}%`
        : null,
  };
}

export function sleepHistoryRow(r: VitalsRow): VitalHistoryRow {
  return {
    id: r.id,
    measuredAtSec: atSec(r.measured_at),
    value: r.value_int !== null ? `${hm(r.value_int)} slept` : '—',
    detail: r.value_int_2 !== null && r.value_int_2 > 0 ? `Deep ${hm(r.value_int_2)}` : null,
  };
}

export function activityHistoryRow(r: VitalsRow): VitalHistoryRow {
  return {
    id: r.id,
    measuredAtSec: atSec(r.measured_at),
    value: r.value_int !== null ? `${r.value_int.toLocaleString()} steps` : '—',
    detail: null,
  };
}

const VITALS_OTHER_TYPE: Record<
  Exclude<VitalHistoryKind, 'bp'>,
  'spo2' | 'sleep_session' | 'steps_day'
> = {
  spo2: 'spo2',
  sleep: 'sleep_session',
  activity: 'steps_day',
};

// ── Fetch ───────────────────────────────────────────────────────────

/**
 * One page of the full window, newest first. Page 0 also carries the
 * exact total (PostgREST count: 'exact'), so the UI can show the true
 * "N recorded" without a second round-trip.
 */
export async function fetchVitalHistoryPage(
  client: SupabaseClient<Database>,
  kind: VitalHistoryKind,
  familyId: string,
  fromIso: string,
  pageIndex: number,
): Promise<VitalHistoryPage> {
  const from = pageIndex * HISTORY_PAGE_SIZE;
  const to = from + HISTORY_PAGE_SIZE - 1;
  const wantCount = pageIndex === 0;

  if (kind === 'bp') {
    const { data, error, count } = await client
      .from('readings')
      .select('id, measured_at, systolic, diastolic, pulse', {
        count: wantCount ? 'exact' : undefined,
      })
      .eq('family_id', familyId)
      .eq('hidden', false)
      .gte('measured_at', fromIso)
      .order('measured_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return {
      rows: ((data ?? []) as BPRow[]).map(bpHistoryRow),
      totalCount: wantCount ? count ?? null : null,
    };
  }

  const mapper =
    kind === 'spo2' ? spo2HistoryRow : kind === 'sleep' ? sleepHistoryRow : activityHistoryRow;
  const { data, error, count } = await client
    .from('vitals_other')
    .select('id, measured_at, value_int, value_int_2, value_int_3', {
      count: wantCount ? 'exact' : undefined,
    })
    .eq('family_id', familyId)
    .eq('vital_type', VITALS_OTHER_TYPE[kind])
    .eq('hidden', false)
    .gte('measured_at', fromIso)
    .order('measured_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return {
    rows: ((data ?? []) as VitalsRow[]).map(mapper),
    totalCount: wantCount ? count ?? null : null,
  };
}

/** Exact window total only (head request — no rows transferred). */
export async function countVitalHistory(
  client: SupabaseClient<Database>,
  kind: VitalHistoryKind,
  familyId: string,
  fromIso: string,
): Promise<number> {
  if (kind === 'bp') {
    const { error, count } = await client
      .from('readings')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .eq('hidden', false)
      .gte('measured_at', fromIso);
    if (error) throw error;
    return count ?? 0;
  }
  const { error, count } = await client
    .from('vitals_other')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('vital_type', VITALS_OTHER_TYPE[kind])
    .eq('hidden', false)
    .gte('measured_at', fromIso);
  if (error) throw error;
  return count ?? 0;
}
