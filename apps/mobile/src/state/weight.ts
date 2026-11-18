// Weight log + target — 2026-11-18.
//
// Weight is one of the biggest levers on blood pressure, so the wearer
// can log it and set a target. Offline-first like readings: an entry is
// written to MMKV first, then posted to /sync-external-vitals as a
// 'leiko_manual' weight (migration 0062). Weights that arrive from a
// scale via Apple Health / Health Connect land in the same table and
// show in the same list when loaded from the server.
//
// Logging also updates users.weight_kg, so the watch gets the new
// weight on its next user-params push (applyDeviceConfig).

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { createPendingVitalBuffer } from '../services/pendingVitalBuffer';
import { supabase } from '../services/supabase';
import { updateProfile } from '../services/users/updateProfile';
import { useAuth } from './auth';

export const MANUAL_WEIGHT_ORIGIN = 'com.leiko.care.manual';
export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 400;
const RECENT_CAP = 400;
const LB_TO_KG = 0.45359237;

export interface WeightEntry {
  measuredAtSec: number;
  kg: number;
  source: 'leiko_manual' | 'apple_health' | 'health_connect';
}

const buffer = createPendingVitalBuffer<WeightEntry>({
  storageKey: STORAGE_KEYS.pendingWeights,
  getKey: (w) => String(w.measuredAtSec),
});

function readRecent(): WeightEntry[] {
  const raw = mmkv.getString(STORAGE_KEYS.recentWeights);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WeightEntry[]) : [];
  } catch {
    return [];
  }
}

function mergeRecent(rows: WeightEntry[]): WeightEntry[] {
  const seen = new Set<string>();
  return rows
    .filter((w) => {
      const k = `${w.source}:${w.measuredAtSec}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.measuredAtSec - a.measuredAtSec)
    .slice(0, RECENT_CAP);
}

export function isValidWeightKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= WEIGHT_KG_MIN && kg <= WEIGHT_KG_MAX;
}

interface WeightState {
  pending: WeightEntry[];
  recent: WeightEntry[];
  syncing: boolean;
  /** All entries, newest first. */
  all: () => WeightEntry[];
  /** Save a weight now (offline-first), then sync. Throws on an
   *  out-of-range value. */
  addEntry: (kg: number, measuredAtSec?: number) => Promise<WeightEntry>;
  /** Post pending manual entries. Safe to call any time. */
  flush: () => Promise<void>;
  /** Pull the wearer's weights (manual + platform) from the server. */
  loadFromServer: () => Promise<void>;
  /** Set or clear the target (kg). */
  setTarget: (kg: number | null) => Promise<void>;
  reset: () => void;
}

export const useWeight = create<WeightState>((set, get) => ({
  pending: buffer.readAll(),
  recent: readRecent(),
  syncing: false,

  all: () => mergeRecent([...get().pending, ...get().recent]),

  addEntry: async (kg, measuredAtSec) => {
    if (!isValidWeightKg(kg)) throw new RangeError('weight_out_of_range');
    const entry: WeightEntry = {
      measuredAtSec: measuredAtSec ?? Math.floor(Date.now() / 1000),
      kg: Math.round(kg * 10) / 10,
      source: 'leiko_manual',
    };
    buffer.append(entry);
    set({ pending: buffer.readAll() });
    // Latest weight also drives the watch's user params.
    const profile = useAuth.getState().profile;
    if (profile) {
      void updateProfile(profile.id, { weight_kg: Math.round(entry.kg) })
        .then(() => useAuth.getState().refreshProfile())
        .catch(() => {});
    }
    void get().flush();
    return entry;
  },

  flush: async () => {
    const pending = buffer.readAll();
    if (pending.length === 0 || get().syncing) return;
    set({ syncing: true });
    try {
      const { data, error } = await supabase.functions.invoke<{
        inserted: number;
        duplicates: number;
        rejected: Array<{ index: number; reason: string }>;
      }>('sync-external-vitals', {
        body: {
          sourcePlatform: 'leiko_manual',
          samples: pending.map((w) => ({
            vitalType: 'weight',
            measuredAtSec: w.measuredAtSec,
            valueNumeric: w.kg,
            valueUnit: 'kg',
            sourceOrigin: MANUAL_WEIGHT_ORIGIN,
          })),
        },
      });
      if (error || !data) return; // stays pending; next flush retries
      // Accepted or permanently rejected → out of pending either way.
      buffer.removeByKeys(pending.map((w) => String(w.measuredAtSec)));
      const rejected = new Set(data.rejected.map((r) => r.index));
      const accepted = pending.filter((_, i) => !rejected.has(i));
      const recent = mergeRecent([...accepted, ...get().recent]);
      mmkv.set(STORAGE_KEYS.recentWeights, JSON.stringify(recent));
      set({ pending: buffer.readAll(), recent });
    } catch {
      // Offline — keep pending.
    } finally {
      set({ syncing: false });
    }
  },

  loadFromServer: async () => {
    const profile = useAuth.getState().profile;
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('external_vitals')
        .select('measured_at, value_numeric, value_unit, source_platform')
        .eq('user_id', profile.id)
        .eq('vital_type', 'weight')
        .eq('hidden', false)
        .order('measured_at', { ascending: false })
        .limit(RECENT_CAP);
      if (error || !data) return;
      const rows: WeightEntry[] = (data as Array<{
        measured_at: string;
        value_numeric: number | string;
        value_unit: string;
        source_platform: WeightEntry['source'];
      }>).map((r) => {
        const v = Number(r.value_numeric);
        const kg = r.value_unit === 'lb' ? v * LB_TO_KG : v;
        return {
          measuredAtSec: Math.floor(Date.parse(r.measured_at) / 1000),
          kg: Math.round(kg * 10) / 10,
          source: r.source_platform,
        };
      });
      const recent = mergeRecent([...rows, ...get().recent]);
      mmkv.set(STORAGE_KEYS.recentWeights, JSON.stringify(recent));
      set({ recent });
    } catch {
      // keep what we have
    }
  },

  setTarget: async (kg) => {
    const profile = useAuth.getState().profile;
    if (!profile) return;
    if (kg !== null && !isValidWeightKg(kg)) throw new RangeError('weight_out_of_range');
    await updateProfile(profile.id, { weight_target_kg: kg === null ? null : Math.round(kg * 10) / 10 });
    await useAuth.getState().refreshProfile();
  },

  reset: () => {
    buffer.clear();
    mmkv.remove(STORAGE_KEYS.recentWeights);
    set({ pending: [], recent: [], syncing: false });
  },
}));

/** Change over the last `days` days: latest minus the entry closest to
 *  `days` ago (not newer than half that window). Null without enough
 *  history. */
export function weightChangeOver(entries: WeightEntry[], days: number, nowSec: number): number | null {
  if (entries.length < 2) return null;
  const latest = entries[0];
  const targetSec = nowSec - days * 86400;
  let best: WeightEntry | null = null;
  for (const e of entries) {
    if (e.measuredAtSec > nowSec - (days * 86400) / 2) continue;
    if (!best || Math.abs(e.measuredAtSec - targetSec) < Math.abs(best.measuredAtSec - targetSec)) best = e;
  }
  if (!best) return null;
  return Math.round((latest.kg - best.kg) * 10) / 10;
}
