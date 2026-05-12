// services/sync/syncFailureTracker — Sprint 16.
//
// Two pieces of state, both persisted to MMKV so they survive app
// kills:
//
//   1. `lastSyncFailedAt` — Unix ms of the FIRST failure in the
//      current failure streak. Set on entry into a failing state;
//      cleared on any successful sync. Drives the 24h reassurance
//      banner on Home.
//
//   2. `vitalFailureCounters` — { vital → { count, nextRetryAtMs } }.
//      Each per-vital BLE read step bumps `count` on failure and
//      schedules `nextRetryAtMs = now + min(2^count * 30s, 1h)`. The
//      orchestrator skips a step until `nextRetryAtMs` elapses, so a
//      flaky vital doesn't burn battery on every sync trigger while
//      the healthy vitals keep running.
//
// Per CLAUDE.md data rules: nothing PHI-bearing lives in these
// counters — just counts and timestamps.

import { mmkv, STORAGE_KEYS } from '../storage';

export type VitalKey = 'hr' | 'spo2' | 'sleep' | 'activity';

export interface VitalFailureEntry {
  count: number;
  nextRetryAtMs: number;
}

export type VitalFailureCounters = Partial<
  Record<VitalKey, VitalFailureEntry>
>;

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CEILING_MS = 60 * 60 * 1000; // 1 hour

// ─── lastSyncFailedAt ─────────────────────────────────────────────────

/**
 * Record the FIRST failure in the current streak. Idempotent — once
 * set, repeated calls are no-ops until the next success clears it.
 * Returns the existing value (if any) or the new one.
 */
export function markSyncFailure(nowMs: number = Date.now()): number {
  const existing = mmkv.getString(STORAGE_KEYS.lastSyncFailedAt);
  if (existing !== undefined && existing !== '') {
    const parsed = Number(existing);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  mmkv.set(STORAGE_KEYS.lastSyncFailedAt, String(nowMs));
  return nowMs;
}

/**
 * Clear the failure streak. Called on every successful runSync,
 * regardless of trigger. Safe to call when nothing was set.
 */
export function clearSyncFailure(): void {
  mmkv.remove(STORAGE_KEYS.lastSyncFailedAt);
}

/**
 * Read the current first-failure timestamp. Returns null when no
 * failure streak is active.
 */
export function getLastSyncFailedAt(): number | null {
  const raw = mmkv.getString(STORAGE_KEYS.lastSyncFailedAt);
  if (raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

// ─── per-vital backoff ────────────────────────────────────────────────

function readCounters(): VitalFailureCounters {
  const raw = mmkv.getString(STORAGE_KEYS.vitalFailureCounters);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as VitalFailureCounters;
    }
  } catch {
    // Fall through — corrupt blob; reset.
  }
  return {};
}

function writeCounters(next: VitalFailureCounters): void {
  mmkv.set(STORAGE_KEYS.vitalFailureCounters, JSON.stringify(next));
}

/**
 * Compute the next retry timestamp for an N-th consecutive failure.
 *   nextRetry = now + min(2^(count-1) * BACKOFF_BASE_MS, CEILING)
 *
 * Exported for tests. `count` is the 1-based ordinal of THIS failure
 * (i.e. the value `bumpVitalFailure` writes), so the first failure
 * waits 30s, the second 60s, the fifth 8m, the seventh hits the cap.
 */
export function computeNextRetryAtMs(count: number, nowMs: number): number {
  const safeCount = Math.max(1, Math.floor(count));
  const exponent = Math.min(safeCount - 1, 30); // cap to avoid Math.pow overflow
  const interval = Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CEILING_MS);
  return nowMs + interval;
}

/**
 * Record a failure for `vital`. Increments the counter, computes the
 * next retry time, persists. Returns the resulting entry.
 */
export function bumpVitalFailure(
  vital: VitalKey,
  nowMs: number = Date.now(),
): VitalFailureEntry {
  const counters = readCounters();
  const prev = counters[vital] ?? { count: 0, nextRetryAtMs: 0 };
  const nextCount = prev.count + 1;
  const next: VitalFailureEntry = {
    count: nextCount,
    nextRetryAtMs: computeNextRetryAtMs(nextCount, nowMs),
  };
  counters[vital] = next;
  writeCounters(counters);
  return next;
}

/**
 * Clear the failure entry for `vital` on a successful read. Safe to
 * call when nothing was set.
 */
export function clearVitalFailure(vital: VitalKey): void {
  const counters = readCounters();
  if (counters[vital] === undefined) return;
  delete counters[vital];
  writeCounters(counters);
}

/**
 * True when the next-retry window has NOT yet elapsed for this vital.
 * The orchestrator's per-vital branch should skip its work and leave
 * the counter alone until the window opens.
 */
export function isVitalBackoffActive(
  vital: VitalKey,
  nowMs: number = Date.now(),
): boolean {
  const entry = readCounters()[vital];
  if (entry === undefined) return false;
  return entry.nextRetryAtMs > nowMs;
}

/**
 * Snapshot the current counters — used by tests + the dev debug panel.
 */
export function getVitalFailureCounters(): VitalFailureCounters {
  return readCounters();
}

/**
 * Reset every counter. Used by tests + dev "force resync" tooling.
 */
export function clearAllVitalFailures(): void {
  mmkv.remove(STORAGE_KEYS.vitalFailureCounters);
}
