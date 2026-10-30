// utils/stalenessCaption — Sprint 16.
//
// Pure formatter for the "Last reading 4h ago" caption that every vital
// detail screen + Daily Pulse tile renders when its underlying vital
// crosses the D13 §6.6 staleness threshold.
//
// Voice rules (D11 §3): the caption is calm and factual. Never
// "Outdated" or "Old" — those imply concern. "Last reading …" mirrors
// the on-screen vocabulary the rest of the app uses for sync state.

// 2026-10-30 release audit: this caption describes when the vital's
// newest SAMPLE was taken, not when the app last synced. With background
// sync working, "Last sync Mon" on a screen the phone had just synced
// was false — and for a month-old reading "Mon" hid that it was a month
// old. Now "Last reading …", and anything older than a week shows the
// date ("Last reading Sep 28").
export const STALENESS_PREFIX = 'Last reading';

/**
 * Build the caption for a stale vital. `lastSampleAtSec` and `nowSec`
 * are Unix seconds. The output is one of:
 *   "Last reading 4h ago"    — at least 1h difference, hours mode
 *   "Last reading 28m ago"   — under 1h, minutes mode
 *   "Last reading just now"  — under 60s (a guard, since the caller is
 *                            only meant to call this for `stale` vitals)
 *   "Last reading 2d ago"    — 48h+
 *   "Last reading Sep 28" — 7d+ — the date, so a month-old reading looks it
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
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${STALENESS_PREFIX} ${date}`;
}

/**
 * Sprint 16.5f — a short reassurance hint that explains WHY the vital
 * is stale and what the user can do about it. Surfaced alongside the
 * staleness caption on detail screens so a user with 3 stale captions
 * doesn't wonder if the watch is broken — the hint tells them how to
 * refresh.
 *
 * Voice rules: calm, no fear. Leads with what *will* happen.
 */
export function stalenessReassuranceHint(): string {
  return 'Open the app within Bluetooth range to refresh.';
}
