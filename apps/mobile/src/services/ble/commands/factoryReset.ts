// 0xFF — Factory reset. Per docs/_reference/U16PRO_protocol_en.pdf §4.14.
// Request: 0xFF 0x66 0x66 00×11 CRC
//   bytes 1-2 = 0x66 0x66 — mandatory verification bytes; the watch
//   only acts if BOTH are 0x66.
// Response: NONE. The watch disconnects immediately and starts a flash
// erase. We use writePacket() directly (NOT sendCommand) so we don't
// wait for a reply that will never arrive.
//
// SAFETY: factoryReset is destructive. The `confirm` parameter is a
// string-literal type; the call site must pass exactly 'erase' or the
// function throws before writing anything. This blocks accidental
// triggering through stale callbacks, generic dispatchers, etc.

import { buildPacket } from '../io';
import type { UrionDevice } from '../UrionDevice';

export async function factoryReset(
  device: UrionDevice,
  confirm: 'erase',
): Promise<void> {
  if (confirm !== 'erase') {
    throw new Error('factoryReset: confirm must be "erase"');
  }
  const payload = new Uint8Array(14);
  payload[0] = 0x66;
  payload[1] = 0x66;
  await device.writePacket(buildPacket(0xff, payload));
}
