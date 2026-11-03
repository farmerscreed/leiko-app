// Time-shifted duplicate guard for watch BP readings (2026-11-03).
//
// The watch reports reading times as wall-clock values; the app turns
// them into real (UTC) instants with the phone's CURRENT time zone. When
// the app re-pulls the watch's history later (fresh install, new phone,
// cursor reset) from a different zone — or with a different firmware
// offset — the same physical reading arrives with measured_at shifted
// by a whole number of hours. The (family_id, measured_at) unique index
// can't see that, so prod held 49 real readings stored 4x each (147
// extra rows, offsets of 1–10 h).
//
// A twin = same family, source 'watch', identical systolic/diastolic/
// pulse, and measured_at differing by a non-zero multiple of 30 min
// (zones include :30 offsets) within 15 h (the widest zone gap plus the
// +8 h firmware quirk). Times carry seconds, so two genuinely separate
// readings matching on all of that is not a realistic event; the prod
// data had zero same-value pairs at any non-half-hour offset.

export const SHIFT_STEP_SEC = 30 * 60;
export const SHIFT_MAX_SEC = 15 * 60 * 60;

export interface BPTwinCandidate {
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

export interface StoredBP extends BPTwinCandidate {
  id: string;
}

export function isShiftedTwin(a: BPTwinCandidate, b: BPTwinCandidate): boolean {
  if (a.systolic !== b.systolic || a.diastolic !== b.diastolic) return false;
  if ((a.pulse ?? null) !== (b.pulse ?? null)) return false;
  const diffSec = Math.round(
    Math.abs(Date.parse(a.measured_at) - Date.parse(b.measured_at)) / 1000,
  );
  return diffSec > 0 && diffSec <= SHIFT_MAX_SEC && diffSec % SHIFT_STEP_SEC === 0;
}

/**
 * Split incoming watch rows into ones to insert and ones that are a
 * time-shifted copy of a stored reading (or of an earlier row in the same
 * batch). Order of `incoming` is preserved in `fresh`.
 */
export function splitShiftedTwins<T extends BPTwinCandidate>(
  incoming: T[],
  stored: StoredBP[],
): { fresh: T[]; twins: { row: T; existingId: string | null }[] } {
  const fresh: T[] = [];
  const twins: { row: T; existingId: string | null }[] = [];
  for (const row of incoming) {
    const hit = stored.find((s) => isShiftedTwin(s, row));
    if (hit) {
      twins.push({ row, existingId: hit.id });
      continue;
    }
    if (fresh.some((f) => isShiftedTwin(f, row))) {
      twins.push({ row, existingId: null });
      continue;
    }
    fresh.push(row);
  }
  return { fresh, twins };
}

/** The measured_at window to load stored readings for a batch. */
export function twinSearchWindow(rows: BPTwinCandidate[]): { fromIso: string; toIso: string } | null {
  if (rows.length === 0) return null;
  const ts = rows.map((r) => Date.parse(r.measured_at));
  return {
    fromIso: new Date(Math.min(...ts) - SHIFT_MAX_SEC * 1000).toISOString(),
    toIso: new Date(Math.max(...ts) + SHIFT_MAX_SEC * 1000).toISOString(),
  };
}
