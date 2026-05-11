// Readings store — Sprint 6.
//
// Single source of truth for readings on device. Two MMKV-backed
// arrays:
//   pending — captured locally, NOT yet acknowledged by /sync. Source
//             of truth for the offline-first guarantee.
//   recent  — most-recent-first, server-acknowledged readings shown on
//             home + Reading Detail. Capped at RECENT_READINGS_CAP to
//             keep the JSON blob small (no WatermelonDB until Sprint 7+).
//
// addPendingReading writes to pending SYNCHRONOUSLY before the UI is
// allowed to render success. The async sync then promotes from pending
// → recent on /sync acknowledgement, or leaves it in pending for a
// retry on the next connectivity event.
//
// Per CLAUDE.md data rule: reading values (sys/dia/pulse) NEVER appear
// in PostHog/analytics events. The store does NOT log values; it only
// counts (e.g., "reading_persisted" with no payload beyond a tier).

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { logger } from '../services/analytics/logger';
import { classifyReading, type Classification } from '../utils/classification';
import { postReading } from '../services/sync/postReading';
import { forwardReadingToPlatform } from '../services/health-platform/syncBridge';

const RECENT_READINGS_CAP = 30;

export type ReadingSource = 'watch' | 'manual';

export interface LocalReading {
  /** Stable client-side id (UUIDv4). The server-assigned id is recorded separately. */
  localId: string;
  /** Server-assigned UUID once /sync has acknowledged. null until then. */
  serverId: string | null;
  measuredAtSec: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  source: ReadingSource;
  classification: Classification;
  /** ble device MAC for this reading; null for manual entries. */
  deviceBleId: string | null;
  /** ms timestamp of the local insert (used for sort tie-break, debug). */
  capturedAtMs: number;
}

interface ReadingsState {
  pending: LocalReading[];
  recent: LocalReading[];
  syncing: boolean;
  syncError: string | null;

  hydrate: () => void;
  /** Synchronous MMKV write + tier classification. Returns the new row. */
  addPendingReading: (
    input: Omit<LocalReading, 'localId' | 'serverId' | 'classification' | 'capturedAtMs'>,
  ) => LocalReading;
  /** Best-effort sync of every pending row. Idempotent; safe to call repeatedly. */
  syncPending: () => Promise<void>;
  /** Latest reading regardless of pending/recent. UI helper. */
  latest: () => LocalReading | null;
  /** Lookup by localId (UI deep-link). */
  byLocalId: (id: string) => LocalReading | null;
  /**
   * Sprint 12.5 fix — seed recent from server rows. Used on Home
   * first paint when MMKV is empty but the server has readings
   * (typical after a reinstall or MMKV clear). Idempotent: dedupes
   * by serverId, never touches pending, never re-adds a row whose
   * serverId already exists in recent.
   */
  seedRecentFromServer: (rows: LocalReading[]) => number;
  /** Test/utility: drop all rows (does NOT clear MMKV — use clearAll for that). */
  reset: () => void;
}

