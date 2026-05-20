// SpO2 state slice — Sprint 7.5 / D13 §2.3 + §6.3.
//
// Mirrors hr.ts: pending (offline-first source of truth) + recent
// (server-acknowledged, capped). Aggregators are pure reads consumed
// by the dailyPulse selector; classifiers are NOT called from here.
//
// Per CLAUDE.md data rule: percent values never appear in analytics
// events.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { createPendingVitalBuffer } from '../services/pendingVitalBuffer';
import { logger } from '../services/analytics/logger';
import type { SpO2Sample } from '../types/vitals';

const RECENT_SAMPLES_CAP = 200;
const OVERNIGHT_WINDOW_START_HOUR = 22; // 22:00 user-local
const OVERNIGHT_WINDOW_END_HOUR = 6;    // 06:00 user-local
const OVERNIGHT_DEFAULT_NIGHTS = 14;
const SECONDS_PER_DAY = 24 * 60 * 60;

interface SpO2State {
  pending: SpO2Sample[];
  recent: SpO2Sample[];
  syncing: boolean;
  syncError: string | null;

  hydrate: () => void;
  addPending: (sample: SpO2Sample) => SpO2Sample;
  acceptSyncResult: (acceptedKeys: string[]) => void;
  /** Most recent sample's percent, or null. */
  latestPercent: (nowSec?: number) => number | null;
  /** Last N nights of overnight lows, oldest first. An "overnight low"
   *  is the minimum percent across samples whose measuredAtSec falls
   *  in the user-local 22:00–06:00 window for that calendar night.
   *  Empty nights skipped (not zero-filled). Window interpreted in UTC
   *  for test determinism — production callers pass TZ-aware nowSec. */
  overnightLowsRecent: (nowSec?: number, nights?: number) => number[];
  /**
   * Sprint 16.5e — seed historical samples from the server. Same
   * pattern as `useHR.seedFromServer`. The U16PRO watch's day-info
   * storage rolls over after a few days; this top-up keeps the SpO2
   * detail screen + the overnight chart populated.
   */
  seedFromServer: (samples: SpO2Sample[]) => number;
  /** Sprint 17b — visibility purge. Clears `recent` only. */
  clearRecent: () => void;
  reset: () => void;
}

const buffer = createPendingVitalBuffer<SpO2Sample>({
  storageKey: STORAGE_KEYS.pendingSpO2,
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

function persistRecent(recent: SpO2Sample[]): void {
  mmkv.set(STORAGE_KEYS.recentSpO2, JSON.stringify(recent));
}

function dedupRecent(rows: SpO2Sample[]): SpO2Sample[] {
  const seen = new Set<string>();
  const out: SpO2Sample[] = [];
  for (const r of rows) {
    const key = String(r.measuredAtSec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function inOvernightWindow(measuredAtSec: number): boolean {
  const hr = new Date(measuredAtSec * 1000).getUTCHours();
  return hr >= OVERNIGHT_WINDOW_START_HOUR || hr < OVERNIGHT_WINDOW_END_HOUR;
}

/** Anchor each overnight sample to its "owning morning" UTC date —
 *  matches hr.ts so the two slices align on what counts as one night. */
function nightDateKey(measuredAtSec: number): string {
  const d = new Date(measuredAtSec * 1000);
  const hr = d.getUTCHours();
  const anchored = hr >= OVERNIGHT_WINDOW_START_HOUR
    ? new Date(d.getTime() + SECONDS_PER_DAY * 1000)
    : d;
  return anchored.toISOString().slice(0, 10);
}

export const useSpO2 = create<SpO2State>((set, get) => ({
  pending: [],
  recent: [],
  syncing: false,
  syncError: null,

  hydrate: () => {
    const pending = buffer.readAll();
    const recent = readJson<SpO2Sample[]>(STORAGE_KEYS.recentSpO2, []);
    set({ pending, recent });
  },

  addPending: (sample) => {
    buffer.append(sample);
    const pending = buffer.readAll();
    set({ pending });
    logger.track('vital_persisted', { vital_type: 'spo2', count: 1 });
    return sample;
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
    const merged = dedupRecent(
      [...movedRows, ...get().recent].sort(
        (a, b) => b.measuredAtSec - a.measuredAtSec,
      ),
    ).slice(0, RECENT_SAMPLES_CAP);
    set({ pending: remainingPending, recent: merged });
    persistRecent(merged);
    logger.track('vital_sync_accepted', {
      vital_type: 'spo2',
      count: movedRows.length,
    });
  },

  latestPercent: () => {
    const all = [...get().pending, ...get().recent];
    if (all.length === 0) return null;
    const latest = all.reduce((a, b) =>
      b.measuredAtSec > a.measuredAtSec ? b : a,
    );
    return latest.percent;
  },

  overnightLowsRecent: (nowSec, nights) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const N = nights ?? OVERNIGHT_DEFAULT_NIGHTS;
    const all = [...get().pending, ...get().recent];
    if (all.length === 0) return [];
    const byNight = new Map<string, SpO2Sample[]>();
    for (const s of all) {
      if (!inOvernightWindow(s.measuredAtSec)) continue;
      const key = nightDateKey(s.measuredAtSec);
      const arr = byNight.get(key);
      if (arr) arr.push(s);
      else byNight.set(key, [s]);
    }
    const out: number[] = [];
    // Walk from oldest (now - N days) to newest (now), so result is
    // oldest-first as the brief specifies.
    for (let d = N; d >= 0; d--) {
      const key = nightDateKey(now - d * SECONDS_PER_DAY);
      const samples = byNight.get(key);
      if (!samples || samples.length === 0) continue;
      const low = Math.min(...samples.map((s) => s.percent));
      out.push(low);
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
    mmkv.remove(STORAGE_KEYS.recentSpO2);
  },

  reset: () => {
    set({ pending: [], recent: [], syncing: false, syncError: null });
    buffer.clear();
    mmkv.remove(STORAGE_KEYS.recentSpO2);
  },
}));
