// Thin facade — sends 0x07 (activity + sleep) and returns just the
// sleep slice. Shares the underlying readDayInfo with readActivity;
// see readDayInfo.ts for protocol details.

import { readDayInfo, type SleepDayRecord } from './readDayInfo';
import type { UrionDevice } from '../UrionDevice';

export type { SleepDayRecord };

export async function readSleep(
  device: UrionDevice,
  options: { daysAgo: number; timeoutMs?: number },
): Promise<SleepDayRecord | null> {
  return (await readDayInfo(device, options)).sleep;
}
