// 0x0A — Set user parameters (hour format + units + demographics).
// Per docs/_reference/U16PRO_protocol_en.pdf §4.4.
//
// NOTE: hour-format/units and demographic fields share ONE wire packet
// (the protocol PDF treats them as a single command, even though D13
// §3.1 lists them separately). The actual packet construction lives in
// the shared internal helper ./_userParamsPacket.ts; setTimeFormat.ts
// is a thin facade over the same helper.

import type { UrionDevice } from '../UrionDevice';
import { writeUserParams, type UrionUserParams } from './_userParamsPacket';

export type { UrionUserParams } from './_userParamsPacket';

export async function setUserParams(
  device: UrionDevice,
  params: UrionUserParams,
): Promise<void> {
  return writeUserParams(device, params);
}
