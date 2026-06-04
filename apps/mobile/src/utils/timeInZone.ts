// utils/timeInZone — timezone-aware time rendering (vitals data-completeness fix).
//
// Why: the VitalDetail screens formatted every timestamp with the JS
// engine's *device* timezone (`new Date(ms).toLocaleTimeString()`,
// `.getHours()`, `.toDateString()`). That silently ignores the user's
// `users.timezone` (the Settings value), so "today", "morning/evening",
// the hourly chart buckets, and the row times are all wrong whenever the
// device timezone differs from the wearer's — e.g. a caregiver abroad
// viewing a parent's readings, or a user who travelled. Settings even
// promises "Your timezone controls when 'today' starts for your trends".
//
// These helpers thread an explicit IANA `timeZone` through every
// time-derived value. They deliberately keep the *device locale* (passing
// `undefined` as the locale) so only the zone changes — formatting style,
// 12/24h, and language stay exactly as before; this also keeps the
// existing snapshot/format tests stable (jest runs under TZ=UTC).
//
// Mirrors the timezone-resolution approach already proven in
// services/learn/dayIndex.ts (Intl.DateTimeFormat, no extra dependency).

/**
 * Validate an IANA timezone name; empty / invalid / nullish → 'UTC'.
 * Invalid names make Intl.DateTimeFormat throw, so we probe once.
 */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone || timeZone.length === 0) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/** "h:mm AM" (device locale) for the instant `ms`, read in `timeZone`. */
export function timeInZone(ms: number, timeZone: string | null | undefined): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    timeZone: resolveTimeZone(timeZone),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Short or long weekday name (device locale) at `ms`, read in `timeZone`. */
export function weekdayInZone(
  ms: number,
  timeZone: string | null | undefined,
  style: 'short' | 'long' = 'short',
): string {
  return new Date(ms).toLocaleDateString(undefined, {
    timeZone: resolveTimeZone(timeZone),
    weekday: style,
  });
}

/** "Mon 5" style month + day (device locale) at `ms`, read in `timeZone`. */
export function monthDayInZone(ms: number, timeZone: string | null | undefined): string {
  return new Date(ms).toLocaleDateString(undefined, {
    timeZone: resolveTimeZone(timeZone),
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Hour-of-day (0–23) at `ms` as seen in `timeZone`. Replaces
 * `new Date(ms).getHours()`, which uses the device zone. Uses the h23
 * hour cycle so midnight is 0 (not 24).
 */
export function hourInZone(ms: number, timeZone: string | null | undefined): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(new Date(ms));
  return Number(s) % 24;
}

/**
 * Local calendar day key "YYYY-MM-DD" at `ms` in `timeZone`. Replaces
 * `new Date(ms).toDateString()` for same-day comparisons so "today" is
 * the wearer's local day, not the device's. 'en-CA' yields ISO order.
 */
export function dayKeyInZone(ms: number, timeZone: string | null | undefined): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}
