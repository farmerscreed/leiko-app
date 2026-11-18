// watchClock — which timezone the watch's wall clock is set in, and how
// to read "now" in that zone without trusting the JS engine's Date zone.
//
// Why this file exists (founder report 2026-11-17): after flying US →
// Lagos the watch face kept showing US time even though the phone had
// switched zones and the app kept syncing. Force-stopping the app fixed
// it. Cause: the JS engine binds Date's local zone once, when the process
// starts. Our BLE foreground service keeps the process alive for days, so
// `new Date().getHours()` (what setTime used) and `getTimezoneOffset()`
// (what the timestamp decoders used) kept answering in the zone the app
// started in. Intl.DateTimeFormat resolves the zone fresh on each call —
// users.timezone had already flipped to Africa/Lagos through Intl while
// the watch was still being set to US time — so everything that touches
// the watch clock now goes through Intl with an explicit zone.
//
// We also remember, per watch, the zone we last set its clock in. The
// watch stamps readings with its own wall clock, so a reading taken
// before a timezone change must be decoded in the OLD zone, not the
// zone we are about to set.

import { mmkv, STORAGE_KEYS } from '../storage';
import { deviceTz } from '../../utils/userTz';
import { resolveTimeZone } from '../../utils/timeInZone';

export interface WallClock {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** 0–23 */
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock fields of `at` as seen in IANA zone `tz`. */
export function wallClockInTz(at: Date, tz: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : 0;
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Some ICU builds still emit "24" at midnight even with h23.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset of `tz` from UTC at instant `at`, in seconds (Lagos → +3600). */
export function tzOffsetSecAt(at: Date, tz: string): number {
  const w = wallClockInTz(at, tz);
  const asUtcMs = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const atWholeSecMs = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((asUtcMs - atWholeSecMs) / 1000);
}

function readMap(): Record<string, string> {
  const raw = mmkv.getString(STORAGE_KEYS.watchClockTzByDevice);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Zone the watch's clock was last set in. Falls back to the phone's
 * current zone for a watch we have never set (first pair) — the same
 * assumption the app made before this file existed.
 */
export function getWatchClockTz(deviceBleId: string): string {
  const tz = readMap()[deviceBleId];
  return tz ? resolveTimeZone(tz) : deviceTz();
}

/** Record the zone we just set the watch clock in. Call only after the
 *  0x01 setTime write was acknowledged. */
export function rememberWatchClockTz(deviceBleId: string, tz: string): void {
  const map = readMap();
  if (map[deviceBleId] === tz) return;
  map[deviceBleId] = tz;
  mmkv.set(STORAGE_KEYS.watchClockTzByDevice, JSON.stringify(map));
}

/** True when any watch we've set is on a different zone than `tz` —
 *  i.e. the phone changed zones since the last clock write. */
export function watchClockOutOfZone(tz: string = deviceTz()): boolean {
  return Object.values(readMap()).some((setTz) => setTz !== tz);
}
