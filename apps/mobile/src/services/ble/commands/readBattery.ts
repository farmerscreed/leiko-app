// 0x03 — Read battery level. Per docs/_reference/U16PRO_protocol_en.pdf §4.2.
// Request:  0x03 00×14 CRC
// Response: 0x03 BB 00×13 CRC where BB = battery percentage (0–100).

import { expectByte0 } from '../io';
import type { UrionDevice } from '../UrionDevice';

export async function readBattery(
  device: UrionDevice,
  timeoutMs = 5_000,
): Promise<number> {
  const response = await device.sendCommand(0x03, undefined, expectByte0(0x03), timeoutMs);
  if (!response) throw new Error('readBattery: no response');
  const pct = response.payload[0];
  if (pct < 0 || pct > 100) {
    throw new Error(`readBattery: out-of-range value ${pct}`);
  }
  return pct;
}
