// PersonCard footer label — extracted from CaregiverHome 2026-10-30.
//
// The footer used to look only at the latest BP (cuff) reading, so a
// wearer whose watch synced heart rate every 15 minutes still read
// "Last reading · 31 days ago". Now:
//
//   BP within 12h                     → "Read · 6:42 am"
//   BP older, another vital ≤ 12h     → "Last BP · 31 days ago · Synced 10:21 am"
//   no BP,   another vital ≤ 12h      → "No BP yet · Synced 10:21 am"
//   BP older, nothing else recent     → "Last reading · 31 days ago"
//   nothing at all                    → "No readings yet"
//
// "Synced" uses the newest non-BP sample time — the moment the watch last
// delivered data a viewer (possibly another phone) can see.

export const FOOTER_STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export function humanizeFooterAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function parse(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function formatPersonFooter(
  bpMeasuredAtIso: string | null | undefined,
  otherVitalIsos: ReadonlyArray<string | null | undefined>,
  nowMs: number,
): string {
  const bpMs = parse(bpMeasuredAtIso);
  const others = otherVitalIsos.map(parse).filter((t): t is number => t !== null);
  const freshestOther = others.length > 0 ? Math.max(...others) : null;
  const otherFresh =
    freshestOther !== null && nowMs - freshestOther <= FOOTER_STALE_THRESHOLD_MS;

  if (bpMs !== null && nowMs - bpMs <= FOOTER_STALE_THRESHOLD_MS) {
    return `Read · ${clock(bpMs)}`;
  }
  if (otherFresh && freshestOther !== null) {
    const synced = `Synced ${clock(freshestOther)}`;
    if (bpMs === null) return `No BP yet · ${synced}`;
    return `Last BP · ${humanizeFooterAge(Math.max(0, nowMs - bpMs))} ago · ${synced}`;
  }
  if (bpMs !== null) return `Last reading · ${humanizeFooterAge(Math.max(0, nowMs - bpMs))} ago`;
  return 'No readings yet';
}
