// Run the rest-period detector over finished days — 2026-11-18.
//
// Called from syncMultiVitals after heart rate has been pulled. Scans
// each completed local day (yesterday and up to two days before) that
// hasn't been scanned yet, using the heart-rate samples in the HR slice
// and that day's step timeline, and queues what it finds for upload.
// A day counts as scanned once heart rate reaches past the daytime
// window (21:00); until then it's retried on the next sync.

import { mmkv, STORAGE_KEYS } from '../storage';
import { useHR } from '../../state/hr';
import { useRestPeriods } from '../../state/restPeriods';
import { getTimeline } from '../activity/stepTimeline';
import { detectRestPeriods } from './detectRestPeriods';
import { epochSecForLocalHour } from '../../utils/userTz';
import { dayKeyInZone } from '../../utils/timeInZone';

const LOOKBACK_DAYS = 3;

function addDays(dayLocal: string, n: number): string {
  const [y, m, d] = dayLocal.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function readScanned(): Record<string, string> {
  const raw = mmkv.getString(STORAGE_KEYS.restPeriodsScannedDay);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    return o && typeof o === 'object' ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Returns how many rest periods were queued. Never throws. */
export function scanRestPeriods(deviceBleId: string, nowSec: number, tz: string): number {
  try {
    const today = dayKeyInZone(nowSec * 1000, tz);
    const scanned = readScanned();
    const oldest = addDays(today, -LOOKBACK_DAYS);
    let day = scanned[deviceBleId] && scanned[deviceBleId] >= oldest
      ? addDays(scanned[deviceBleId], 1)
      : oldest;
    const hr = useHR.getState();
    const samples = [...hr.pending, ...hr.recent];
    let queued = 0;
    while (day < today) {
      const dayEndOfWindow = epochSecForLocalHour(day, 21, tz);
      const complete = samples.some((s) => s.measuredAtSec >= dayEndOfWindow);
      if (!complete) break;
      const timeline = getTimeline(deviceBleId, day);
      const hourly = timeline && timeline.hourly.some((h) => h > 0) ? timeline.hourly : null;
      const found = detectRestPeriods(samples, day, tz, hourly);
      useRestPeriods.getState().addPending(found);
      queued += found.length;
      scanned[deviceBleId] = day;
      day = addDays(day, 1);
    }
    mmkv.set(STORAGE_KEYS.restPeriodsScannedDay, JSON.stringify(scanned));
    return queued;
  } catch {
    return 0;
  }
}
