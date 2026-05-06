// 0x50 — Find watch (vibrate 15s). Per docs/_reference/U16PRO_protocol_en.pdf §4.12.
// Format: 0x50 0x55 0xAA 00×12 CRC. The 0x55 0xAA bytes are a mandatory
// "instruction confirmation"; without them the watch replies 0xD0
// (verification error) and does not vibrate.
//
// Used in the multi-watch disambiguation flow (D7 §5.5): "match this
// code on the watch" plus a "Make it buzz" affordance for unambiguous
// physical confirmation. Fire-and-forget; the watch's vibration is the
// success signal — we don't await the 0x50 response to keep the UI
// snappy on real-device latency.

import type { UrionDevice } from '../UrionDevice';

export async function findWatch(device: UrionDevice): Promise<void> {
  const payload = new Uint8Array(14);
  payload[0] = 0x55;
  payload[1] = 0xaa;
  await device.sendCommand(0x50, payload);
}
