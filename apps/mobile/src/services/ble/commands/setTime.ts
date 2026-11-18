// 0x01 — Set time / language. Per docs/_reference/D4-app-strategy.md §4.5.1.
// Format: 01 YY MM DD HH MM SS LANG 00x7 CRC, all date fields BCD-encoded.
// LANG: 0x00 = Simplified Chinese, 0x01 = English.
//
// Called immediately after pair AND on every successful reconnect (the
// watch clock drifts; per protocol page 7, watch stores reading
// timestamps relative to its own clock, so this is load-bearing).

//
// The wall-clock fields come from Intl in an explicit IANA zone (default:
// the phone's zone right now), NOT from Date's local getters — the JS
// engine pins Date's zone at process start, so after a flight the watch
// kept being set to the departure zone until the app was force-stopped.
// See ../watchClock.ts.

import { expectByte0 } from '../io';
import type { UrionDevice } from '../UrionDevice';
import { wallClockInTz } from '../watchClock';
import { deviceTz } from '../../../utils/userTz';

export type Language = 'en' | 'zh';

const langCode: Record<Language, number> = { zh: 0x00, en: 0x01 };

function bcd(n: number): number {
  return ((Math.floor(n / 10) << 4) | (n % 10)) & 0xff;
}

export async function setTime(
  device: UrionDevice,
  options: { now?: Date; language?: Language; timeZone?: string } = {},
): Promise<{ timeZone: string }> {
  const now = options.now ?? new Date();
  const language = options.language ?? 'en';
  const timeZone = options.timeZone ?? deviceTz();
  const w = wallClockInTz(now, timeZone);
  const payload = new Uint8Array(14);
  payload[0] = bcd(w.year % 100);
  payload[1] = bcd(w.month);
  payload[2] = bcd(w.day);
  payload[3] = bcd(w.hour);
  payload[4] = bcd(w.minute);
  payload[5] = bcd(w.second);
  payload[6] = langCode[language];
  await device.sendCommand(0x01, payload, expectByte0(0x01));
  return { timeZone };
}
