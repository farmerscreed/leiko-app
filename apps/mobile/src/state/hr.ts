// HR state slice — Sprint 7.5 / D13 §2.2.
//
// Mirrors the readings.ts pattern for the offline-first guarantee:
//   pending — captured locally, NOT yet acknowledged by /sync. The
//             pending MMKV buffer is the source of truth for the
//             offline-first rule (every sample lands here before any
//             sync attempt).
//   recent  — server-acknowledged samples, capped at RECENT_SAMPLES_CAP.
//
// Sync orchestration (the 8-step pipeline per D13 §3.3) is owned by
// the orchestrator slice; this file exposes `acceptSyncResult` as the
// integration seam — the orchestrator calls it AFTER /sync returns the
// per-vital `inserted` count + duplicates.
//
// Aggregators (`restingBpmToday`, `restingBpmRecent`) compute the
// inputs the dailyPulse selector hook (next sprint task) feeds into
// classifyHR. They do NOT call the classifier directly — slices stay
// storage-and-aggregation only per the brief.
//
// Per CLAUDE.md data rule: sample VALUES (bpm) never appear in
// analytics events. Only counts + the vital_type discriminator.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { createPendingVitalBuffer } from '../services/pendingVitalBuffer';
import { logger } from '../services/analytics/logger';
import type { HRSample } from '../types/vitals';
import { zonedHour, zonedDateKey } from '../utils/timezone';

const RECENT_SAMPLES_CAP = 200;     // ~7 days at 30-min auto-sampling
const SLEEP_WINDOW_START_HOUR = 22; // 22:00 user-local
const SLEEP_WINDOW_END_HOUR = 6;    // 06:00 user-local
const ROLLING_WINDOW_SEC = 10 * 60; // 10-min rolling avg
const RESTING_RECENT_DAYS = 14;     // last 14 days of restingBpmToday
const SECONDS_PER_DAY = 24 * 60 * 60;

interface HRState {
  pending: HRSample[];
  recent: HRSample[];
  syncing: boolean;
  syncError: string | null;

  hydrate: () => void;
  /** Synchronous MMKV write. Returns the row. */
  addPending: (sample: HRSample) => HRSample;
  /** Batch insert (backfill) — one MMKV write + one set() for N samples. */
  addPendingBatch: (samples: HRSample[]) => void;
  /** Move acknowledged rows from pending → recent (cap respected). */
  acceptSyncResult: (acceptedKeys: string[]) => void;
  /** Latest sample regardless of pending/recent. */
  latest: () => HRSample | null;
  /** Resting HR for "today" — the lowest 10-minute rolling-average HR
   *  sample during the sleep window 22:00–06:00. Returns null when
   *  there are <2 samples in the window. The window is interpreted in
   *  UTC for test determinism — production callers pass a TZ-aware
   *  nowSec; the same hour-of-day arithmetic produces user-local
   *  results because the watch shifts samples to TRUE UTC at ingest
   *  per D13 §3.5. */
  restingBpmToday: (nowSec?: number, timeZone?: string | null) => number | null;
  /** Last RESTING_RECENT_DAYS days of restingBpmToday, oldest first.
   *  Empty entries are skipped (not zero-filled) so classifyHR sees
   *  baseline length = days-with-data. */
  restingBpmRecent: (nowSec?: number, timeZone?: string | null) => number[];
  /** Sprint 18 — same data as restingBpmRecent but each entry carries
   *  the nightKey (YYYY-MM-DD of the night the sleep window
   *  belongs to) so consumers can date-align with other vitals'
   *  per-night data instead of positional pairing. Oldest first.
   *  Empty nights are skipped (not zero-filled). */
  restingBpmRecentByNight: (
    nowSec?: number,
    timeZone?: string | null,
  ) => Array<{ nightKey: string; restingBpm: number }>;
  /**
   * Sprint 16.5e — seed historical samples from the server. The U16PRO
   * watch's day-info storage rolls over after a few days; without a
   * server top-up the HR detail screen loses everything older than the
   * watch's retention window. Mirrors `useSleep.seedFromServer` /
   * `useActivity.seedStepsFromServer` — accepts the authoritative list,
   * dedups against `pending` + `recent` by `measuredAtSec`, merges, sorts
   * desc, caps at `RECENT_SAMPLES_CAP`. Returns the number of NEW rows.
   */
  seedFromServer: (samples: HRSample[]) => number;
  /** Sprint 17b — visibility purge. Clears `recent` only; `pending`
   *  is preserved (user's own offline writes). */
  clearRecent: () => void;
  reset: () => void;
}

