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
import { zonedHour, zonedDateKey } from '../utils/timezone';

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
  overnightLowsRecent: (
    nowSec?: number,
    nights?: number,
    timeZone?: string | null,
  ) => number[];
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

function inOvernightWindow(measuredAtSec: number, timeZone?: string | null): boolean {
  const hr = zonedHour(measuredAtSec, timeZone);
  return hr >= OVERNIGHT_WINDOW_START_HOUR || hr < OVERNIGHT_WINDOW_END_HOUR;
}

/** Anchor each overnight sample to its "owning morning" date in the
 *  user's timezone — matches hr.ts so the two slices align on what
 *  counts as one night. `timeZone` omitted/UTC keeps UTC behaviour. */
function nightDateKey(measuredAtSec: number, timeZone?: string | null): string {
  const hr = zonedHour(measuredAtSec, timeZone);
  const anchorSec =
    hr >= OVERNIGHT_WINDOW_START_HOUR ? measuredAtSec + SECONDS_PER_DAY : measuredAtSec;
  return zonedDateKey(anchorSec, timeZone);
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

  overnightLowsRecent: (nowSec, nights, timeZone) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const N = nights ?? OVERNIGHT_DEFAULT_NIGHTS;
    const all = [...get().pending, ...get().recent];
    if (all.length === 0) return [];
    const byNight = new Map<string, SpO2Sample[]>();
    for (const s of all) {
      if (!inOvernightWindow(s.measuredAtSec, timeZone)) continue;
      const key = nightDateKey(s.measuredAtSec, timeZone);
      const arr = byNight.get(key);
      if (arr) arr.push(s);
      else byNight.set(key, [s]);
    }
    const out: number[] = [];
    // Walk from oldest (now - N days) to newest (now), so result is
    // oldest-first as the brief specifies.
    for (let d = N; d >= 0; d--) {
      const key = nightDateKey(now - d * SECONDS_PER_DAY, timeZone);
      const samples = byNight.get(key);
      if (!samples || samples.length === 0) continue;
      const low = Math.min(...samples.map((s) => s.percent));
      out.push(low);
    }
    return out;
  },

  reset: () => {
    set({ pending: [], recent: [], syncing: false, syncError: null });
    buffer.clear();
    mmkv.remove(STORAGE_KEYS.recentSpO2);
  },
}));
