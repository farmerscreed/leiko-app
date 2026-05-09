// Learn module — day-index helper. Sprint 14 task 1.
//
// Computes "how many local-days have passed since the user's first BP
// reading?" for the seeded onboarding sequence. Uses the user's
// timezone (from the profile) so a reading taken at 11pm doesn't roll
// into the next day's count.
//
// Pure function, dependency-free, runs in tests + on device. Uses
// Intl.DateTimeFormat for timezone math — built into the JavaScript
// engine, no library dependency.
//
// Sourced from:
//   docs/_reference/D9-editorial.md §5 (Day 0/3/7/14 surface schedule)
//   plans/sprint-14-learn-c.md (open prompt #3 — timezone hazards)
//
// "Day 0" = the local day of the first reading. Each subsequent
// midnight in the user's timezone increments the index by 1.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the local-day delta between firstReading and now, or null
 * when no first reading has happened yet.
 *
 * - firstReadingAtSec is null → returns null (caller treats as "no
 *   sequence yet"; the home card slot stays empty)
 * - now is before firstReading → returns 0 (defensive; clock skew or
 *   future-dated reading shouldn't crash)
 * - timezone is invalid or empty → falls back to UTC
 */
export function getDayIndex(
  firstReadingAtSec: number | null,
  nowMs: number,
  timezone: string | null | undefined,
): number | null {
  if (firstReadingAtSec === null) return null;
  const tz = resolveTimezone(timezone);
  const firstDay = localDateMs(firstReadingAtSec * 1000, tz);
  const todayDay = localDateMs(nowMs, tz);
  if (todayDay <= firstDay) return 0;
  return Math.floor((todayDay - firstDay) / MS_PER_DAY);
}

/**
 * Convert a Unix timestamp (ms) to the local-midnight epoch ms in the
 * given timezone. The result is a UTC ms timestamp pointing at
 * midnight of the local calendar day — comparable across timezones
 * for day-difference math.
 */
function localDateMs(timestampMs: number, timezone: string): number {
  // Format the timestamp as YYYY-MM-DD in the target timezone using
  // 'en-CA' locale (which yields ISO date strings reliably).
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(timestampMs))
    .split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return Date.UTC(year, month - 1, day);
}

function resolveTimezone(timezone: string | null | undefined): string {
  if (!timezone || timezone.length === 0) return 'UTC';
  // Validate via a probe; invalid IANA names throw.
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}
