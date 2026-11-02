// Pure builders for the Health Connect records Leiko writes. No native
// imports, so Jest can exercise them directly (native.android.ts is only
// ever bundled for Android).
//
// Why every record carries metadata.clientRecordId (2026-11-02):
// Health Connect treats each insert as a new record unless it carries a
// clientRecordId it has seen before. Leiko re-sends the same rows — the
// watch reports today's running step/calorie total on every sync, a
// failed upload is retried, and the history copy (backfill.ts) re-writes
// everything. Without an id, HC summed the duplicates: five syncs of a
// 4,000-step day showed as 20,000 steps. With a stable id, HC updates the
// existing record in place whenever clientRecordVersion is higher, and
// ignores the write otherwise.
//
// Id scheme: `leiko-<kind>-<start unix sec>`. One Leiko record per vital
// per timestamp is already the server's dedup rule (/sync conflict keys),
// so the id is unique within a kind. Days use the day's start instant.

import type { HealthConnectRecord } from 'react-native-health-connect';
import type {
  ActivityDay,
  BPReading,
  CaloriesDay,
  HRSample,
  SleepSession,
  SpO2Sample,
} from '../../../types/vitals';
import { buildHCSleepStages } from '../sleep-stages';

// androidx.health.connect.client.records.metadata.Device.TYPE_WATCH. The
// RN binding's DeviceType enum omits it, so it is spelled out here.
const DEVICE_TYPE_WATCH = 1;

// Metadata.RECORDING_METHOD_* (mirrors the RN binding's RecordingMethod).
export const RECORDING_ACTIVE = 1;
export const RECORDING_AUTOMATIC = 2;
export const RECORDING_MANUAL = 3;

export const LEIKO_HC_DEVICE = {
  manufacturer: 'Leiko',
  model: 'Leiko Watch',
  type: DEVICE_TYPE_WATCH,
} as const;

/** Readings never change once taken; one version is enough. */
const IMMUTABLE_VERSION = 1;

function iso(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

function metadata(
  id: string,
  version: number,
  recordingMethod: number,
  fromWatch = true,
) {
  return {
    clientRecordId: id,
    // HC compares versions as longs; keep them positive integers.
    clientRecordVersion: Math.max(1, Math.floor(version)),
    recordingMethod,
    ...(fromWatch ? { device: LEIKO_HC_DEVICE } : {}),
  };
}

export function clientRecordId(kind: string, startSec: number): string {
  return `leiko-${kind}-${Math.floor(startSec)}`;
}

/** Offset (sec) of `timeZone` from UTC at instant `atSec`. */
function tzOffsetSec(atSec: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(atSec * 1000));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round(asUtc / 1000 - atSec);
}

/**
 * Real start instant of a calendar day in `timeZone`.
 *
 * Leiko keys day rows (steps_day / calories_day) by 'YYYY-MM-DD' stored
 * as that date at 00:00 UTC — a day KEY, not the day's start
 * (syncMultiVitals unixSecFromDayLocal). Writing the key as the start
 * put every day 6 h early in Chicago (6 PM → 6 PM), so totals landed on
 * the wrong date in Health Connect (device test 2026-11-02).
 */
export function localDayStartSec(dayLocal: string, timeZone: string): number {
  const [y, m, d] = dayLocal.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d) / 1000;
  // Two passes settle DST: the offset at local midnight can differ from
  // the offset at UTC midnight.
  let start = utcMidnight - tzOffsetSec(utcMidnight, timeZone);
  start = utcMidnight - tzOffsetSec(start, timeZone);
  return start;
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** [start, end) of a day record, never ending later than now — HC
 *  rejects records that end in the future, and today's row still grows.
 *  End is the next local midnight, so 23 h / 25 h DST days are right. */
export function dayWindowSec(
  dayLocal: string,
  nowSec: number,
  timeZone: string,
): { start: number; end: number } {
  const start = localDayStartSec(dayLocal, timeZone);
  const [y, m, d] = dayLocal.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const fullEnd = localDayStartSec(next, timeZone);
  return { start, end: Math.max(start + 1, Math.min(fullEnd, nowSec)) };
}

/** Day records written before 2026-11-02 used the wrong window. A higher
 *  version makes Health Connect replace them in place (same id). */
const DAY_RECORD_SCHEMA = 1_000_000_000;

