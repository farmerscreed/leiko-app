// Rest-period slice — daytime rest / nap estimates (2026-11-18).
//
// Offline-first like the other vital slices: detected periods go to a
// pending MMKV buffer, ride along in the next multi-vitals POST, then
// move to `recent`. Unlike the older slices this one reads MMKV when
// the store is created, so the Sleep screen shows them without a
// separate hydrate call. See services/sleep/detectRestPeriods.ts.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { createPendingVitalBuffer } from '../services/pendingVitalBuffer';
import type { RestPeriod } from '../types/vitals';

const RECENT_CAP = 120;

const buffer = createPendingVitalBuffer<RestPeriod>({
  storageKey: STORAGE_KEYS.pendingRestPeriods,
  getKey: (r) => String(r.startSec),
});

function readRecent(): RestPeriod[] {
  const raw = mmkv.getString(STORAGE_KEYS.recentRestPeriods);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RestPeriod[]) : [];
  } catch {
    return [];
  }
}

interface RestPeriodsState {
  pending: RestPeriod[];
  recent: RestPeriod[];
  addPending: (periods: RestPeriod[]) => void;
  acceptSyncResult: (acceptedKeys: string[]) => void;
  /** All periods (pending + uploaded) on or after `sinceSec`, newest first. */
  since: (sinceSec: number) => RestPeriod[];
  reset: () => void;
}

export const useRestPeriods = create<RestPeriodsState>((set, get) => ({
  pending: buffer.readAll(),
  recent: readRecent(),

  addPending: (periods) => {
    if (periods.length === 0) return;
    const known = new Set([...get().pending, ...get().recent].map((r) => r.startSec));
    for (const p of periods) if (!known.has(p.startSec)) buffer.append(p);
    set({ pending: buffer.readAll() });
  },

  acceptSyncResult: (acceptedKeys) => {
    if (acceptedKeys.length === 0) return;
    const keys = new Set(acceptedKeys);
    const moved = get().pending.filter((r) => keys.has(String(r.startSec)));
    buffer.removeByKeys(acceptedKeys);
    const seen = new Set<number>();
    const recent = [...moved, ...get().recent]
      .filter((r) => (seen.has(r.startSec) ? false : (seen.add(r.startSec), true)))
      .sort((a, b) => b.startSec - a.startSec)
      .slice(0, RECENT_CAP);
    mmkv.set(STORAGE_KEYS.recentRestPeriods, JSON.stringify(recent));
    set({ pending: buffer.readAll(), recent });
  },

  since: (sinceSec) =>
    [...get().pending, ...get().recent]
      .filter((r) => r.startSec >= sinceSec)
      .sort((a, b) => b.startSec - a.startSec),

  reset: () => {
    buffer.clear();
    mmkv.remove(STORAGE_KEYS.recentRestPeriods);
    set({ pending: [], recent: [] });
  },
}));
