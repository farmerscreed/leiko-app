// 0x01 — Set time / language. Per docs/_reference/D4-app-strategy.md §4.5.1.
// Format: 01 YY MM DD HH MM SS LANG 00x7 CRC, all date fields BCD-encoded.
// LANG: 0x00 = Simplified Chinese, 0x01 = English.
//
// Called immediately after pair AND on every successful reconnect (the
// watch clock drifts; per protocol page 7, watch stores reading
// timestamps relative to its own clock, so this is load-bearing).

import { expectByte0 } from '../io';
import type { UrionDevice } from '../UrionDevice';

export type Language = 'en' | 'zh';

const langCode: Record<Language, number> = { zh: 0x00, en: 0x01 };

function bcd(n: number): number {
  return ((Math.floor(n / 10) << 4) | (n % 10)) & 0xff;
}

export async function setTime(
  device: UrionDevice,
  options: { now?: Date; language?: Language } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  const language = options.language ?? 'en';
  const payload = new Uint8Array(14);
  payload[0] = bcd(now.getFullYear() % 100);
  payload[1] = bcd(now.getMonth() + 1);
  payload[2] = bcd(now.getDate());
  payload[3] = bcd(now.getHours());
  payload[4] = bcd(now.getMinutes());
  payload[5] = bcd(now.getSeconds());
  payload[6] = langCode[language];
  await device.sendCommand(0x01, payload, expectByte0(0x01));
}
