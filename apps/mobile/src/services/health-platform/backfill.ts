// One-time copy of the user's past Leiko readings into Health Connect
// (2026-11-02). The sync bridge (syncBridge.ts) only forwards readings
// synced AFTER the user switches Health Connect on; without this, a user
// who has worn the watch for months would see an empty history there.
//
// Source: the server (it holds every reading, including ones synced from
// a previous phone). Only the user's OWN circle is copied — the circle
// they own, the same rule /sync uses to route a watch (resolveOwnCircle)
// — never a parent they follow (D13 §12.6).
//
// Safe to repeat: every record carries a stable clientRecordId
// (adapters/hcRecords.ts), so Health Connect updates instead of adding
// duplicates. Android only for now: the HealthKit adapter has no sync
// identifiers yet, so a repeat on iOS would duplicate (US plan, §4).
//
// Windows: two years of everything, but only 30 days of heart rate —
// the watch records a sample every few minutes, so a full HR history is
// tens of thousands of records for little value.

import { Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../supabase';
import { mmkv, STORAGE_KEYS } from '../storage';
import { logger } from '../analytics/logger';
import { useAuth } from '../../state/auth';
import {
  mapServerRowToHRSample,
  type ServerHRRow,
} from '../../hooks/useHydrateHRFromServer';
import {
  mapServerRowToSpO2Sample,
  type ServerSpO2Row,
} from '../../hooks/useHydrateSpO2FromServer';
import {
  mapServerRowToSession,
  type ServerSleepRow,
} from '../../hooks/useHydrateSleepFromServer';
import {
  mapServerRowToActivityDay,
  mapServerRowToCaloriesDay,
  type ServerActivityRow,
} from '../../hooks/useHydrateActivityFromServer';
import type { BPReading, HRSample } from '../../types/vitals';
import { computeRestingHRByNight } from '../../utils/vitalAggregators';
import type { ReadingRow, VitalType } from '../../types/database';
import { write } from './index';
import { canWriteOwnData } from './syncBridge';
import { isWriteEnabled } from './toggles';
import type { WriteBatch, WriteVitalKind } from './types';

const PAGE = 1000;
const DAY_SEC = 86_400;
export const HISTORY_DAYS = 730;
export const HR_HISTORY_DAYS = 30;

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export type BackfillStatus = 'idle' | 'running' | 'done' | 'failed';

interface BackfillState {
  status: BackfillStatus;
  /** Records Health Connect accepted in the current/last run. */
  copied: number;
  /** Wall-clock ms of the last completed copy, or null. */
  lastCompletedAt: number | null;
}

function readCompletedAt(): number | null {
  try {
    const v = mmkv.getNumber(STORAGE_KEYS.healthPlatformBackfillAt);
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export const useHealthBackfill = create<BackfillState>(() => ({
  status: 'idle',
  copied: 0,
  lastCompletedAt: readCompletedAt(),
}));

/** The circle this user owns — where their own watch's data lives. */
async function resolveOwnFamilyId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .eq('role', 'family_owner')
    .is('removed_at', null)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? (data as { family_id: string }).family_id : null;
}

function sinceIso(days: number, nowMs: number): string {
  return new Date(nowMs - days * DAY_SEC * 1000).toISOString();
}

/** Page through a query oldest-first until a short page comes back. */
async function pageAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  onPage: (rows: T[]) => Promise<void>,
): Promise<void> {
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error('history fetch failed');
    const rows = (data ?? []) as T[];
    if (rows.length > 0) await onPage(rows);
    if (rows.length < PAGE) return;
  }
}

function toBPReading(row: Pick<ReadingRow, 'measured_at' | 'systolic' | 'diastolic' | 'pulse' | 'source'>): BPReading {
  return {
    measuredAtSec: Math.floor(new Date(row.measured_at).getTime() / 1000),
    systolic: row.systolic,
    diastolic: row.diastolic,
    pulse: row.pulse,
    source: row.source === 'watch' ? 'watch' : 'manual',
  };
}

type VitalsKind = Exclude<WriteVitalKind, 'bp' | 'resting_hr'>;
const SERVER_TYPE: Record<VitalsKind, NonNullable<VitalType>> = {
  hr: 'hr',
  spo2: 'spo2',
  sleep: 'sleep_session',
  steps: 'steps_day',
  calories: 'calories_day',
};

function toBatch(kind: VitalsKind, rows: unknown[]): WriteBatch {
  switch (kind) {
    case 'hr':
      return { hr: (rows as ServerHRRow[]).map(mapServerRowToHRSample) };
    case 'spo2':
      return { spo2: (rows as ServerSpO2Row[]).map(mapServerRowToSpO2Sample) };
    case 'sleep':
      return { sleep: (rows as ServerSleepRow[]).map(mapServerRowToSession) };
    case 'steps':
      return { steps: (rows as ServerActivityRow[]).map(mapServerRowToActivityDay) };
    case 'calories':
      return { calories: (rows as ServerActivityRow[]).map(mapServerRowToCaloriesDay) };
  }
}

