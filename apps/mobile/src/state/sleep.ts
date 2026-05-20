// Sleep state slice — Sprint 7.5 / D13 §2.4 + §6.4.
//
// Per session (one row per sleep session), not per stage transition —
// the watch wraps multi-stage data into a single SleepSession at sync
// time. Dedup key = sessionStartSec.
//
// Aggregators feed the dailyPulse hook + the sleep tile; classifiers
// (classifySleep / computeSleepScore) are NOT called from here.
//
// Per CLAUDE.md data rule: minutes / score values never appear in
// analytics events.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { createPendingVitalBuffer } from '../services/pendingVitalBuffer';
import { logger } from '../services/analytics/logger';
import type { SleepSession } from '../types/vitals';

const RECENT_SESSIONS_CAP = 60;     // ~2 months at 1 session/day
const LAST_NIGHT_LOOKBACK_SEC = 36 * 60 * 60;
const RECENT_DEFAULT_NIGHTS = 14;
const SECONDS_PER_DAY = 24 * 60 * 60;

interface SleepState {
  pending: SleepSession[];
  recent: SleepSession[];
  syncing: boolean;
  syncError: string | null;

  hydrate: () => void;
  addPending: (session: SleepSession) => SleepSession;
  acceptSyncResult: (acceptedKeys: string[]) => void;
  /** Most recent session whose sessionEndSec falls within the last 36
   *  hours, or null. The 36-hour window covers the "user opens app at
   *  09:00 the next morning" case AND the "user opens app at 18:00
   *  having slept the prior night" case. */
  lastNightSession: (nowSec?: number) => SleepSession | null;
  /** Last N nights of completed sessions, oldest first. */
  recentSessions: (nowSec?: number, nights?: number) => SleepSession[];
  /**
   * Sprint 16.5c — seed historical sessions from the server. The U16PRO
   * watch's day-info storage rolls over after a few days, so a reset
   * + re-sync re-pulls only the most recent night from the device. The
   * server retains every session the family ever synced; this method
   * accepts that authoritative list and merges it into `recent`,
   * dedup-ing by `sessionStartSec` (same key the watch-side path uses).
   * Returns the number of NEW sessions added (not duplicates).
   */
  seedFromServer: (sessions: SleepSession[]) => number;
  /** Sprint 17b — visibility purge. Clears `recent` only. */
  clearRecent: () => void;
  reset: () => void;
}

const buffer = createPendingVitalBuffer<SleepSession>({
  storageKey: STORAGE_KEYS.pendingSleep,
  getKey: (s) => String(s.sessionStartSec),
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

function persistRecent(recent: SleepSession[]): void {
  mmkv.set(STORAGE_KEYS.recentSleep, JSON.stringify(recent));
}

function dedupRecent(rows: SleepSession[]): SleepSession[] {
  const seen = new Set<string>();
  const out: SleepSession[] = [];
  for (const r of rows) {
    const key = String(r.sessionStartSec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export const useSleep = create<SleepState>((set, get) => ({
  pending: [],
  recent: [],
  syncing: false,
  syncError: null,

  hydrate: () => {
    const pending = buffer.readAll();
    const recent = readJson<SleepSession[]>(STORAGE_KEYS.recentSleep, []);
    set({ pending, recent });
  },

  addPending: (session) => {
    buffer.append(session);
    const pending = buffer.readAll();
    set({ pending });
    logger.track('vital_persisted', { vital_type: 'sleep', count: 1 });
    return session;
  },

  acceptSyncResult: (acceptedKeys) => {
    if (acceptedKeys.length === 0) return;
    const keySet = new Set(acceptedKeys);
    const currentPending = get().pending;
    const movedRows = currentPending.filter((s) =>
      keySet.has(String(s.sessionStartSec)),
    );
    const remainingPending = currentPending.filter(
      (s) => !keySet.has(String(s.sessionStartSec)),
    );
    for (const k of acceptedKeys) buffer.removeByKey(k);
    const merged = dedupRecent(
      [...movedRows, ...get().recent].sort(
        (a, b) => b.sessionStartSec - a.sessionStartSec,
      ),
    ).slice(0, RECENT_SESSIONS_CAP);
    set({ pending: remainingPending, recent: merged });
    persistRecent(merged);
    logger.track('vital_sync_accepted', {
      vital_type: 'sleep',
      count: movedRows.length,
    });
  },

  lastNightSession: (nowSec) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const all = [...get().pending, ...get().recent];
    if (all.length === 0) return null;
    const inWindow = all.filter(
      (s) => now - s.sessionEndSec <= LAST_NIGHT_LOOKBACK_SEC && s.sessionEndSec <= now,
    );
    if (inWindow.length === 0) return null;
    return inWindow.reduce((a, b) =>
      b.sessionEndSec > a.sessionEndSec ? b : a,
    );
  },

  recentSessions: (nowSec, nights) => {
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    const N = nights ?? RECENT_DEFAULT_NIGHTS;
    const cutoffSec = now - N * SECONDS_PER_DAY;
    const all = [...get().pending, ...get().recent];
    return all
      .filter((s) => s.sessionEndSec >= cutoffSec && s.sessionEndSec <= now)
      .sort((a, b) => a.sessionStartSec - b.sessionStartSec);
  },

  seedFromServer: (sessions) => {
    if (sessions.length === 0) return 0;
    const existing = get().recent;
    const existingKeys = new Set(existing.map((s) => String(s.sessionStartSec)));
    const pendingKeys = new Set(
      get().pending.map((s) => String(s.sessionStartSec)),
    );
    const newRows = sessions.filter((s) => {
      const key = String(s.sessionStartSec);
      return !existingKeys.has(key) && !pendingKeys.has(key);
    });
    if (newRows.length === 0) return 0;
    const merged = dedupRecent(
      [...newRows, ...existing].sort(
        (a, b) => b.sessionStartSec - a.sessionStartSec,
      ),
    ).slice(0, RECENT_SESSIONS_CAP);
    set({ recent: merged });
    persistRecent(merged);
    return newRows.length;
  },

  clearRecent: () => {
    set({ recent: [] });
    mmkv.remove(STORAGE_KEYS.recentSleep);
  },

  reset: () => {
    set({ pending: [], recent: [], syncing: false, syncError: null });
    buffer.clear();
    mmkv.remove(STORAGE_KEYS.recentSleep);
  },
}));