const buffer = createPendingVitalBuffer<HRSample>({
  storageKey: STORAGE_KEYS.pendingHR,
  getKey: (s) => String(s.measuredAtSec),
});

function readJson<T>(key: string, fallback: T): T {
  const raw = mmkv.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function persistRecent(recent: HRSample[]): void {
  mmkv.set(STORAGE_KEYS.recentHR, JSON.stringify(recent));
}

function dedupRecent(rows: HRSample[]): HRSample[] {
  const seen = new Set<string>();
  const out: HRSample[] = [];
  for (const r of rows) {
    const key = String(r.measuredAtSec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Sleep window check, evaluated in the user's timezone. The window
 *  22:00–06:00 spans the midnight boundary, so we accept hours >= 22 OR
 *  hours < 6. `timeZone` omitted/UTC keeps the original UTC behaviour. */
function inSleepWindow(measuredAtSec: number, timeZone?: string | null): boolean {
  const hr = zonedHour(measuredAtSec, timeZone);
  return hr >= SLEEP_WINDOW_START_HOUR || hr < SLEEP_WINDOW_END_HOUR;
}

/** Sleep night identity: a sample at 23:00 on May 6 and 03:00 on May 7
 *  belong to the SAME night. We anchor each sample to its "owning
 *  morning" (the date when the user wakes up), in the user's timezone.
 *  For an evening sample (hour >= 22), the owning morning is the next
 *  local date; for an early-morning sample (hour < 6), it's the same
 *  local date. `timeZone` omitted/UTC keeps the original UTC behaviour. */
function nightDateKey(measuredAtSec: number, timeZone?: string | null): string {
  const hr = zonedHour(measuredAtSec, timeZone);
  const anchorSec =
    hr >= SLEEP_WINDOW_START_HOUR ? measuredAtSec + SECONDS_PER_DAY : measuredAtSec;
  return zonedDateKey(anchorSec, timeZone);
}

function rollingMinAverage(samples: HRSample[]): number | null {
  if (samples.length < 2) return null;
  const sorted = [...samples].sort((a, b) => a.measuredAtSec - b.measuredAtSec);
  let lo = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const windowEnd = sorted[i].measuredAtSec;
    const windowStart = windowEnd - ROLLING_WINDOW_SEC;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      if (sorted[j].measuredAtSec < windowStart) break;
      sum += sorted[j].bpm;
      n += 1;
    }
    // Need at least 2 samples in the window to count as a rolling avg —
    // single-sample windows are noise, not "rest".
    if (n >= 2) {
      const avg = sum / n;
      if (avg < lo) lo = avg;
    }
  }
  return Number.isFinite(lo) ? lo : null;
}

export const useHR = create<HRState>((set, get) => ({
  pending: [],
  recent: [],
  syncing: false,
  syncError: null,

  hydrate: () => {
    const pending = buffer.readAll();
    const recent = readJson<HRSample[]>(STORAGE_KEYS.recentHR, []);
    set({ pending, recent });
  },

  addPending: (sample) => {
    buffer.append(sample);
    // Re-read from MMKV so the in-memory state matches what was
    // actually written (preserves dedup behaviour from the buffer).
    const pending = buffer.readAll();
    set({ pending });
    logger.track('vital_persisted', { vital_type: 'hr', count: 1 });
    return sample;
  },

  // Batch insert for backfill. The per-sample addPending does a full MMKV
  // read+filter+write AND a Zustand set() AND a log PER SAMPLE — O(n^2)
  // plus a render storm when a cold start replays ~1,800 samples
  // (cursor.hr=0 after an install/MMKV wipe). addPendingBatch dedups by
  // measuredAtSec and writes the whole set ONCE with a single set()/log.
  addPendingBatch: (samples) => {
    if (samples.length === 0) return;
    const byKey = new Map<string, HRSample>();
    for (const s of buffer.readAll()) byKey.set(String(s.measuredAtSec), s);
    for (const s of samples) byKey.set(String(s.measuredAtSec), s);
    const merged = Array.from(byKey.values());
    buffer.replace(merged);
    set({ pending: merged });
    logger.track('vital_persisted', { vital_type: 'hr', count: samples.length });
  },

  acceptSyncResult: (acceptedKeys) => {
    if (acceptedKeys.length === 0) return;
    const keySet = new Set(acceptedKeys);
    const currentPending = get().pending;
    const movedRows = currentPending.filter((s) =>
      keySet.has(String(s.measuredAtSec)),
    );
    const remainingPending = currentPending.filter(
      (s) => !keySet.has(String(s.measuredAtSec)),
    );
    for (const k of acceptedKeys) buffer.removeByKey(k);
    // Freshest first (sort by measuredAtSec desc), dedup against existing
    // recent, cap.
    const merged = dedupRecent(
      [...movedRows, ...get().recent].sort(
        (a, b) => b.measuredAtSec - a.measuredAtSec,
      ),
    ).slice(0, RECENT_SAMPLES_CAP);
    set({ pending: remainingPending, recent: merged });
    persistRecent(merged);
    logger.track('vital_sync_accepted', {
      vital_type: 'hr',
      count: movedRows.length,
    });
  },

  latest: () => {
    const all = [...get().pending, ...get().recent];
    if (all.length === 0) return null;
    return all.reduce((a, b) => (b.measuredAtSec > a.measuredAtSec ? b : a));
  },

  restingBpmToday: (nowSec, timeZone) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const all = [...get().pending, ...get().recent];
    if (all.length < 2) return null;
    // Tonight's sleep window starts at the most recent 22:00 boundary;
    // for "today" we want the window that ends within `now`'s morning.
    const todayKey = nightDateKey(now, timeZone);
    const windowSamples = all.filter(
      (s) =>
        inSleepWindow(s.measuredAtSec, timeZone) &&
        nightDateKey(s.measuredAtSec, timeZone) === todayKey,
    );
    if (windowSamples.length < 2) return null;
    return rollingMinAverage(windowSamples);
  },

  restingBpmRecent: (nowSec, timeZone) => {
    return get()
      .restingBpmRecentByNight(nowSec, timeZone)
      .map((e) => e.restingBpm);
  },

  restingBpmRecentByNight: (nowSec, timeZone) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const all = [...get().pending, ...get().recent];
    if (all.length === 0) return [];
    // Build a map of nightKey → samples in the sleep window.
    const byNight = new Map<string, HRSample[]>();
    for (const s of all) {
      if (!inSleepWindow(s.measuredAtSec, timeZone)) continue;
      const key = nightDateKey(s.measuredAtSec, timeZone);
      const arr = byNight.get(key);
      if (arr) arr.push(s);
      else byNight.set(key, [s]);
    }
    // Walk back RESTING_RECENT_DAYS days from "yesterday" (the day
    // before today's nightKey) so today's restingBpm is NOT included
    // — classifyHR consumes today separately.
    const todayKey = nightDateKey(now, timeZone);
    const out: Array<{ nightKey: string; restingBpm: number }> = [];
    for (let d = RESTING_RECENT_DAYS; d >= 1; d--) {
      const nightKey = nightDateKey(now - d * SECONDS_PER_DAY, timeZone);
      if (nightKey === todayKey) continue;
      const samples = byNight.get(nightKey);
      if (!samples || samples.length < 2) continue;
      const avg = rollingMinAverage(samples);
      if (avg === null) continue;
      out.push({ nightKey, restingBpm: avg });
    }
    return out;
  },

  seedFromServer: (samples) => {
    if (samples.length === 0) return 0;
    const existing = get().recent;
    const existingKeys = new Set(existing.map((s) => String(s.measuredAtSec)));
    const pendingKeys = new Set(
      get().pending.map((s) => String(s.measuredAtSec)),
    );
    const newRows = samples.filter((s) => {
      const key = String(s.measuredAtSec);
      return !existingKeys.has(key) && !pendingKeys.has(key);
    });
    if (newRows.length === 0) return 0;
    const merged = dedupRecent(
      [...newRows, ...existing].sort(
        (a, b) => b.measuredAtSec - a.measuredAtSec,
      ),
    ).slice(0, RECENT_SAMPLES_CAP);
    set({ recent: merged });
    persistRecent(merged);
    return newRows.length;
  },

  clearRecent: () => {
    set({ recent: [] });
    mmkv.remove(STORAGE_KEYS.recentHR);
  },

  reset: () => {
    set({ pending: [], recent: [], syncing: false, syncError: null });
    buffer.clear();
    mmkv.remove(STORAGE_KEYS.recentHR);
  },
}));
