// Activity state slice — Sprint 7.5 / D13 §1 (calories rides with
// activity) + §6.5.
//
// Combined steps + calories in one slice because the dailyPulse
// selector and the activity tile both need both numbers, and the
// ring fills against totalSteps / targetSteps. Two pending buffers +
// two recent arrays, but a single Zustand store keeps them coherent.
//
// Dedup key for both ActivityDay and CaloriesDay = dayLocal (one row
// per day per vital).
//
// Per CLAUDE.md data rule: step counts and kcal values never appear
// in analytics events.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { createPendingVitalBuffer } from '../services/pendingVitalBuffer';
import { logger } from '../services/analytics/logger';
import type { ActivityDay, CaloriesDay } from '../types/vitals';
import { zonedDateKey } from '../utils/timezone';

const RECENT_DAYS_CAP = 90;        // rolling 90-day window per vital
const RECENT_DEFAULT_DAYS = 14;
const SECONDS_PER_DAY = 24 * 60 * 60;

interface ActivityState {
  pendingSteps: ActivityDay[];
  recentSteps: ActivityDay[];
  pendingCalories: CaloriesDay[];
  recentCalories: CaloriesDay[];
  syncing: boolean;
  syncError: string | null;

  hydrate: () => void;
  addPendingSteps: (day: ActivityDay) => ActivityDay;
  addPendingCalories: (day: CaloriesDay) => CaloriesDay;
  acceptStepsSyncResult: (acceptedKeys: string[]) => void;
  acceptCaloriesSyncResult: (acceptedKeys: string[]) => void;
  /** Today's ActivityDay if present, else null. Today is the user-
   *  local YYYY-MM-DD of nowSec — interpreted in UTC for test
   *  determinism (matches fixtures.js dayLocal()). Production callers
   *  pass a TZ-aware nowSec; the fixture builder also uses UTC. */
  todaySteps: (nowSec?: number, timeZone?: string | null) => ActivityDay | null;
  todayCalories: (nowSec?: number, timeZone?: string | null) => CaloriesDay | null;
  /** Per-day step totals for the last N days, oldest first. Empty
   *  days skipped (not zero-filled). */
  recentStepDays: (nowSec?: number, days?: number) => number[];
  reset: () => void;
}

const stepsBuffer = createPendingVitalBuffer<ActivityDay>({
  storageKey: STORAGE_KEYS.pendingActivity,
  getKey: (d) => d.dayLocal,
});

