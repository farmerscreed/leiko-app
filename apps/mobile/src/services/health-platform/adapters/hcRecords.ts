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

/** End of a day-long record, never later than now — HC rejects records
 *  that end in the future, and today's row is still growing. */
export function dayEndSec(dayStartSec: number, nowSec: number): number {
  const fullDay = dayStartSec + 86_400;
  return Math.max(dayStartSec + 1, Math.min(fullDay, nowSec));
}

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

export function stepsRecords(days: ActivityDay[], nowSec: number): HealthConnectRecord[] {
  return days.filter((d) => d.totalSteps >= 1).map(
    (d) =>
      ({
        recordType: 'Steps',
        startTime: iso(d.measuredAtSec),
        endTime: iso(dayEndSec(d.measuredAtSec, nowSec)),
        count: Math.min(Math.round(d.totalSteps), MAX_STEPS),
        // Today's total only grows; the newest sync replaces the old one.
        metadata: metadata(
          clientRecordId('steps', d.measuredAtSec),
          d.totalSteps + 1,
          RECORDING_AUTOMATIC,
        ),
      }) as HealthConnectRecord,
  );
}

export function caloriesRecords(days: CaloriesDay[], nowSec: number): HealthConnectRecord[] {
  return days.filter((d) => Number.isFinite(d.activityKcal) && d.activityKcal > 0).map(
    (d) =>
      ({
        recordType: 'ActiveCaloriesBurned',
        startTime: iso(d.measuredAtSec),
        endTime: iso(dayEndSec(d.measuredAtSec, nowSec)),
        energy: { value: d.activityKcal, unit: 'kilocalories' },
        // kcal can be fractional; scale so small increases still bump the
        // version.
        metadata: metadata(
          clientRecordId('kcal', d.measuredAtSec),
          Math.round(d.activityKcal * 10) + 1,
          RECORDING_AUTOMATIC,
        ),
      }) as HealthConnectRecord,
  );
}
