// Learn seed tracking — Sprint 14 task 2.
//
// Persistent (MMKV-backed) record of which seeded Learn cards the
// user has dismissed or opened, with timestamps so the hide windows
// decay correctly:
//
//   - Dismissed → hidden for 30 days
//   - Read      → hidden for 90 days
//
// Both windows are independent. A card the user dismissed three
// weeks ago and then opened today resets to a 90-day "read" hide
// window. A card read 80 days ago and dismissed today extends its
// hide to dismiss + 30 days from now (whichever is further out).
//
// Sourced from:
//   plans/sprint-14-learn-c.md (acceptance criteria — 30/90 day windows)
//   docs/_reference/D9-editorial.md §5 (seeded onboarding cadence)
//
// Storage shape — JSON map keyed by article id:
//   { "numbers-001": { "dismissedAt": 1715000000000, "readAt": null }, ... }
// MMKV key: leiko.learn.seedTracking (see services/storage.ts).
//
// MMKV mirroring — every state mutation writes through to MMKV
// synchronously so a hard kill in the middle of a tap never loses
// the latest dismiss / read flag. The store is hydrated from MMKV
// once at module load.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DISMISS_HIDE_MS = 30 * MS_PER_DAY;
const READ_HIDE_MS = 90 * MS_PER_DAY;

export interface SeedTrackEntry {
  /** ms epoch when the user dismissed this card; null if never dismissed. */
  dismissedAt: number | null;
  /** ms epoch when the user opened this card; null if never opened. */
  readAt: number | null;
}

export type SeedTrackingMap = Record<string, SeedTrackEntry>;

export interface LearnSeedState {
  tracking: SeedTrackingMap;
  /** Mark an article as dismissed. Defaults to Date.now() — pass nowMs in tests. */
  markDismissed: (articleId: string, nowMs?: number) => void;
  /** Mark an article as read (the user opened it). */
  markRead: (articleId: string, nowMs?: number) => void;
  /**
   * True if the article is inside an active dismiss or read hide
   * window. Used by the seed-selection algorithm before considering
   * the article a candidate.
   */
  isHidden: (articleId: string, nowMs?: number) => boolean;
  /**
   * True if the article was opened (read) at any point — used by the
   * Day-7 / Day-14 fixed surfaces to skip articles the user has
   * already seen even after the 90-day window has lapsed.
   */
  hasEverBeenRead: (articleId: string) => boolean;
  /** Test-only helper to seed state. */
  _hydrate: (tracking: SeedTrackingMap) => void;
}

function loadFromStorage(): SeedTrackingMap {
  const raw = mmkv.getString(STORAGE_KEYS.learnSeedTracking);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SeedTrackingMap;
    }
    return {};
  } catch {
    return {};
  }
}

function persist(map: SeedTrackingMap): void {
  mmkv.set(STORAGE_KEYS.learnSeedTracking, JSON.stringify(map));
}

export function isHiddenByEntry(
  entry: SeedTrackEntry | undefined,
  nowMs: number,
): boolean {
  if (!entry) return false;
  if (entry.dismissedAt !== null && nowMs - entry.dismissedAt < DISMISS_HIDE_MS) {
    return true;
  }
  if (entry.readAt !== null && nowMs - entry.readAt < READ_HIDE_MS) {
    return true;
  }
  return false;
}

export const useLearnSeed = create<LearnSeedState>((set, get) => ({
  tracking: loadFromStorage(),

  markDismissed: (articleId, nowMs = Date.now()) => {
    const next: SeedTrackingMap = { ...get().tracking };
    const existing = next[articleId];
    next[articleId] = {
      dismissedAt: nowMs,
      readAt: existing?.readAt ?? null,
    };
    persist(next);
    set({ tracking: next });
  },

  markRead: (articleId, nowMs = Date.now()) => {
    const next: SeedTrackingMap = { ...get().tracking };
    const existing = next[articleId];
    next[articleId] = {
      dismissedAt: existing?.dismissedAt ?? null,
      readAt: nowMs,
    };
    persist(next);
    set({ tracking: next });
  },

  isHidden: (articleId, nowMs = Date.now()) =>
    isHiddenByEntry(get().tracking[articleId], nowMs),

  hasEverBeenRead: (articleId) => {
    const entry = get().tracking[articleId];
    return entry?.readAt !== null && entry?.readAt !== undefined;
  },

  _hydrate: (tracking) => {
    persist(tracking);
    set({ tracking });
  },
}));
