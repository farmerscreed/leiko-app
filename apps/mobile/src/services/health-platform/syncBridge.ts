// Sync → platform-health bridge — Sprint 9.5 / Task 5.
//
// Fires AFTER a successful /sync POST. Forwards the same samples to
// Apple Health / Health Connect via the unified write() surface, gated
// on:
//
//   1. The user's account_type. Per D13 §12.6: "we don't sync Leiko
//      data to Apple Health for the caregiver's view of their parent's
//      data." A caregiver's HK store is THEIR personal store, not Mum's
//      — so the caregiver path short-circuits to no-op. Self-buyer and
//      parent (own phone) paths proceed.
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
import type { WriteBatch, WriteResult, WriteVitalKind } from './types';

/** True if the current user's account_type allows platform writes.
 *  Caregivers are excluded (D13 §12.6). Returns false when no profile
 *  is loaded yet (defensive — never write before we know who we are). */
export function isAccountTypeAllowed(): boolean {
  const profile = useAuth.getState().profile;
  if (!profile) return false;
  if (profile.account_type === 'caregiver') return false;
  return true; // self_buyer and parent (own phone) both proceed
}

function trackWrite(vital: WriteVitalKind, written: number, rejected: number): void {
  // PostHog event — counts only, no values. Per CLAUDE.md analytics rule.
  logger.track('health_platform_write', {
    vital_type: vital,
    written,
    rejected,
  });
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
  if (!isAccountTypeAllowed()) return;
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
  if (!isAccountTypeAllowed()) return null;
  const batch: WriteBatch = {};
  if (payload.bpReadings && isWriteEnabled('bp')) batch.bp = payload.bpReadings;
  if (payload.hrSamples && isWriteEnabled('hr')) batch.hr = payload.hrSamples;
  if (payload.spo2Samples && isWriteEnabled('spo2')) batch.spo2 = payload.spo2Samples;
  if (payload.sleepSessions && isWriteEnabled('sleep')) batch.sleep = payload.sleepSessions;
  if (payload.activityDays && isWriteEnabled('steps')) batch.steps = payload.activityDays;
  if (payload.caloriesDays && isWriteEnabled('calories')) batch.calories = payload.caloriesDays;

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
