// When the app last completed a sync with the watch (2026-10-30).
//
// Settings' "Last sync" row used to show the BP history cursor — the
// timestamp of the newest CUFF reading pulled from the watch. With no
// cuff reading for a month it read "31 d ago" while the app was in
// fact syncing every 15 minutes. This records the real thing: the wall
// clock of the last successful watch sync, foreground or background.

import { mmkv, STORAGE_KEYS } from '../storage';

export function recordWatchSync(atMs: number = Date.now()): void {
  mmkv.set(STORAGE_KEYS.lastWatchSyncAtMs, atMs);
}

export function getLastWatchSyncMs(): number | null {
  const v = mmkv.getNumber(STORAGE_KEYS.lastWatchSyncAtMs);
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** "Just now" / "12 min ago" / "3 h ago" / "2 d ago" / "Not yet synced". */
export function formatLastWatchSync(atMs: number | null, nowMs: number = Date.now()): string {
  if (atMs === null) return 'Not yet synced';
  const minutesAgo = Math.floor((nowMs - atMs) / 60_000);
  if (minutesAgo < 1) return 'Just now';
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
