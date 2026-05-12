// utils/stalenessCaption — Sprint 16.
//
// Pure formatter for the "Last sync 4h ago" caption that every vital
// detail screen + Daily Pulse tile renders when its underlying vital
// crosses the D13 §6.6 staleness threshold.
//
// Voice rules (D11 §3): the caption is calm and factual. Never
// "Outdated" or "Old" — those imply concern. "Last sync …" mirrors
// the on-screen vocabulary the rest of the app uses for sync state.

export const STALENESS_PREFIX = 'Last sync';

/**
 * Build the caption for a stale vital. `lastSampleAtSec` and `nowSec`
 * are Unix seconds. The output is one of:
 *   "Last sync 4h ago"    — at least 1h difference, hours mode
 *   "Last sync 28m ago"   — under 1h, minutes mode
 *   "Last sync just now"  — under 60s (a guard, since the caller is
 *                            only meant to call this for `stale` vitals)
 *   "Last sync 2d ago"    — 48h+
 *   "Last sync Mon"       — 7d+ — fall back to weekday for older
 *
 * Returns null when `lastSampleAtSec` is null — consumers should
 * render a `no-data` empty state instead.
 */
export function formatStalenessCaption(
  lastSampleAtSec: number | null,
  nowSec: number = Math.floor(Date.now() / 1000),
): string | null {
  if (lastSampleAtSec === null) return null;
  const ageSec = Math.max(0, nowSec - lastSampleAtSec);
  if (ageSec < 60) return `${STALENESS_PREFIX} just now`;
  if (ageSec < 3600) {
    const minutes = Math.round(ageSec / 60);
    return `${STALENESS_PREFIX} ${minutes}m ago`;
  }
  if (ageSec < 48 * 3600) {
    const hours = Math.round(ageSec / 3600);
    return `${STALENESS_PREFIX} ${hours}h ago`;
  }
  if (ageSec < 7 * 24 * 3600) {
    const days = Math.round(ageSec / (24 * 3600));
    return `${STALENESS_PREFIX} ${days}d ago`;
  }
  const d = new Date(lastSampleAtSec * 1000);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
  return `${STALENESS_PREFIX} ${weekday}`;
}
