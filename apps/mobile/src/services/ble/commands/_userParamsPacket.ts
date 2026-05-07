// Internal helper for the 0x0A "user parameters" command. Per
// docs/_reference/U16PRO_protocol_en.pdf §4.4.
//
// The U16 protocol packs hour-format, units, and demographic fields into
// a SINGLE wire packet (cmd 0x0A). D13 §3.1 lists "set time format" and
// "set user params" as if they were independent commands — the PDF makes
// clear they share the same packet. Both setUserParams.ts and
// setTimeFormat.ts are facades over this helper.
//
// Wire: 0x0A 0x02 BB CC DD EE FF GG HH II 00×4 CRC
//   byte 1 = 0x02   (write; 0x01 = read current)
//   byte 2 (BB)     0x00 = 24-hour, 0x01 = 12-hour
//   byte 3 (CC)     0x00 = metric,  0x01 = imperial
//   byte 4 (DD)     0x00 = male,    0x01 = female
//   byte 5 (EE)     age (years)
//   byte 6 (FF)     height (cm)
//   byte 7 (GG)     weight (kg)
//   byte 8 (HH)     strap size (0 if unknown)
//   byte 9 (II)     heart rate alarm (bpm; 0 = disabled)

import { expectByte0 } from '../io';
import type { UrionDevice } from '../UrionDevice';

export interface UrionUserParams {
  hourFormat: '12h' | '24h';
  units: 'metric' | 'imperial';
  gender: 'male' | 'female';
  ageYears: number; // 1..120
  heightCm: number; // 50..250
  weightKg: number; // 20..200
  strapSizeMm: number; // 0..255 (0 = unknown)
  hrAlarmBpm: number; // 0..255 (0 = disabled)
}

export function buildUserParamsPayload(params: UrionUserParams): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0x02; // write sub-command
  payload[1] = params.hourFormat === '12h' ? 0x01 : 0x00;
  payload[2] = params.units === 'imperial' ? 0x01 : 0x00;
  payload[3] = params.gender === 'female' ? 0x01 : 0x00;
  payload[4] = params.ageYears & 0xff;
  payload[5] = params.heightCm & 0xff;
  payload[6] = params.weightKg & 0xff;
  payload[7] = params.strapSizeMm & 0xff;
  payload[8] = params.hrAlarmBpm & 0xff;
  // bytes 9..13 are reserved/zero
  return payload;
}

export async function writeUserParams(
  device: UrionDevice,
  params: UrionUserParams,
): Promise<void> {
  const payload = buildUserParamsPayload(params);
  await device.sendCommand(0x0a, payload, expectByte0(0x0a));
}