function uuid(): string {
  // RFC4122 v4. Avoids importing a library; sufficient entropy for client-side ids.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const h = Array.from(bytes, hex);
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = mmkv.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function persist(state: { pending: LocalReading[]; recent: LocalReading[] }) {
  mmkv.set(STORAGE_KEYS.pendingReadings, JSON.stringify(state.pending));
  mmkv.set(STORAGE_KEYS.recentReadings, JSON.stringify(state.recent));
}

export const useReadings = create<ReadingsState>((set, get) => ({
  pending: [],
  recent: [],
  syncing: false,
  syncError: null,

  hydrate: () => {
    const pending = readJson<LocalReading[]>(STORAGE_KEYS.pendingReadings, []);
    const recent = readJson<LocalReading[]>(STORAGE_KEYS.recentReadings, []);
    set({ pending, recent });
  },

  addPendingReading: (input) => {
    const classification = classifyReading(
      { systolic: input.systolic, diastolic: input.diastolic, pulse: input.pulse },
      null, // cold-start; baseline computation deferred to Sprint 15
    );
    const row: LocalReading = {
      ...input,
      localId: uuid(),
      serverId: null,
      classification,
      capturedAtMs: Date.now(),
    };
    const pending = [row, ...get().pending];
    const recent = get().recent;
    set({ pending });
    persist({ pending, recent });
    logger.track('reading_persisted', {
      source: row.source,
      tier: classification.tier,
    });
    // Fire-and-forget sync; UI doesn't await this.
    void get().syncPending();
    return row;
  },

  syncPending: async () => {
    if (get().syncing) return;
    set({ syncing: true, syncError: null });
    try {
      // Track sync results by localId rather than snapshotting `pending`
      // up-front. addPendingReading triggers syncPending() synchronously,
      // and the first call's `await postReading(...)` yields control —
      // during which subsequent addPendingReading calls grow `pending`.
      // The naive "snapshot then overwrite" approach loses those new
      // rows. By only removing synced ids at the end, new rows survive.
      const syncedIds = new Set<string>();
      const newRecentRows: LocalReading[] = [];
      let lastError: string | null = null;
      // Multiple passes catch rows added between iterations of the
      // outer loop. Capped to prevent runaway loops in pathological
      // cases (in practice 1-2 passes is enough).
      for (let pass = 0; pass < 5; pass++) {
        const snapshot = get().pending.filter(
          (r) => !syncedIds.has(r.localId),
        );
        if (snapshot.length === 0) break;
        let bailOnError = false;
        for (const row of snapshot) {
          try {
            const res = await postReading(row);
            syncedIds.add(row.localId);
            newRecentRows.unshift({ ...row, serverId: res.readingId });
            logger.track('reading_sync_success', { duplicate: res.duplicate });
            // Forward to Apple Health / Health Connect — Sprint 9.5.
            // Only on first-insert (skip on duplicate to avoid writing the
            // same sample twice on retry). Fire-and-forget; the bridge
            // gates on account_type + master/per-vital toggles.
            if (!res.duplicate) {
              void forwardReadingToPlatform({
                measuredAtSec: row.measuredAtSec,
                systolic: row.systolic,
                diastolic: row.diastolic,
                pulse: row.pulse,
                source: row.source,
              });
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : 'sync failed';
            logger.track('reading_sync_failed', { reason: lastError });
            // Treat the first failure as a network outage signal —
            // stop trying further rows; they'll be retried on the
            // next sync trigger. Avoids hammering an offline backend.
            bailOnError = true;
            break;
          }
        }
        if (bailOnError) break;
      }
      const finalPending = get().pending.filter(
        (r) => !syncedIds.has(r.localId),
      );
      const finalRecent = [...newRecentRows, ...get().recent].slice(
        0,
        RECENT_READINGS_CAP,
      );
      set({ pending: finalPending, recent: finalRecent, syncError: lastError });
      persist({ pending: finalPending, recent: finalRecent });
    } finally {
      set({ syncing: false });
    }
  },

  latest: () => {
    const all = [...get().pending, ...get().recent];
    if (all.length === 0) return null;
    // Order by measuredAtSec (the canonical "when the reading
    // happened"), then capturedAtMs as tiebreak. capturedAtMs alone
    // ties when a backlog batch is added in a tight loop with the
    // same Date.now() value across rows.
    return all.reduce((a, b) => {
      if (b.measuredAtSec !== a.measuredAtSec) {
        return b.measuredAtSec > a.measuredAtSec ? b : a;
      }
      return b.capturedAtMs > a.capturedAtMs ? b : a;
    });
  },

  byLocalId: (id) => {
    return (
      get().pending.find((r) => r.localId === id) ??
      get().recent.find((r) => r.localId === id) ??
      null
    );
  },

  seedRecentFromServer: (rows) => {
    const existing = get().recent;
    const existingServerIds = new Set(
      existing.map((r) => r.serverId).filter((id): id is string => id !== null),
    );
    const newRows = rows.filter(
      (r) => r.serverId !== null && !existingServerIds.has(r.serverId),
    );
    if (newRows.length === 0) return 0;
    // Merge + sort newest-first by measuredAtSec. Persist to MMKV
    // so subsequent app launches don't re-fetch.
    const merged = [...newRows, ...existing].sort(
      (a, b) => b.measuredAtSec - a.measuredAtSec,
    );
    const pending = get().pending;
    set({ recent: merged });
    persist({ pending, recent: merged });
    return newRows.length;
  },

  reset: () => {
    set({ pending: [], recent: [], syncing: false, syncError: null });
    mmkv.remove(STORAGE_KEYS.pendingReadings);
    mmkv.remove(STORAGE_KEYS.recentReadings);
  },
}));