export function bloodPressureRecords(samples: BPReading[]): HealthConnectRecord[] {
  return samples.map((s) => {
    const manual = s.source === 'manual';
    return {
      recordType: 'BloodPressure',
      time: iso(s.measuredAtSec),
      systolic: { value: s.systolic, unit: 'millimetersOfMercury' },
      diastolic: { value: s.diastolic, unit: 'millimetersOfMercury' },
      bodyPosition: 0,
      measurementLocation: 0,
      metadata: metadata(
        clientRecordId('bp', s.measuredAtSec),
        IMMUTABLE_VERSION,
        manual ? RECORDING_MANUAL : RECORDING_ACTIVE,
        !manual,
      ),
    } as HealthConnectRecord;
  });
}

export function heartRateRecords(samples: HRSample[]): HealthConnectRecord[] {
  return samples.map((s) => {
    const start = s.measuredAtSec;
    const end = start + Math.max(s.sampleWindowSec, 1);
    return {
      recordType: 'HeartRate',
      startTime: iso(start),
      endTime: iso(end),
      samples: [{ time: iso(start), beatsPerMinute: s.bpm }],
      metadata: metadata(
        clientRecordId('hr', start),
        IMMUTABLE_VERSION,
        s.isSpotCheck ? RECORDING_ACTIVE : RECORDING_AUTOMATIC,
      ),
    } as HealthConnectRecord;
  });
}

export function oxygenRecords(samples: SpO2Sample[]): HealthConnectRecord[] {
  return samples.map(
    (s) =>
      ({
        recordType: 'OxygenSaturation',
        time: iso(s.measuredAtSec),
        // HC percentage is 0-100 (not 0-1 like HealthKit).
        percentage: s.percent,
        metadata: metadata(
          clientRecordId('spo2', s.measuredAtSec),
          IMMUTABLE_VERSION,
          s.isSpotCheck ? RECORDING_ACTIVE : RECORDING_AUTOMATIC,
        ),
      }) as HealthConnectRecord,
  );
}

export function sleepRecords(sessions: SleepSession[]): HealthConnectRecord[] {
  return sessions.filter((s) => s.sessionEndSec > s.sessionStartSec).map(
    (session) =>
      ({
        recordType: 'SleepSession',
        startTime: iso(session.sessionStartSec),
        endTime: iso(session.sessionEndSec),
        stages: buildHCSleepStages(session).map((b) => ({
          startTime: iso(b.startTimeSec),
          endTime: iso(b.endTimeSec),
          stage: b.stage,
        })),
        // A night can be re-reported with more stage detail; the larger
        // minute count wins.
        metadata: metadata(
          clientRecordId('sleep', session.sessionStartSec),
          session.totalMinutes + session.awakeMinutes,
          RECORDING_AUTOMATIC,
        ),
      }) as HealthConnectRecord,
  );
}

/** Health Connect's StepsRecord requires 1 ≤ count ≤ 1,000,000; a 0-step
 *  day (watch not worn) throws, and one throw fails the whole insert
 *  (seen on device 2026-11-02: no Leiko steps at all after the history
 *  copy). A day with no steps has nothing to record, so it is skipped. */
const MAX_STEPS = 1_000_000;

export function stepsRecords(
  days: ActivityDay[],
  nowSec: number,
  timeZone: string = deviceTimeZone(),
): HealthConnectRecord[] {
  return days.filter((d) => d.totalSteps >= 1).map((d) => {
    const w = dayWindowSec(d.dayLocal, nowSec, timeZone);
    return {
        recordType: 'Steps',
        startTime: iso(w.start),
        endTime: iso(w.end),
        count: Math.min(Math.round(d.totalSteps), MAX_STEPS),
        // Today's total only grows; the newest sync replaces the old one.
        // Id stays on the day key (stable across time zones and the
        // window fix). Today's total only grows, so the newest wins.
        metadata: metadata(
          clientRecordId('steps', d.measuredAtSec),
          DAY_RECORD_SCHEMA + d.totalSteps + 1,
          RECORDING_AUTOMATIC,
        ),
      } as HealthConnectRecord;
  });
}

export function caloriesRecords(
  days: CaloriesDay[],
  nowSec: number,
  timeZone: string = deviceTimeZone(),
): HealthConnectRecord[] {
  return days.filter((d) => Number.isFinite(d.activityKcal) && d.activityKcal > 0).map((d) => {
    const w = dayWindowSec(d.dayLocal, nowSec, timeZone);
    return {
        recordType: 'ActiveCaloriesBurned',
        startTime: iso(w.start),
        endTime: iso(w.end),
        energy: { value: d.activityKcal, unit: 'kilocalories' },
        // kcal can be fractional; scale so small increases still bump the
        // version.
        metadata: metadata(
          clientRecordId('kcal', d.measuredAtSec),
          DAY_RECORD_SCHEMA + Math.round(d.activityKcal * 10) + 1,
          RECORDING_AUTOMATIC,
        ),
      } as HealthConnectRecord;
  });
}
