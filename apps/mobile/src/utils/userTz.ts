// User timezone — single source of truth for display-time formatting.
// Sprint 18 / SLEEP_TIMEZONE_FIX_BRIEF.
//
// The user's IANA timezone is captured during onboarding
// (SelfBuyerYouScreen + caregiver-fork TimezonePicker), stored in
// `public.users.timezone`, and editable in Settings → Profile. Every
// display path that formats a unix-sec timestamp into a clock time
// MUST consult this — never pass `[]` to toLocaleTimeString, which
// silently falls back to the device-OS timezone and renders the wrong
// hour for users whose chosen tz differs from their phone's.
//
// Why a helper at all: it locates the profile read in one place so the
// fallback chain (profile → device-OS → UTC) is consistent, and gives
// us a Jest seam to stub the user tz in component tests.

import { useAuth } from '../state/auth';

/**
 * Resolve the user's IANA timezone, falling back to the device OS
 * timezone, then to UTC. Read-only — does not subscribe to changes.
 * Use for non-component contexts (sync pipeline, pure helpers).
 */
export function userTz(): string {
  const tz = useAuth.getState().profile?.timezone;
  if (tz && typeof tz === 'string' && tz.length > 0) return tz;
  return deviceTz();
}

/** React hook form — re-renders when the profile tz changes. */
export function useUserTz(): string {
  const profileTz = useAuth((s) => s.profile?.timezone);
  if (profileTz && profileTz.length > 0) return profileTz;
  return deviceTz();
}

/** Device-OS timezone via Intl, or 'UTC' if Intl is unavailable. */
export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Format an epoch-sec timestamp as a clock time in the given IANA
 * timezone. Default formatting matches the Sleep/Activity screens'
 * existing `formatClock` shape: "9:42 AM" / "11:14 PM".
 */
export function formatClockInTz(sec: number, tz: string): string {
  return new Date(sec * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  });
}

/**
 * Format an epoch-sec timestamp as a calendar date (YYYY-MM-DD) in the
 * given IANA timezone. Stable across DST because we use
 * Intl.DateTimeFormat with the explicit zone, not getDate() (which
 * uses the device-OS tz).
 */
export function dayKeyInTz(sec: number, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  }).format(new Date(sec * 1000));
  return parts; // 'en-CA' yields YYYY-MM-DD natively
}

/**
 * Convert a YYYY-MM-DD day-key + an hour-of-day in the given IANA
 * timezone to an epoch-sec UTC timestamp.
 *
 * This is the inverse of `dayKeyInTz`: it answers "what UTC second
 * corresponds to 07:00 local on this day in this tz?".
 *
 * Fractional hours are accepted — e.g. `hourOfDay = 6.5` resolves to
 * 06:30 local. The minute is taken from the fractional component;
 * sub-minute precision is rounded down.
 *
 * Implementation: we anchor with `Date.UTC(year, month-1, day, hour, minute)`
 * which yields an epoch-sec as if the wall clock were UTC, then
 * subtract the tz's offset at that wall-clock moment. The offset is
 * measured by formatting the resulting Date in the target tz and
 * comparing components — accurate across DST boundaries because the
 * formatter applies the actual rules in effect on that date.
 */
export function epochSecForLocalHour(
  dayLocal: string,
  hourOfDay: number,
  tz: string,
): number {
  const [yStr, mStr, dStr] = dayLocal.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  const day = Number(dStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    // Defensive — caller passed a malformed dayLocal.
    return 0;
  }
  const hour = Math.floor(hourOfDay);
  const minute = Math.floor((hourOfDay - hour) * 60);
  // First pass: assume tz offset = 0. We'll measure the actual offset
  // at this wall-clock moment and correct.
  const utcGuess = Date.UTC(year, monthIndex, day, hour, minute, 0);
  const offsetMs = tzOffsetMs(new Date(utcGuess), tz);
  return Math.floor((utcGuess - offsetMs) / 1000);
}

/**
 * Offset in milliseconds between UTC and the given IANA timezone at
 * the given Date instant. Positive when the zone is ahead of UTC
 * (e.g. Africa/Lagos → +3_600_000 ms).
 */
export function tzOffsetMs(at: Date, tz: string): number {
  // Two parallel formats: one in UTC, one in the target tz. The
  // difference between the two reads is the offset.
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const tzParts = partsToObject(tzFormatter.formatToParts(at));
  const utcParts = partsToObject(utcFormatter.formatToParts(at));
  const tzAsUtc = Date.UTC(
    Number(tzParts.year),
    Number(tzParts.month) - 1,
    Number(tzParts.day),
    Number(tzParts.hour === '24' ? '0' : tzParts.hour),
    Number(tzParts.minute),
    Number(tzParts.second),
  );
  const utcAsUtc = Date.UTC(
    Number(utcParts.year),
    Number(utcParts.month) - 1,
    Number(utcParts.day),
    Number(utcParts.hour === '24' ? '0' : utcParts.hour),
    Number(utcParts.minute),
    Number(utcParts.second),
  );
  return tzAsUtc - utcAsUtc;
}

function partsToObject(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return out;
}
