// iOS adapter — wraps @kingstinct/react-native-healthkit. Sourced from
// docs/_reference/D13-multi-vitals-constellation-spec.md §12.2 + §12.3
// for the identifier table.
//
// Metro's platform-extension resolver picks this file when bundling for
// iOS. Jest never sees it (the resolver falls through to native.ts /
// the mock). The hand-rolled mock at __mocks__/@kingstinct/react-
// native-healthkit.js is insurance for the case where someone wires
// jest-expo with platform=ios in a follow-up.
//
// Round-trip filter: read paths exclude samples whose `sourceBundleId`
// matches LEIKO_BUNDLE_ID so we never re-import our own writes (D13 §12.6).
//
// Sleep stage mapping is deferred to Task 6 (sleep-stages.ts). Until
// then writeSleep returns EMPTY_RESULT — the orchestrator (Task 5)
// treats that as "no rows written" and moves on.

import {
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  requestAuthorization,
  saveCorrelationSample,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';
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

// HK identifier maps. Keys here are the WriteVitalKind / ReadVitalKind
// enums; values are the HKQuantityTypeIdentifier / HKCorrelationType
// strings the kingstinct lib accepts directly.
const WRITE_QUANTITY_IDENTIFIERS: Partial<
  Record<WriteVitalKind, readonly string[]>
> = {
  hr: ['HKQuantityTypeIdentifierHeartRate'],
  spo2: ['HKQuantityTypeIdentifierOxygenSaturation'],
  steps: ['HKQuantityTypeIdentifierStepCount'],
  calories: ['HKQuantityTypeIdentifierActiveEnergyBurned'],
};

const BP_QUANTITY_IDENTIFIERS = [
  'HKQuantityTypeIdentifierBloodPressureSystolic',
  'HKQuantityTypeIdentifierBloodPressureDiastolic',
] as const;

const SLEEP_CATEGORY_IDENTIFIER = 'HKCategoryTypeIdentifierSleepAnalysis';

const READ_QUANTITY_IDENTIFIERS: Record<ReadVitalKind, string> = {
  weight: 'HKQuantityTypeIdentifierBodyMass',
  height: 'HKQuantityTypeIdentifierHeight',
  blood_glucose: 'HKQuantityTypeIdentifierBloodGlucose',
};

const READ_QUANTITY_UNITS: Record<ReadVitalKind, string> = {
  weight: 'kg',
  height: 'm',
  // Default unit for the query — actual sample carries its own unit; we
  // record what the platform handed us in source_origin.
  blood_glucose: 'mg/dL',
};

function unitToColumn(unit: string): ExternalVitalSample['valueUnit'] {
  switch (unit) {
    case 'kg':
    case 'lb':
    case 'm':
    case 'cm':
    case 'in':
    case 'mg/dL':
    case 'mmol/L':
      return unit;
    default:
      // Coerce unknown units to a safe default per ReadVitalKind. The
      // future /sync-external-vitals validator will reject anything outside
      // the CHECK constraint anyway, so the cost of mis-routing here is
      // bounded.
      return 'kg';
  }
}

function buildAuthSpec(req: PermissionRequest): {
  read: string[];
  write: string[];
} {
  const write: string[] = [];
  if (req.write.includes('bp')) write.push(...BP_QUANTITY_IDENTIFIERS);
  for (const kind of req.write) {
    const ids = WRITE_QUANTITY_IDENTIFIERS[kind];
    if (ids) write.push(...ids);
  }
  if (req.write.includes('sleep')) write.push(SLEEP_CATEGORY_IDENTIFIER);

  const read: string[] = [];
  for (const kind of req.read) {
    read.push(READ_QUANTITY_IDENTIFIERS[kind]);
  }
  return { read, write };
}

function grantedAll(req: PermissionRequest, prompted: boolean): PermissionGrant {
  // Apple's privacy model never reports per-permission read status. We
  // optimistically mark every requested permission as `true`; the
  // adapter's read/write calls will simply return empty/0 if the user
  // declined, with no error path. See types.ts comment.
  const write = {} as PermissionGrant['write'];
  for (const k of req.write) write[k] = true;
  const read = {} as PermissionGrant['read'];
  for (const k of req.read) read[k] = true;
  return { write, read, userPrompted: prompted };
}

export const nativeAdapter: HealthPlatformAdapter = {
  platform: 'apple_health',

  async isAvailable() {
    try {
      return await isHealthDataAvailableAsync();
    } catch {
      return false;
    }
  },

  async requestPermissions(req) {
    const spec = buildAuthSpec(req);
    let prompted = false;
    try {
      // kingstinct's requestAuthorization returns true when the OS
      // showed (or already had) a permission decision. We surface that
      // as `userPrompted`.
      prompted = await requestAuthorization({
        toRead: spec.read as never,
        toShare: spec.write as never,
      });
    } catch {
      prompted = false;
    }
    return grantedAll(req, prompted);
  },

  async writeBP(samples) {
    if (samples.length === 0) return EMPTY_RESULT;
    let written = 0;
    let rejected = 0;
    let firstError: string | undefined;
    for (const s of samples) {
      try {
        const at = new Date(s.measuredAtSec * 1000);
        // BP must be written as a correlation sample so HK keeps the
        // sys+dia pair joined (D13 §12.2). saveCorrelationSample takes
        // the two QuantitySample shapes the kingstinct lib calls
        // SampleForSaving.
        await saveCorrelationSample(
          'HKCorrelationTypeIdentifierBloodPressure',
          [
            {
              identifier:
                'HKQuantityTypeIdentifierBloodPressureSystolic' as never,
              quantity: s.systolic,
              unit: 'mmHg',
              startDate: at,
              endDate: at,
            } as never,
            {
              identifier:
                'HKQuantityTypeIdentifierBloodPressureDiastolic' as never,
              quantity: s.diastolic,
              unit: 'mmHg',
              startDate: at,
              endDate: at,
            } as never,
          ],
          at,
          at,
        );
        written += 1;
      } catch (err) {
        rejected += 1;
        if (!firstError) firstError = (err as Error).message;
      }
    }
    return firstError ? { written, rejected, firstError } : { written, rejected };
  },

  writeHR(samples) {
    return saveQuantityList(
      'HKQuantityTypeIdentifierHeartRate' as never,
      'count/min',
      samples.map((s) => ({
        value: s.bpm,
        startSec: s.measuredAtSec,
        // HR samples are instantaneous to HK; the auto-window stays as
        // metadata for our own analytics, not an HK construct.
        endSec: s.measuredAtSec,
      })),
    );
  },

  writeSpO2(samples) {
    return saveQuantityList(
      'HKQuantityTypeIdentifierOxygenSaturation' as never,
      // HK percent unit on SpO2 expects 0.0-1.0. Convert from our 0-100.
      '%',
      samples.map((s) => ({
        value: s.percent / 100,
        startSec: s.measuredAtSec,
        endSec: s.measuredAtSec + s.sampleWindowSec,
      })),
    );
  },

  // Task 6 — wires sleep-stages.ts to map our SleepSession shape onto
  // HK category samples. Until then, no-op.
  async writeSleep() {
    return EMPTY_RESULT;
  },

  writeSteps(days) {
    return saveQuantityList(
      'HKQuantityTypeIdentifierStepCount' as never,
      'count',
      days.map((d) => ({
        value: d.totalSteps,
        startSec: d.measuredAtSec,
        endSec: d.measuredAtSec + 86_400,
      })),
    );
  },

  writeCalories(days) {
    return saveQuantityList(
      'HKQuantityTypeIdentifierActiveEnergyBurned' as never,
      'kcal',
      days.map((d) => ({
        value: d.activityKcal,
        startSec: d.measuredAtSec,
        endSec: d.measuredAtSec + 86_400,
      })),
    );
  },

  async readExternalSince(opts: ReadOptions) {
    const wanted = opts.vitals ?? (Object.keys(READ_QUANTITY_IDENTIFIERS) as ReadVitalKind[]);
    const since = new Date(opts.sinceSec * 1000);
    const out: ExternalVitalSample[] = [];

    for (const kind of wanted) {
      const id = READ_QUANTITY_IDENTIFIERS[kind];
      const unit = READ_QUANTITY_UNITS[kind];
      try {
        const samples = await queryQuantitySamples(id as never, {
          unit: unit as never,
          filter: { startDate: since },
          limit: 200,
          ascending: false,
        } as never);
        for (const s of samples) {
          // Round-trip filter — D13 §12.6.
          const origin =
            (s as unknown as { sourceRevision?: { source?: { bundleIdentifier?: string } } })
              .sourceRevision?.source?.bundleIdentifier ?? 'unknown';
          if (origin === LEIKO_BUNDLE_ID) continue;
          out.push({
            vitalType: kind,
            measuredAtSec: Math.floor(
              new Date((s as unknown as { startDate: string | Date }).startDate).getTime() / 1000,
            ),
            valueNumeric: (s as unknown as { quantity: number }).quantity,
            valueUnit: unitToColumn(unit),
            sourceOrigin: origin,
          });
        }
      } catch {
        // Read errors are non-fatal — missing permission, no data,
        // simulator without HK. Skip the kind and keep going.
      }
    }
    return out;
  },
};

// ---- helpers --------------------------------------------------------------

interface QuantityRow {
  value: number;
  startSec: number;
  endSec: number;
}

async function saveQuantityList(
  identifier: string,
  unit: string,
  rows: QuantityRow[],
): Promise<WriteResultPerVital> {
  if (rows.length === 0) return EMPTY_RESULT;
  let written = 0;
  let rejected = 0;
  let firstError: string | undefined;
  for (const r of rows) {
    try {
      await saveQuantitySample(
        identifier as never,
        unit as never,
        r.value,
        new Date(r.startSec * 1000),
        new Date(r.endSec * 1000),
      );
      written += 1;
    } catch (err) {
      rejected += 1;
      if (!firstError) firstError = (err as Error).message;
    }
  }
  return firstError ? { written, rejected, firstError } : { written, rejected };
}
