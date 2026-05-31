// utils/timezone — zone-aware wall-clock helpers for the vital
// aggregators (state/hr.ts, state/spo2.ts, state/activity.ts).
//
// Why this exists: a vital sample carries a UTC instant (measuredAtSec).
// "Today" and the overnight sleep window must be evaluated in the
// USER'S local timezone, not UTC — otherwise a Lagos user (UTC+1) has
// their day boundary and 22:00–06:00 window shifted by an hour, which
// skews resting-HR / overnight-SpO2 / today's-steps.
//
// Stack note (docs/00-tech-stack.md): no date library is in the stack,
// so conversion uses Intl.DateTimeFormat with a `timeZone` option. On
// Hermes, Intl timezone support varies by platform/RN version, so every
// call is guarded: if Intl throws or returns something unparseable we
// fall back to UTC — i.e. the previous behaviour. A consistent UTC
// boundary is acceptable degradation; a garbage boundary is not.
//
// Pure module: no React, no Zustand, no MMKV. Callers pass the user's
// IANA timezone (e.g. 'Africa/Lagos'); omit/empty/'UTC' all mean UTC.

const MS_PER_SECOND = 1000;

/**
 * True when `timeZone` is absent, empty, or literally 'UTC' — the
 * common case where no conversion is needed (and the cheap path).
 */
function isUtc(timeZone?: string | null): boolean {
  return !timeZone || timeZone === 'UTC';
}

/**
 * Format a UTC instant into the given IANA timezone's calendar parts.
 * Returns null if Intl is unavailable or throws (unknown zone, Hermes
 * gap) so callers can fall back to UTC.
 */
function zonedParts(
  measuredAtSec: number,
  timeZone: string,
): { year: number; month: number; day: number; hour: number } | null {
  try {
    if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return null;
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(new Date(measuredAtSec * MS_PER_SECOND));
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    let hour = Number(get('hour'));
    // h23 should yield 00–23, but some engines emit '24' at midnight.
    if (hour === 24) hour = 0;
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour)
    ) {
      return null;
    }
    return { year, month, day, hour };
  } catch {
    return null;
  }
}

/**
 * Hour-of-day (0–23) for a UTC instant, evaluated in `timeZone`.
 * Falls back to UTC hours when no zone is given or Intl is unavailable.
 */
export function zonedHour(measuredAtSec: number, timeZone?: string | null): number {
  if (isUtc(timeZone)) {
    return new Date(measuredAtSec * MS_PER_SECOND).getUTCHours();
  }
  const parts = zonedParts(measuredAtSec, timeZone as string);
  return parts ? parts.hour : new Date(measuredAtSec * MS_PER_SECOND).getUTCHours();
}

/**
 * Calendar date key 'YYYY-MM-DD' for a UTC instant, evaluated in
 * `timeZone`. Falls back to the UTC date when no zone is given or Intl
 * is unavailable.
 */
export function zonedDateKey(measuredAtSec: number, timeZone?: string | null): string {
  if (isUtc(timeZone)) {
    return new Date(measuredAtSec * MS_PER_SECOND).toISOString().slice(0, 10);
  }
  const parts = zonedParts(measuredAtSec, timeZone as string);
  if (!parts) {
    return new Date(measuredAtSec * MS_PER_SECOND).toISOString().slice(0, 10);
  }
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}
