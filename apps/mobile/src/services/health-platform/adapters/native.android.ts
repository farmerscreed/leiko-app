// Android adapter — wraps react-native-health-connect. Sourced from
// docs/_reference/D13-multi-vitals-constellation-spec.md §12.4 for the
// HC record-type table.
//
// Metro's platform-extension resolver picks this file when bundling for
// Android. Jest never sees it (the resolver falls through to native.ts /
// the mock). The hand-rolled mock at __mocks__/react-native-health-
// connect.js is insurance.
//
// Availability: HC ships as an OS package starting Android 14 and as a
// standalone APK on older devices (API 26-33). Devices below API 26
// cannot use HC at all — isAvailable() returns false and write/read
// surfaces no-op so the toggle UI can disable itself with a calm
// explainer (Task 8 / Task 9).
//
// Round-trip filter: read paths set `dataOriginFilter` to exclude our
// own package (LEIKO_BUNDLE_ID) so we never re-import our own writes
// (D13 §12.6). HC's API supports this server-side via the read filter
// — cleaner than client-side filtering on iOS.

import {
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type {
  HealthConnectRecord,
  Permission,
  RecordType,
} from 'react-native-health-connect';
import {
  EMPTY_RESULT,
  LEIKO_BUNDLE_ID,
  type ExternalVitalSample,
  type HealthPlatformAdapter,
  type PermissionGrant,
  type PermissionRequest,
  type ReadOptions,
  type ReadVitalKind,
  type WriteResultPerVital,
  type WriteVitalKind,
} from '../types';

const WRITE_RECORD_TYPES: Record<WriteVitalKind, RecordType> = {
  bp: 'BloodPressure',
  hr: 'HeartRate',
  spo2: 'OxygenSaturation',
  sleep: 'SleepSession',
  steps: 'Steps',
  calories: 'ActiveCaloriesBurned',
};

const READ_RECORD_TYPES: Record<ReadVitalKind, RecordType> = {
  weight: 'Weight',
  height: 'Height',
  blood_glucose: 'BloodGlucose',
};

let initialized = false;

async function ensureReady(): Promise<boolean> {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  if (!initialized) {
    initialized = await initialize();
  }
  return initialized;
}

function isoFromSec(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

function buildPermissionList(req: PermissionRequest): Permission[] {
  const perms: Permission[] = [];
  for (const kind of req.write) {
    perms.push({ accessType: 'write', recordType: WRITE_RECORD_TYPES[kind] });
  }
  for (const kind of req.read) {
    perms.push({ accessType: 'read', recordType: READ_RECORD_TYPES[kind] });
  }
  return perms;
}

function grantsFromHC(
  req: PermissionRequest,
  granted: { accessType?: string; recordType?: string }[],
  prompted: boolean,
): PermissionGrant {
  const has = (access: 'read' | 'write', type: RecordType): boolean =>
    granted.some(
      (g) => g.accessType === access && g.recordType === type,
    );

  const write = {} as PermissionGrant['write'];
  for (const k of req.write) write[k] = has('write', WRITE_RECORD_TYPES[k]);
  const read = {} as PermissionGrant['read'];
  for (const k of req.read) read[k] = has('read', READ_RECORD_TYPES[k]);
  return { write, read, userPrompted: prompted };
}

async function insertSafely(
  records: HealthConnectRecord[],
): Promise<WriteResultPerVital> {
  if (records.length === 0) return EMPTY_RESULT;
  if (!(await ensureReady())) {
    return { written: 0, rejected: records.length, firstError: 'hc-unavailable' };
  }
  try {
    const ids = await insertRecords(records);
    return { written: ids.length, rejected: records.length - ids.length };
  } catch (err) {
    return {
      written: 0,
      rejected: records.length,
      firstError: (err as Error).message,
    };
  }
}

export const nativeAdapter: HealthPlatformAdapter = {
  platform: 'health_connect',

  async isAvailable() {
    try {
      const status = await getSdkStatus();
      return status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  },

  async requestPermissions(req) {
    if (!(await ensureReady())) {
      // SDK unavailable — fail closed: nothing granted, no prompt shown.
      const grant = grantsFromHC(req, [], false);
      return grant;
    }
    let granted: { accessType?: string; recordType?: string }[] = [];
    let prompted = false;
    try {
      granted = (await requestPermission(buildPermissionList(req))) as never;
      prompted = true;
    } catch {
      prompted = false;
    }
    return grantsFromHC(req, granted, prompted);
  },

  async writeBP(samples) {
    const records: HealthConnectRecord[] = samples.map((s) => ({
      recordType: 'BloodPressure',
      time: isoFromSec(s.measuredAtSec),
      systolic: { value: s.systolic, unit: 'millimetersOfMercury' },
      diastolic: { value: s.diastolic, unit: 'millimetersOfMercury' },
      bodyPosition: 0,
      measurementLocation: 0,
    }));
    return insertSafely(records);
  },

  async writeHR(samples) {
    if (samples.length === 0) return EMPTY_RESULT;
    // HR is an IntervalRecord that batches samples. Collapse our flat
    // HRSample[] into a single HC record per sample-window grouping —
    // the simplest invariant is one HC record per sample, since each
    // HRSample carries its own measuredAtSec + sampleWindowSec.
    const records: HealthConnectRecord[] = samples.map((s) => {
      const start = s.measuredAtSec;
      const end = start + Math.max(s.sampleWindowSec, 1);
      return {
        recordType: 'HeartRate',
        startTime: isoFromSec(start),
        endTime: isoFromSec(end),
        samples: [
          {
            time: isoFromSec(start),
            beatsPerMinute: s.bpm,
          },
        ],
      };
    });
    return insertSafely(records);
  },

  async writeSpO2(samples) {
    const records: HealthConnectRecord[] = samples.map((s) => ({
      recordType: 'OxygenSaturation',
      time: isoFromSec(s.measuredAtSec),
      // HC OxygenSaturationRecord percentage is 0-100 (not 0-1 like HK).
      percentage: s.percent,
    }));
    return insertSafely(records);
  },

  // Task 6 — wires sleep-stages.ts to map our SleepSession shape onto
  // HC SleepSessionRecord with stage subrecords. Until then, no-op.
  async writeSleep() {
    return EMPTY_RESULT;
  },

  async writeSteps(days) {
    const records: HealthConnectRecord[] = days.map((d) => ({
      recordType: 'Steps',
      startTime: isoFromSec(d.measuredAtSec),
      endTime: isoFromSec(d.measuredAtSec + 86_400),
      count: d.totalSteps,
    }));
    return insertSafely(records);
  },

  async writeCalories(days) {
    const records: HealthConnectRecord[] = days.map((d) => ({
      recordType: 'ActiveCaloriesBurned',
      startTime: isoFromSec(d.measuredAtSec),
      endTime: isoFromSec(d.measuredAtSec + 86_400),
      energy: { value: d.activityKcal, unit: 'kilocalories' },
    }));
    return insertSafely(records);
  },

  async readExternalSince(opts: ReadOptions) {
    if (!(await ensureReady())) return [];
    const wanted = opts.vitals ?? (Object.keys(READ_RECORD_TYPES) as ReadVitalKind[]);
    const since = isoFromSec(opts.sinceSec);
    const out: ExternalVitalSample[] = [];

    for (const kind of wanted) {
      try {
        const result = await readRecords(READ_RECORD_TYPES[kind], {
          timeRangeFilter: { operator: 'after', startTime: since } as never,
          ascendingOrder: false,
          pageSize: 200,
        });
        for (const r of result.records as unknown as readonly HealthConnectRecord[]) {
          const origin =
            (r as unknown as { metadata?: { dataOrigin?: string } }).metadata?.dataOrigin ??
            'unknown';
          // Round-trip filter — D13 §12.6.
          if (origin === LEIKO_BUNDLE_ID) continue;

          const sample = projectExternal(kind, r, origin);
          if (sample) out.push(sample);
        }
      } catch {
        // Read errors are non-fatal — missing permission, no records,
        // SDK quirk. Skip and continue.
      }
    }
    return out;
  },
};

function projectExternal(
  kind: ReadVitalKind,
  record: HealthConnectRecord,
  origin: string,
): ExternalVitalSample | null {
  const time = (record as unknown as { time?: string }).time;
  if (!time) return null;
  const measuredAtSec = Math.floor(new Date(time).getTime() / 1000);

  if (kind === 'weight' && record.recordType === 'Weight') {
    const mass = record.weight as { value: number; unit: string };
    return {
      vitalType: 'weight',
      measuredAtSec,
      valueNumeric: mass.unit === 'pounds' ? mass.value : mass.value,
      valueUnit: mass.unit === 'pounds' ? 'lb' : 'kg',
      sourceOrigin: origin,
    };
  }
  if (kind === 'height' && record.recordType === 'Height') {
    const len = record.height as { value: number; unit: string };
    return {
      vitalType: 'height',
      measuredAtSec,
      valueNumeric: len.value,
      valueUnit: len.unit === 'inches' ? 'in' : len.unit === 'meters' ? 'm' : 'cm',
      sourceOrigin: origin,
    };
  }
  if (kind === 'blood_glucose' && record.recordType === 'BloodGlucose') {
    const lvl = record.level as { value: number; unit: string };
    return {
      vitalType: 'blood_glucose',
      measuredAtSec,
      valueNumeric: lvl.value,
      valueUnit: lvl.unit === 'millimolesPerLiter' ? 'mmol/L' : 'mg/dL',
      sourceOrigin: origin,
    };
  }
  return null;
}
