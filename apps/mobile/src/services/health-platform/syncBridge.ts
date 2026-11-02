// Sync → platform-health bridge — Sprint 9.5 / Task 5.
//
// Fires AFTER a successful /sync POST. Forwards the same samples to
// Apple Health / Health Connect via the unified write() surface, gated
// on:
//
//   1. Whose data it is. D13 §12.6: a caregiver's view of their parent
//      never goes into the caregiver's own Health store. Every forward
//      here follows an upload from THIS phone's own watch, so it is the
//      phone owner's data; see canWriteOwnData() (amended 2026-11-02 so
//      a caregiver who also wears a watch can share their own readings).
//
//   2. The master toggle (Sprint 9.5 / Task 4). Master OFF → no-op.
//
//   3. Per-vital toggles. Each vital array is filtered out if its own
//      toggle is off (or if master is off — the helper ANDs both).
//
// All errors are swallowed and counted via the analytics logger. The
// /sync POST is the source of truth for "this row exists"; a failed
// platform write is not a user-visible failure. Telemetry counts only,
// per CLAUDE.md.

import { useAuth } from '../../state/auth';
import { mmkv, STORAGE_KEYS } from '../storage';
import { useHR } from '../../state/hr';
import { computeRestingHRByNight } from '../../utils/vitalAggregators';
import { logger } from '../analytics/logger';
import type {
  ActivityDay,
  BPReading,
  CaloriesDay,
  HRSample,
  MultiVitalsPayload,
  SleepSession,
  SpO2Sample,
} from '../../types/vitals';
import { write } from './index';
import { isWriteEnabled } from './toggles';
import type { RestingHRNight, WriteBatch, WriteResult, WriteVitalKind } from './types';

/** True when this phone has a Leiko watch paired. A watch only ever
 *  syncs from its wearer's own phone (supabase/functions/sync
 *  resolveOwnCircle), so data coming off THIS phone's watch is the phone
 *  owner's own data — whatever their account_type. */
export function hasOwnWatchPaired(): boolean {
  try {
    return !!mmkv.getString(STORAGE_KEYS.pairedDevice);
  } catch {
    return false;
  }
}

/** True if this user may write their own readings to the platform store.
 *
 *  D13 §12.6 keeps a caregiver's view of their parent OUT of the
 *  caregiver's own Health store. Every forward in this file runs only
 *  after THIS phone uploaded data from ITS paired watch, i.e. the
 *  wearer's own readings — so a caregiver who also wears a watch
 *  (2026-11-02, "hybrid" accounts) may write those. A caregiver without
 *  a watch never reaches a forward. Returns false when no profile is
 *  loaded yet (never write before we know who we are). */
export function canWriteOwnData(): boolean {
  const profile = useAuth.getState().profile;
  if (!profile) return false;
  if (profile.account_type !== 'caregiver') return true;
  return hasOwnWatchPaired();
}

/** @deprecated kept for existing imports; use canWriteOwnData. */
export const isAccountTypeAllowed = canWriteOwnData;

function trackWrite(vital: WriteVitalKind, written: number, rejected: number): void {
  // PostHog event — counts only, no values. Per CLAUDE.md analytics rule.
  logger.track('health_platform_write', {
    vital_type: vital,
    written,
    rejected,
  });
}

/** Resting HR for the last few completed nights, computed over every HR
 *  sample this phone holds (the watch hands a night over in pieces across
 *  syncs, so the new samples alone are not enough). Re-sending a night is
 *  harmless: same id, and the version only rises with more samples. */
const RESTING_LOOKBACK_SEC = 3 * 86_400;

function recentRestingNights(newSamples: HRSample[]): RestingHRNight[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const tz =
    useAuth.getState().profile?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC';
  const { recent, pending } = useHR.getState();
  const bySec = new Map<number, HRSample>();
  for (const s of [...recent, ...pending, ...newSamples]) {
    if (s.measuredAtSec >= nowSec - RESTING_LOOKBACK_SEC) bySec.set(s.measuredAtSec, s);
  }
  return computeRestingHRByNight([...bySec.values()], nowSec, tz);
}

/** Forward a single freshly-synced BP row. Used by the readings store
 *  after each successful postReading(). Fire-and-forget. */
export async function forwardReadingToPlatform(reading: {
  measuredAtSec: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  source: BPReading['source'];
}): Promise<void> {
  if (!canWriteOwnData()) return;
  // A caregiver can type in a reading taken for someone else (e.g. Mum's
  // home cuff). Only watch readings are certainly the caregiver's own.
  if (useAuth.getState().profile?.account_type === 'caregiver' && reading.source !== 'watch') {
    return;
  }
  if (!isWriteEnabled('bp')) return;
  try {
    const result = await write({
      bp: [
        {
          measuredAtSec: reading.measuredAtSec,
          systolic: reading.systolic,
          diastolic: reading.diastolic,
          pulse: reading.pulse,
          source: reading.source,
        },
      ],
    });
    trackWrite('bp', result.bp.written, result.bp.rejected);
  } catch (err) {
    logger.track('health_platform_write_failed', {
      vital_type: 'bp',
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/** Forward a multi-vital sync payload after a successful postMultiVitals.
 *  Per-vital filter: drops entire arrays whose toggle is off. Fire-and-
 *  forget. Returns the per-vital WriteResult mostly so tests can
 *  inspect; production callers should ignore. */
export async function forwardMultiVitalsToPlatform(
  payload: MultiVitalsPayload,
): Promise<WriteResult | null> {
  if (!canWriteOwnData()) return null;
  const batch: WriteBatch = {};
  if (payload.bpReadings && isWriteEnabled('bp')) batch.bp = payload.bpReadings;
  if (payload.hrSamples && isWriteEnabled('hr')) batch.hr = payload.hrSamples;
  if (payload.spo2Samples && isWriteEnabled('spo2')) batch.spo2 = payload.spo2Samples;
  if (payload.sleepSessions && isWriteEnabled('sleep')) batch.sleep = payload.sleepSessions;
  if (payload.activityDays && isWriteEnabled('steps')) batch.steps = payload.activityDays;
  if (payload.caloriesDays && isWriteEnabled('calories')) batch.calories = payload.caloriesDays;
  if (payload.hrSamples?.length && isWriteEnabled('resting_hr')) {
    const nights = recentRestingNights(payload.hrSamples);
    if (nights.length) batch.restingHr = nights;
  }

  // Nothing to write — no toggles enabled for any included vital.
  if (Object.keys(batch).length === 0) return null;

  try {
    const result = await write(batch);
    if (batch.bp) trackWrite('bp', result.bp.written, result.bp.rejected);
    if (batch.hr) trackWrite('hr', result.hr.written, result.hr.rejected);
    if (batch.spo2) trackWrite('spo2', result.spo2.written, result.spo2.rejected);
    if (batch.sleep) trackWrite('sleep', result.sleep.written, result.sleep.rejected);
    if (batch.steps) trackWrite('steps', result.steps.written, result.steps.rejected);
    if (batch.calories) trackWrite('calories', result.calories.written, result.calories.rejected);
    if (batch.restingHr) trackWrite('resting_hr', result.resting_hr.written, result.resting_hr.rejected);
    return result;
  } catch (err) {
    logger.track('health_platform_write_failed', {
      vital_type: 'multi',
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}

// ---- helpers exposed for typed re-use --------------------------------------
export type { BPReading, HRSample, SpO2Sample, SleepSession, ActivityDay, CaloriesDay };
