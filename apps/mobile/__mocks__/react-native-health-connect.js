/* global module */
// Manual mock for react-native-health-connect — auto-loaded by Jest because
// it sits in __mocks__ adjacent to node_modules. Provides JS-only stubs so
// the unified services/health-platform/ surface can be exercised under both
// Jest projects (pure ts-jest node + jest-expo RN) without the Android
// native module.
//
// Surface mirrors the methods our adapter calls — initialize, request, read,
// insert — and the SDK-status enum the gating code branches on.

const SdkAvailabilityStatus = Object.freeze({
  SDK_UNAVAILABLE: 1,
  SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  SDK_AVAILABLE: 3,
});

module.exports = {
  __esModule: true,

  // Availability + init
  getSdkStatus: jest.fn(async () => SdkAvailabilityStatus.SDK_AVAILABLE),
  initialize: jest.fn(async () => true),
  openHealthConnectSettings: jest.fn(async () => undefined),
  openHealthConnectDataManagement: jest.fn(async () => undefined),

  // Permissions
  requestPermission: jest.fn(async (perms) => perms),
  getGrantedPermissions: jest.fn(async () => []),
  revokeAllPermissions: jest.fn(async () => undefined),

  // Records
  insertRecords: jest.fn(async (records) => records.map((_, i) => `mock-record-${i}`)),
  readRecords: jest.fn(async () => ({ records: [], pageToken: undefined })),
  readRecord: jest.fn(async () => undefined),
  deleteRecordsByUuids: jest.fn(async () => undefined),
  deleteRecordsByTimeRange: jest.fn(async () => undefined),

  // Aggregations
  aggregateRecord: jest.fn(async () => ({})),
  aggregateGroupByDuration: jest.fn(async () => []),
  aggregateGroupByPeriod: jest.fn(async () => []),

  SdkAvailabilityStatus,
};