/**
 * Copy past readings into the platform store. Resolves when done; never
 * throws (status says how it went). Skips silently when Health Connect is
 * off, the user may not write (caregiver with no watch), or a copy is
 * already running.
 */
export async function backfillHealthPlatform(nowMs: number = Date.now()): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (useHealthBackfill.getState().status === 'running') return;
  if (!canWriteOwnData()) return;
  const userId = useAuth.getState().profile?.id;
  if (!userId) return;

  const restingOn = isWriteEnabled('resting_hr');
  const enabled = (['bp', 'hr', 'spo2', 'sleep', 'steps', 'calories'] as const).filter(isWriteEnabled);
  if (enabled.length === 0 && !restingOn) return;
  // Resting HR is derived from the HR history, so HR is read whenever
  // either is on (and only written as HR when "Share heart rate" is on).
  const kinds: (typeof enabled)[number][] =
    restingOn && !enabled.includes('hr') ? [...enabled, 'hr'] : [...enabled];
  const writeHr = enabled.includes('hr');
  const hrForResting: HRSample[] = [];

  useHealthBackfill.setState({ status: 'running', copied: 0 });
  const caregiver = useAuth.getState().profile?.account_type === 'caregiver';
  let copied = 0;
  let rejected = 0;
  const rowsByKind: Partial<Record<WriteVitalKind, number>> = {};

  const writeBatch = async (batch: WriteBatch): Promise<void> => {
    const r = await write(batch);
    for (const v of Object.values(r)) {
      copied += v.written;
      rejected += v.rejected;
    }
    useHealthBackfill.setState({ copied });
  };

  try {
    const familyId = await resolveOwnFamilyId(userId);
    if (!familyId) {
      useHealthBackfill.setState({ status: 'idle' });
      return;
    }

    for (const kind of kinds) {
      if (kind === 'bp') {
        await pageAll<Pick<ReadingRow, 'measured_at' | 'systolic' | 'diastolic' | 'pulse' | 'source'>>(
          (from, to) =>
            supabase
              .from('readings')
              .select('measured_at, systolic, diastolic, pulse, source')
              .eq('family_id', familyId)
              .or('hidden.is.null,hidden.eq.false')
              .gte('measured_at', sinceIso(HISTORY_DAYS, nowMs))
              .order('measured_at', { ascending: true })
              .range(from, to),
          async (rows) => {
            // A caregiver's own circle can hold readings they typed in
            // for someone else; only watch readings are certainly theirs.
            rowsByKind.bp = (rowsByKind.bp ?? 0) + rows.length;
            const own = caregiver ? rows.filter((r) => r.source === 'watch') : rows;
            if (own.length) await writeBatch({ bp: own.map(toBPReading) });
          },
        );
        continue;
      }
      const days = kind === 'hr' ? HR_HISTORY_DAYS : HISTORY_DAYS;
      await pageAll<unknown>(
        (from, to) =>
          supabase
            .from('vitals_other')
            .select(
              'id, family_id, device_id, vital_type, measured_at, value_int, value_int_2, value_int_3, value_jsonb',
            )
            .eq('family_id', familyId)
            .eq('vital_type', SERVER_TYPE[kind])
            .or('hidden.is.null,hidden.eq.false')
            .gte('measured_at', sinceIso(days, nowMs))
            .order('measured_at', { ascending: true })
            .range(from, to),
        async (rows) => {
          rowsByKind[kind] = (rowsByKind[kind] ?? 0) + rows.length;
          const batch = toBatch(kind, rows);
          if (kind === 'hr' && restingOn) hrForResting.push(...(batch.hr ?? []));
          if (kind !== 'hr' || writeHr) await writeBatch(batch);
        },
      );
    }

    if (restingOn && hrForResting.length > 0) {
      const tz = useAuth.getState().profile?.timezone || deviceTimeZone();
      const nights = computeRestingHRByNight(hrForResting, Math.floor(nowMs / 1000), tz);
      rowsByKind.resting_hr = nights.length;
      if (nights.length) await writeBatch({ restingHr: nights });
    }
    // Release-build diagnostics: rows found per vital (counts only).
    console.log(
      `[leiko-hc] backfill rows ${Object.entries(rowsByKind)
        .map(([k, n]) => `${k}=${n}`)
        .join(' ')} written=${copied} rejected=${rejected}`,
    );

    mmkv.set(STORAGE_KEYS.healthPlatformBackfillAt, nowMs);
    useHealthBackfill.setState({ status: 'done', copied, lastCompletedAt: nowMs });
    logger.track('health_platform_backfill', { result: 'done', written: copied, rejected });
  } catch {
    useHealthBackfill.setState({ status: 'failed' });
    logger.track('health_platform_backfill', { result: 'failed', written: copied, rejected });
  }
}

/** Test-only. */
export function __resetBackfillForTest(): void {
  mmkv.remove(STORAGE_KEYS.healthPlatformBackfillAt);
  useHealthBackfill.setState({ status: 'idle', copied: 0, lastCompletedAt: null });
}
