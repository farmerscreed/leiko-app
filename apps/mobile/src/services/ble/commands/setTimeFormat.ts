// 0x0A — Set 12/24-hour format and metric/imperial units.
// Per docs/_reference/U16PRO_protocol_en.pdf §4.4.
//
// NOTE: the U16 protocol packs hour-format, units, and demographic
// fields into the SAME wire packet (cmd 0x0A). This facade is a
// readability-only rename — callers must still pass the full user-bio
// struct. The orchestrator owns the cached "current params" struct and
// re-writes the full packet whenever EITHER format/units OR
// demographics change. Real packet construction lives in the shared
// internal helper ./_userParamsPacket.ts.

import type { UrionDevice } from '../UrionDevice';
import { setUserParams, type UrionUserParams } from './setUserParams';

/**
 * Set 12/24-hour format and metric/imperial units. The U16 protocol
 * packs these in the same wire packet as user demographics (cmd 0x0A
 * per U16PRO §4.4); callers must therefore include the demographic
 * fields on every call. The orchestrator owns the cached "current
 * params" struct and re-writes the full packet whenever EITHER format
 * or demographics change.
 */
export async function setTimeFormat(
  device: UrionDevice,
  params: UrionUserParams,
): Promise<void> {
  return setUserParams(device, params);
}
