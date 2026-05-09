// Background read of Apple Health / Health Connect external vitals —
// Sprint 9.5 / Task 7.
//
// Flow:
//   1. Resolve the read window from MMKV cursor (unset = backfill 30d).
//   2. Per ReadVitalKind: skip when isReadEnabled() is false.
//   3. Call healthPlatform.readExternalSince() — adapter applies the
//      LEIKO_BUNDLE_ID round-trip filter (D13 §12.6).
//   4. POST to /sync-external-vitals; the Edge Function inserts via
//      service_role and dedupes via the unique index on (user, platform,
//      origin, vital_type, measured_at).
//   5. On success: advance cursor to fetch-start-time. On failure: leave
//      cursor untouched so the next attempt re-pulls the same window.
//
// Gates (mirror the syncBridge for write):
//   • account_type — caregiver short-circuits (D13 §12.6).
//   • Master toggle — off blocks the whole fetch.
//   • Per-vital read toggles — filter what the adapter is asked to read.
//
// Per CLAUDE.md voice + data rules: counts only in telemetry. Errors
// are non-fatal; the fetch is best-effort.

import { useAuth } from '../../state/auth';
import { logger } from '../analytics/logger';
import { mmkv, STORAGE_KEYS } from '../storage';
import { supabase } from '../supabase';
import { getActivePlatform, readExternalSince } from './index';
import { isReadEnabled } from './toggles';
import { ALL_READ_KINDS, type ExternalVitalSample } from './types';

/** Default backfill window when no cursor exists yet. 30 days mirrors
 *  the rolling-window the Trends screen uses. */
const FIRST_FETCH_BACKFILL_DAYS = 30;

/** 24h debounce — D13 §12.5 "daily background fetch." Honoured on
 *  foreground triggers so an app-open within 24h of the last attempt
 *  doesn't re-fetch. Background-fetch's own scheduling is independent
 *  (the OS picks the cadence and we don't fight it). */
export const READ_DEBOUNCE_MS = 24 * 60 * 60 * 1000;

interface SyncExternalVitalsResponse {
  inserted: number;
  duplicates: number;
  rejected: { index: number; reason: string }[];
}

export interface RunResult {
  ran: boolean;
  reason?:
    | 'caregiver'
    | 'master_off'
    | 'no_read_toggles'
    | 'too_recent'
    | 'no_samples'
    | 'no_user';
  inserted?: number;
  duplicates?: number;
  rejected?: number;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function readCursorSec(): number {
  const raw = mmkv.getString(STORAGE_KEYS.healthPlatformReadCursor);
  if (!raw) return nowSec() - FIRST_FETCH_BACKFILL_DAYS * 24 * 60 * 60;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : nowSec() - FIRST_FETCH_BACKFILL_DAYS * 24 * 60 * 60;
}

function writeCursorSec(value: number): void {
  mmkv.set(STORAGE_KEYS.healthPlatformReadCursor, String(value));
}

function readLastAttemptMs(): number {
  const raw = mmkv.getString(STORAGE_KEYS.healthPlatformLastAttempt);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function writeLastAttemptMs(value: number): void {
  mmkv.set(STORAGE_KEYS.healthPlatformLastAttempt, String(value));
}

/** Public entry. Trigger: 'foreground' honours the 24h debounce;
 *  'manual' bypasses it (Settings "Sync now" in a future sprint). */
export async function runExternalVitalsFetch(
  trigger: 'foreground' | 'manual' | 'background' = 'foreground',
): Promise<RunResult> {
  const profile = useAuth.getState().profile;
  if (!profile) return { ran: false, reason: 'no_user' };
  if (profile.account_type === 'caregiver') return { ran: false, reason: 'caregiver' };

  // Per-vital filter — drop kinds whose toggle (or master) is off.
  const enabled = ALL_READ_KINDS.filter((k) => isReadEnabled(k));
  if (enabled.length === 0) {
    // Either master off or every read toggle off. Distinguish for
    // telemetry — the master case is the more common.
    return {
      ran: false,
      reason: isReadEnabled('weight') ? 'no_read_toggles' : 'master_off',
    };
  }

  // 24h debounce on foreground triggers. Manual + background bypass.
  if (trigger === 'foreground') {
    const elapsed = Date.now() - readLastAttemptMs();
    if (elapsed < READ_DEBOUNCE_MS) {
      return { ran: false, reason: 'too_recent' };
    }
  }

  // Snapshot the cursor + the wall-clock at attempt-start; advance the
  // cursor to attemptStart on success.
  const sinceSec = readCursorSec();
  const attemptStartSec = nowSec();
  writeLastAttemptMs(Date.now());

  let samples: ExternalVitalSample[] = [];
  try {
    samples = await readExternalSince({ sinceSec, vitals: enabled });
  } catch (err) {
    logger.track('health_platform_read_failed', {
      stage: 'platform_read',
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return { ran: true, inserted: 0, duplicates: 0, rejected: 0 };
  }

  if (samples.length === 0) {
    // Still advance the cursor so we don't refetch the same empty
    // window indefinitely. The platform store had nothing new in the
    // window we asked for.
    writeCursorSec(attemptStartSec);
    return { ran: true, reason: 'no_samples', inserted: 0, duplicates: 0, rejected: 0 };
  }

  const platform = getActivePlatform();
  const sourcePlatform = platform === 'health_connect' ? 'health_connect' : 'apple_health';

  try {
    const { data, error } = await supabase.functions.invoke<SyncExternalVitalsResponse>(
      'sync-external-vitals',
      { body: { samples, sourcePlatform } },
    );
    if (error || !data) {
      throw new Error(error?.message ?? 'no_response');
    }
    // Advance cursor only on a successful POST.
    writeCursorSec(attemptStartSec);
    logger.track('health_platform_read_completed', {
      inserted: data.inserted,
      duplicates: data.duplicates,
      rejected: data.rejected.length,
    });
    return {
      ran: true,
      inserted: data.inserted,
      duplicates: data.duplicates,
      rejected: data.rejected.length,
    };
  } catch (err) {
    logger.track('health_platform_read_failed', {
      stage: 'sync_post',
      reason: err instanceof Error ? err.message : 'unknown',
    });
    // Cursor unchanged — next attempt re-pulls the same window.
    return { ran: true, inserted: 0, duplicates: 0, rejected: 0 };
  }
}

// ---- test-only --------------------------------------------------------

export function __resetForTest(): void {
  mmkv.remove(STORAGE_KEYS.healthPlatformReadCursor);
  mmkv.remove(STORAGE_KEYS.healthPlatformLastAttempt);
}

export function __getCursorSec(): number {
  return readCursorSec();
}

export function __getLastAttemptMs(): number {
  return readLastAttemptMs();
}