const caloriesBuffer = createPendingVitalBuffer<CaloriesDay>({
  storageKey: STORAGE_KEYS.pendingCalories,
  getKey: (d) => d.dayLocal,
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

function persistRecentSteps(rows: ActivityDay[]): void {
  mmkv.set(STORAGE_KEYS.recentActivity, JSON.stringify(rows));
}

function persistRecentCalories(rows: CaloriesDay[]): void {
  mmkv.set(STORAGE_KEYS.recentCalories, JSON.stringify(rows));
}

function dedupBy<T>(rows: T[], keyOf: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key = keyOf(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function todayKey(nowSec: number, timeZone?: string | null): string {
  return zonedDateKey(nowSec, timeZone);
}

export const useActivity = create<ActivityState>((set, get) => ({
  pendingSteps: [],
  recentSteps: [],
  pendingCalories: [],
  recentCalories: [],
  syncing: false,
  syncError: null,

  hydrate: () => {
    const pendingSteps = stepsBuffer.readAll();
    const pendingCalories = caloriesBuffer.readAll();
    const recentSteps = readJson<ActivityDay[]>(STORAGE_KEYS.recentActivity, []);
    const recentCalories = readJson<CaloriesDay[]>(STORAGE_KEYS.recentCalories, []);
    set({ pendingSteps, pendingCalories, recentSteps, recentCalories });
  },

  addPendingSteps: (day) => {
    stepsBuffer.append(day);
    const pendingSteps = stepsBuffer.readAll();
    set({ pendingSteps });
    logger.track('vital_persisted', { vital_type: 'activity', count: 1 });
    return day;
  },

  addPendingCalories: (day) => {
    caloriesBuffer.append(day);
    const pendingCalories = caloriesBuffer.readAll();
    set({ pendingCalories });
    logger.track('vital_persisted', { vital_type: 'calories', count: 1 });
    return day;
  },

  acceptStepsSyncResult: (acceptedKeys) => {
    if (acceptedKeys.length === 0) return;
    const keySet = new Set(acceptedKeys);
    const currentPending = get().pendingSteps;
    const movedRows = currentPending.filter((d) => keySet.has(d.dayLocal));
    const remainingPending = currentPending.filter((d) => !keySet.has(d.dayLocal));
    for (const k of acceptedKeys) stepsBuffer.removeByKey(k);
    const merged = dedupBy(
      [...movedRows, ...get().recentSteps].sort((a, b) =>
        b.dayLocal.localeCompare(a.dayLocal),
      ),
      (d) => d.dayLocal,
    ).slice(0, RECENT_DAYS_CAP);
    set({ pendingSteps: remainingPending, recentSteps: merged });
    persistRecentSteps(merged);
    logger.track('vital_sync_accepted', {
      vital_type: 'activity',
      count: movedRows.length,
    });
  },

  acceptCaloriesSyncResult: (acceptedKeys) => {
    if (acceptedKeys.length === 0) return;
    const keySet = new Set(acceptedKeys);
    const currentPending = get().pendingCalories;
    const movedRows = currentPending.filter((d) => keySet.has(d.dayLocal));
    const remainingPending = currentPending.filter((d) => !keySet.has(d.dayLocal));
    for (const k of acceptedKeys) caloriesBuffer.removeByKey(k);
    const merged = dedupBy(
      [...movedRows, ...get().recentCalories].sort((a, b) =>
        b.dayLocal.localeCompare(a.dayLocal),
      ),
      (d) => d.dayLocal,
    ).slice(0, RECENT_DAYS_CAP);
    set({ pendingCalories: remainingPending, recentCalories: merged });
    persistRecentCalories(merged);
    logger.track('vital_sync_accepted', {
      vital_type: 'calories',
      count: movedRows.length,
    });
  },

  todaySteps: (nowSec, timeZone) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const key = todayKey(now, timeZone);
    const all = [...get().pendingSteps, ...get().recentSteps];
    return all.find((d) => d.dayLocal === key) ?? null;
  },

  todayCalories: (nowSec, timeZone) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const key = todayKey(now, timeZone);
    const all = [...get().pendingCalories, ...get().recentCalories];
    return all.find((d) => d.dayLocal === key) ?? null;
  },

  recentStepDays: (nowSec, days) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const N = days ?? RECENT_DEFAULT_DAYS;
    const all = [...get().pendingSteps, ...get().recentSteps];
    if (all.length === 0) return [];
    const byDay = new Map<string, ActivityDay>();
    for (const d of all) {
      // Keep the freshest by dayLocal — pending overrides recent
      // because pendingSteps comes first in `all`.
      if (!byDay.has(d.dayLocal)) byDay.set(d.dayLocal, d);
    }
    const out: number[] = [];
    for (let i = N; i >= 1; i--) {
      const key = todayKey(now - i * SECONDS_PER_DAY);
      const day = byDay.get(key);
      if (!day) continue;
      out.push(day.totalSteps);
    }
    return out;
  },

  reset: () => {
    set({
      pendingSteps: [],
      recentSteps: [],
      pendingCalories: [],
      recentCalories: [],
      syncing: false,
      syncError: null,
    });
    stepsBuffer.clear();
    caloriesBuffer.clear();
    mmkv.remove(STORAGE_KEYS.recentActivity);
    mmkv.remove(STORAGE_KEYS.recentCalories);
  },
}));
