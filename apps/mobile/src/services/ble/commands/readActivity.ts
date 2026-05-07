// Thin facade — sends 0x07 (activity + sleep) and returns just the
// activity slice. Sharing the request with readSleep is intentional:
// the watch returns both summaries from a single 0x07 call, so the
// underlying readDayInfo dispatches once and each facade picks its
// half. See readDayInfo.ts for protocol details.

import { readDayInfo, type ActivityDayRecord } from './readDayInfo';
import type { UrionDevice } from '../UrionDevice';

export type { ActivityDayRecord };

export async function readActivity(
  device: UrionDevice,
  options: { daysAgo: number; timeoutMs?: number },
): Promise<ActivityDayRecord | null> {
  return (await readDayInfo(device, options)).activity;
}
