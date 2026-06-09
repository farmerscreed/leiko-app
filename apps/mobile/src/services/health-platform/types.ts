// Unified types for the platform-health bridge. Sourced from
// docs/_reference/D13-multi-vitals-constellation-spec.md §12 + the
// Sprint 9.5 card.
//
// The shapes here are deliberately a thin re-projection of the existing
// vitals.ts types — write inputs are the same BPReading / HRSample /
// SpO2Sample / SleepSession / ActivityDay / CaloriesDay the /sync
// payload already carries, so Task 5 (Hook write into /sync success)
// hands the same arrays straight through without reshaping.

import type {
  ActivityDay,
  BPReading,
  CaloriesDay,
  HRSample,
  SleepSession,
  SpO2Sample,
} from '../../types/vitals';

/** Vitals Leiko writes outward to the platform store. Matches D13 §12.2 +
 *  §12.4. Caregiver path skips all of these (D13 §12.6). */
export type WriteVitalKind =
  | 'bp'
  | 'hr'
  | 'spo2'
  | 'sleep'
  | 'steps'
  | 'calories';

/** Vitals Leiko reads from the platform store. v1.0 surface per
 *  D13 §12.3 + the external_vitals enum in 0006_external_vitals.sql. */
export type ReadVitalKind = 'weight' | 'height' | 'blood_glucose';

/** Per D13 §12 + the bundle id locked in app.json + the brand_pivot_leiko
 *  memory note. The read path filters samples whose source matches this
 *  value to prevent Leiko's own writes from round-tripping back into
 *  external_vitals. */
export const LEIKO_BUNDLE_ID = 'com.leiko.care';

export interface PermissionRequest {
  write: WriteVitalKind[];
  read: ReadVitalKind[];
}

/** Apple's privacy model NEVER reports per-permission read status — the
 *  app only knows whether the request *was made*. We surface that by
 *  reporting the requested set as `granted`, with a single overall
 *  `userPrompted` flag. Health Connect *does* report per-permission
 *  status; on Android the booleans reflect the OS truth. Callers should
 *  treat individual booleans as advisory on iOS. */
export interface PermissionGrant {
  write: Record<WriteVitalKind, boolean>;
  read: Record<ReadVitalKind, boolean>;
  /** True iff the OS prompt was shown to the user. */
  userPrompted: boolean;
}

export interface WriteResultPerVital {
  /** Number of samples the platform accepted. */
  written: number;
  /** Number rejected (validation, missing permission, etc). */
  rejected: number;
  /** Optional first error encountered; for telemetry only — does not
   *  surface to the user (write path is fire-and-forget). */
  firstError?: string;
}

/** Aggregate result after a multi-vital write fan-out. */
export interface WriteResult {
  bp: WriteResultPerVital;
  hr: WriteResultPerVital;
  spo2: WriteResultPerVital;
  sleep: WriteResultPerVital;
  steps: WriteResultPerVital;
  calories: WriteResultPerVital;
}

/** Wire shape the future /sync-external-vitals Edge Function (Task 7)
 *  consumes. Mirrors the external_vitals table columns from
 *  supabase/migrations/0006_external_vitals.sql. */
export interface ExternalVitalSample {
  vitalType: ReadVitalKind;
  /** unix sec UTC. */
  measuredAtSec: number;
  valueNumeric: number;
  /** Per the value_unit CHECK constraint in 0006_external_vitals.sql. */
  valueUnit:
    | 'kg'
    | 'lb'
    | 'm'
    | 'cm'
    | 'in'
    | 'mg/dL'
    | 'mmol/L';
  /** HK sourceBundleId or HC dataOrigin.packageName. The round-trip
   *  filter in the adapter strips samples whose origin equals
   *  LEIKO_BUNDLE_ID before they reach the caller. */
  sourceOrigin: string;
}

export interface ReadOptions {
  /** unix sec UTC; only return samples at or after this time. */
  sinceSec: number;
  /** Defaults to all kinds. */
  vitals?: ReadVitalKind[];
}

/** A multi-vital write payload. Each array independently optional —
 *  matches the MultiVitalsPayload pattern from D13 §4.2. */
export interface WriteBatch {
  bp?: BPReading[];
  hr?: HRSample[];
  spo2?: SpO2Sample[];
  sleep?: SleepSession[];
  steps?: ActivityDay[];
  calories?: CaloriesDay[];
}

/** The internal contract every platform adapter satisfies. The public
 *  index.ts orchestrates these calls. Adapters are NEVER imported
 *  outside services/health-platform/. */
export interface HealthPlatformAdapter {
  readonly platform: 'apple_health' | 'health_connect' | 'mock';

  isAvailable(): Promise<boolean>;
  requestPermissions(req: PermissionRequest): Promise<PermissionGrant>;

  writeBP(samples: BPReading[]): Promise<WriteResultPerVital>;
  writeHR(samples: HRSample[]): Promise<WriteResultPerVital>;
  writeSpO2(samples: SpO2Sample[]): Promise<WriteResultPerVital>;
  writeSleep(sessions: SleepSession[]): Promise<WriteResultPerVital>;
  writeSteps(days: ActivityDay[]): Promise<WriteResultPerVital>;
  writeCalories(days: CaloriesDay[]): Promise<WriteResultPerVital>;

  readExternalSince(opts: ReadOptions): Promise<ExternalVitalSample[]>;
}

export const EMPTY_RESULT: WriteResultPerVital = { written: 0, rejected: 0 };

export const ALL_WRITE_KINDS: WriteVitalKind[] = [
  'bp',
  'hr',
  'spo2',
  'sleep',
  'steps',
  'calories',
];

export const ALL_READ_KINDS: ReadVitalKind[] = [
  'weight',
  'height',
  'blood_glucose',
];
