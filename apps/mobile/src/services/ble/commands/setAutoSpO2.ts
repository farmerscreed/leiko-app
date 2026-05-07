// 0x2C — Auto SpO2 measurement enable/disable. Per
// docs/_reference/U16PRO_protocol_en.pdf §4.10.
// Request:  0x2C 0x02 BB 00×12 CRC  (sub-cmd 0x02 = write; BB = 0x01 enable, 0x02 disable)
// Response: 0x2C 0x02 BB 00×12 CRC  (success echoes the request)
//
// Same shape as 0x16 setAutoHR — the watch supports independent
// auto-measurement toggles for HR and SpO2. The orchestrator owns the
// "desired state" cache; this wrapper just writes one packet.

import { expectByte0 } from '../io';
import type { UrionDevice } from '../UrionDevice';

export async function setAutoSpO2(device: UrionDevice, enabled: boolean): Promise<void> {
  const payload = new Uint8Array(14);
  payload[0] = 0x02; // write sub-command
  payload[1] = enabled ? 0x01 : 0x02;
  await device.sendCommand(0x2c, payload, expectByte0(0x2c));
}
