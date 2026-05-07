// 0x21 — Set daily activity goals. Per docs/_reference/U16PRO_protocol_en.pdf §4.9.
// Request:  0x21 AA BB CC DD EE FF GG HH II JJ KK LL MM NN CRC
// Response: 0x21 ... (success echoes the request — validate via expectByte0(0x21))
//
// Payload byte layout (0-indexed; matches the code below):
//   payload[0]      : 0x02 (write sub-command; 0x01 = read-current)
//   payload[1..3]   : step target          (LITTLE-ENDIAN, 3 bytes)
//   payload[4..5]   : calorie target kcal  (LITTLE-ENDIAN, 2 bytes)
//   payload[6]      : standing target hrs  (1 byte)
//   payload[7..9]   : distance target m    (LITTLE-ENDIAN, 3 bytes)
//   payload[10..11] : sleep target min     (LITTLE-ENDIAN, 2 bytes)
//   payload[12..13] : exercise target min  (LITTLE-ENDIAN, 2 bytes)
// Total: 14 bytes — fills the payload exactly.

import { expectByte0 } from '../io';
import type { UrionDevice } from '../UrionDevice';

export interface UrionGoals {
  stepsTarget: number; // 0..2^24-1
  kcalTarget: number; // 0..2^16-1
  standingTargetHours: number; // 0..255
  distanceTargetMeters: number; // 0..2^24-1
  sleepTargetMinutes: number; // 0..2^16-1
  exerciseTargetMinutes: number; // 0..2^16-1
}

function writeLE(buf: Uint8Array, offset: number, value: number, byteCount: number): void {
  let v = value >>> 0;
  for (let i = 0; i < byteCount; i++) {
    buf[offset + i] = v & 0xff;
    v >>>= 8;
  }
}

export async function setGoals(device: UrionDevice, goals: UrionGoals): Promise<void> {
  const payload = new Uint8Array(14);
  payload[0] = 0x02; // write sub-command
  writeLE(payload, 1, goals.stepsTarget, 3); //   bytes 1..3  step target
  writeLE(payload, 4, goals.kcalTarget, 2); //    bytes 4..5  kcal target
  payload[6] = goals.standingTargetHours & 0xff; // byte 6     standing hrs
  writeLE(payload, 7, goals.distanceTargetMeters, 3); // bytes 7..9   distance m
  writeLE(payload, 10, goals.sleepTargetMinutes, 2); // bytes 10..11  sleep min
  writeLE(payload, 12, goals.exerciseTargetMinutes, 2); // bytes 12..13 exercise min
  await device.sendCommand(0x21, payload, expectByte0(0x21));
}
