// 0x16 — Auto heart-rate measurement enable/disable. Per
// docs/_reference/U16PRO_protocol_en.pdf §4.7.
// Request:  0x16 0x02 BB 00×12 CRC  (sub-cmd 0x02 = write; BB = 0x01 enable, 0x02 disable)
// Response: 0x16 0x02 BB 00×12 CRC  (success echoes the request)
//
// The orchestrator decides when to flip auto-HR (e.g. on first connect
// of a per-persona profile) and re-issues this whenever the cached
// device-state diverges from the desired state.

import { expectByte0 } from '../io';
import type { UrionDevice } from '../UrionDevice';

export async function setAutoHR(device: UrionDevice, enabled: boolean): Promise<void> {
  const payload = new Uint8Array(14);
  payload[0] = 0x02; // write sub-command
  payload[1] = enabled ? 0x01 : 0x02;
  await device.sendCommand(0x16, payload, expectByte0(0x16));
}
