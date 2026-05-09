/* global module */
// Manual mock for @kingstinct/react-native-healthkit — auto-loaded by Jest
// because it sits at __mocks__/@kingstinct/react-native-healthkit.js adjacent
// to node_modules. Provides JS-only stubs so the unified
// services/health-platform/ surface can be exercised under both Jest projects
// (pure ts-jest node + jest-expo RN) without the Nitro native module.
//
// The real lib's ESM exports are typed end-to-end; the mock surfaces the
// methods our adapter actually calls — request/get/save/query — and a few
// permission-status enums. Anything beyond that is added on demand.

const AuthorizationRequestStatus = Object.freeze({
  Unknown: 0,
  ShouldRequest: 1,
  Unnecessary: 2,
});

const AuthorizationStatus = Object.freeze({
  notDetermined: 0,
  sharingDenied: 1,
  sharingAuthorized: 2,
});

module.exports = {
  __esModule: true,

  // Availability
  isHealthDataAvailable: jest.fn(async () => true),

  // Authorization
  requestAuthorization: jest.fn(async () => true),
  getRequestStatusForAuthorization: jest.fn(
    async () => AuthorizationRequestStatus.Unnecessary,
  ),
  authorizationStatusFor: jest.fn(async () => AuthorizationStatus.sharingAuthorized),

  // Write
  saveQuantitySample: jest.fn(async () => true),
  saveCorrelationSample: jest.fn(async () => true),
  saveCategorySample: jest.fn(async () => true),
  saveWorkoutSample: jest.fn(async () => true),

  // Read
  queryQuantitySamples: jest.fn(async () => []),
  queryCategorySamples: jest.fn(async () => []),
  queryCorrelationSamples: jest.fn(async () => []),
  queryStatisticsForQuantity: jest.fn(async () => undefined),
  getMostRecentQuantitySample: jest.fn(async () => undefined),

  // Identifiers / enums (string sentinels — surface only, not exhaustive)
  HKQuantityTypeIdentifier: {
    bloodPressureSystolic: 'HKQuantityTypeIdentifierBloodPressureSystolic',
    bloodPressureDiastolic: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
    heartRate: 'HKQuantityTypeIdentifierHeartRate',
    oxygenSaturation: 'HKQuantityTypeIdentifierOxygenSaturation',
    stepCount: 'HKQuantityTypeIdentifierStepCount',
    activeEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned',
    bodyMass: 'HKQuantityTypeIdentifierBodyMass',
    height: 'HKQuantityTypeIdentifierHeight',
    bloodGlucose: 'HKQuantityTypeIdentifierBloodGlucose',
  },
  HKCategoryTypeIdentifier: {
    sleepAnalysis: 'HKCategoryTypeIdentifierSleepAnalysis',
  },
  HKCorrelationTypeIdentifier: {
    bloodPressure: 'HKCorrelationTypeIdentifierBloodPressure',
  },
  HKCategoryValueSleepAnalysis: {
    inBed: 0,
    asleepUnspecified: 1,
    awake: 2,
    asleepCore: 3,
    asleepDeep: 4,
    asleepREM: 5,
    inBedToAsleep: 6,
  },
  HKUnit: {
    millimetersOfMercury: 'mmHg',
    countPerMinute: 'count/min',
    percent: '%',
    count: 'count',
    kilocalorie: 'kcal',
    gramPerLiter: 'g/L',
    meter: 'm',
    kilogram: 'kg',
  },
  AuthorizationRequestStatus,
  AuthorizationStatus,
};
