// 0x32 — Start a blood pressure measurement from the app.
//
// NOT in the vendor U16PRO PDF (v1.0.02-250113). Found in Urion's own
// companion app (Alphamed Health 1.0.23, utils/bluetoothManagement.js
// `startBloodPressureMeasure` → createPacket(50)) and verified on two
// U19M watches in Port Harcourt on 2026-11-18: the watch echoes
// `0x32 00×14 0x32` and starts inflating the cuff.
//
// Format:  0x32 00×14 CRC
// Reply:   0x32 00×14 CRC  — accepted, measurement starting
//          0xB2 …          — rejected (bit 7 set = error, per §3 of
//                            the vendor PDF); older firmware may not
//                            support remote start
// Done:    0x33 …          — pushed when the measurement completes
//          (see notify.ts). On a failed measurement (e.g. "wristband
//          pressure too high") the watch sends nothing over BLE — the
//          error is only on the watch screen.

import type { UrionDevice } from '../UrionDevice';
import type { ParsedPacket } from '../io';

export const START_MEASUREMENT_CMD = 0x32;
export const MEASUREMENT_COMPLETE_CMD = 0x33;

export function isStartMeasurementReply(p: ParsedPacket): boolean {
  return p.command === START_MEASUREMENT_CMD || p.command === (START_MEASUREMENT_CMD | 0x80);
}

/**
 * Ask the watch to start a BP measurement. Resolves `true` when the
 * watch accepts (cuff starts inflating), `false` when it rejects the
 * command or doesn't answer in time — callers fall back to "press the
 * BP button on the watch".
 */
export async function startMeasurement(
  device: UrionDevice,
  timeoutMs = 3_000,
): Promise<boolean> {
  try {
    const reply = await device.sendCommand(
      START_MEASUREMENT_CMD,
      undefined,
      isStartMeasurementReply,
      timeoutMs,
    );
    return reply?.command === START_MEASUREMENT_CMD;
  } catch {
    return false;
  }
}
