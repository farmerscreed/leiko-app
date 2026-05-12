// Quiet-hours helpers — Sprint 15.
//
// Extracted from send-push/index.ts so the unit test can import them
// without triggering Deno.serve at module load.

export function parseHHMM(s: string): [number, number] {
  const [h, m] = s.split(':').map((p) => parseInt(p, 10));
  return [h ?? 0, m ?? 0];
}

export function nowInTimezone(
  now: Date,
  timezone: string,
): { hour: number; minute: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = fmt.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
    return { hour, minute };
  } catch {
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

/**
 * True when `now` (interpreted in `timezone`) falls inside the
 * [start, end) window. Cross-midnight (e.g. 22:00–07:00) is supported.
 */
export function isWithinQuietWindow(
  now: Date,
  start: string,
  end: string,
  timezone: string,
): boolean {
  const local = nowInTimezone(now, timezone);
  const [sh, sm] = parseHHMM(start);
  const [eh, em] = parseHHMM(end);
  const nowMins = local.hour * 60 + local.minute;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (startMins <= endMins) {
    return nowMins >= startMins && nowMins < endMins;
  }
  return nowMins >= startMins || nowMins < endMins;
}
