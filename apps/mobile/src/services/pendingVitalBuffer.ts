// Per-vital MMKV pending buffer — Sprint 7.5 / D13 §5.1.
//
// A thin generic wrapper around mmkv.getString / set for the offline-
// first guarantee on the new vital streams (HR / SpO2 / Sleep /
// Activity / Calories). Mirrors the pattern used by `state/readings.ts`
// for BP, but extracted as a reusable helper so each vital slice
// doesn't re-implement the same JSON-array read/write/dedupe logic.
//
// Why a helper rather than inlining in each slice:
//   • Single test for the offline-first guarantee (write happens before
//     any sync attempt) instead of one per slice.
//   • Dedup keys are vital-specific but the dedup loop is identical —
//     hoist it once.
//   • Failure modes (corrupt JSON, key collisions) recover the same
//     way everywhere.
//
// Per CLAUDE.md data rule: this helper does NOT log values. It logs
// counts only via the analytics layer when called by a slice.

import { mmkv } from './storage';

export interface PendingVitalBuffer<T> {
  /** Reads all pending samples for this vital from MMKV. Empty array
   *  if nothing pending or the JSON blob is corrupt (logs a warning,
   *  does not throw — corrupt buffer means lost telemetry, not a
   *  crashed app). */
  readAll: () => T[];
  /** Append a new sample to the end of the pending list. Synchronous
   *  MMKV write — returns AFTER the write commits, so the caller's
   *  next instruction sees the row in storage. The offline-first
   *  guarantee depends on this synchrony. */
  append: (sample: T) => void;
  /** Replace the entire pending list. Used by syncPending after a
   *  successful upload to remove rows that were acknowledged. */
  replace: (samples: T[]) => void;
  /** Drop a sample by its dedup key (caller-supplied key extractor).
   *  No-op if no match. */
  removeByKey: (key: string) => void;
  /** Test/utility: clear the pending buffer. Does NOT clear MMKV when
   *  called from a slice's reset() — only this helper's view of it. */
  clear: () => void;
}

export interface PendingVitalBufferOptions<T> {
  /** MMKV storage key (from STORAGE_KEYS). */
  storageKey: string;
  /** Extracts a stable dedup key from a sample. Used by removeByKey
   *  and (when callers want to dedup before append) by the slice. */
  getKey: (sample: T) => string;
}

export function createPendingVitalBuffer<T>(
  options: PendingVitalBufferOptions<T>,
): PendingVitalBuffer<T> {
  const { storageKey, getKey } = options;

  function readAll(): T[] {
    const raw = mmkv.getString(storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as T[];
    } catch {
      // Corrupt JSON — drop the buffer. Better to lose telemetry than
      // crash the sync loop on every flush. The next append() rewrites
      // the key with a fresh array.
      return [];
    }
  }

  function write(samples: T[]): void {
    mmkv.set(storageKey, JSON.stringify(samples));
  }

  return {
    readAll,
    append(sample) {
      const current = readAll();
      // Dedup by key — protects against the common "same sample
      // re-emitted while pending" failure mode (BLE notify fires, then
      // a manual sync reads the same range, both call append).
      const key = getKey(sample);
      const filtered = current.filter((s) => getKey(s) !== key);
      filtered.push(sample);
      write(filtered);
    },
    replace(samples) {
      write(samples);
    },
    removeByKey(key) {
      const current = readAll();
      const next = current.filter((s) => getKey(s) !== key);
      if (next.length !== current.length) write(next);
    },
    clear() {
      mmkv.remove(storageKey);
    },
  };
}
