// Public surface for the platform-health bridge — Sprint 9.5.
//
// Architecture:
//   index.ts (this file)        ← public surface every other module imports
//   types.ts                    ← shared types + the HealthPlatformAdapter contract
//   adapters/
//     mock.ts                   ← reference implementation for tests
//     native.ts                 ← Metro fallback (re-exports mock)
//     native.ios.ts             ← @kingstinct/react-native-healthkit wrapper
//     native.android.ts         ← react-native-health-connect wrapper
//
// Metro picks native.ios.ts on iOS builds and native.android.ts on
// Android builds via the platform-extension resolver. Jest (no native
// platform) and any non-mobile target see native.ts → mock. This keeps
// each platform's native bundle free of the other platform's library.
//
// No code outside services/health-platform/ should import the
// underlying libs (@kingstinct/react-native-healthkit or
// react-native-health-connect) directly. Adapter swaps stay a one-folder
// change. Sprint 9.5 / Task 5 (write hook on /sync success) and Task 7
// (background read fetch) are the first two consumers of this surface.

import { nativeAdapter } from './adapters/native';
import {
  ALL_READ_KINDS,
  ALL_WRITE_KINDS,
  EMPTY_RESULT,
  type HealthPlatformAdapter,
  type PermissionGrant,
  type PermissionRequest,
  type ReadOptions,
  type WriteBatch,
  type WriteResult,
} from './types';

export * from './types';

let _adapter: HealthPlatformAdapter = nativeAdapter;

/** Test-only adapter override. Production code must not call this; the
 *  Metro resolver does the right thing on iOS/Android, and Jest gets the
 *  mock by default via the cross-platform native.ts re-export. */
export function __setAdapterForTest(adapter: HealthPlatformAdapter): void {
  _adapter = adapter;
}

/** Test-only — restore the resolver-default adapter. */
export function __resetAdapterForTest(): void {
  _adapter = nativeAdapter;
}

export function getActivePlatform(): HealthPlatformAdapter['platform'] {
  return _adapter.platform;
}

export async function isAvailable(): Promise<boolean> {
  return _adapter.isAvailable();
}

export async function requestPermissions(
  req: PermissionRequest = { write: ALL_WRITE_KINDS, read: ALL_READ_KINDS },
): Promise<PermissionGrant> {
  return _adapter.requestPermissions(req);
}

/** Fan-out write. Each per-vital call is independent; one rejected
 *  write does NOT block the others. The result aggregates per-vital
 *  counts — Task 5's caller treats this as fire-and-forget telemetry,
 *  not a blocking gate. */
export async function write(batch: WriteBatch): Promise<WriteResult> {
  const [bp, hr, spo2, sleep, steps, calories] = await Promise.all([
    batch.bp?.length ? _adapter.writeBP(batch.bp) : Promise.resolve(EMPTY_RESULT),
    batch.hr?.length ? _adapter.writeHR(batch.hr) : Promise.resolve(EMPTY_RESULT),
    batch.spo2?.length ? _adapter.writeSpO2(batch.spo2) : Promise.resolve(EMPTY_RESULT),
    batch.sleep?.length ? _adapter.writeSleep(batch.sleep) : Promise.resolve(EMPTY_RESULT),
    batch.steps?.length ? _adapter.writeSteps(batch.steps) : Promise.resolve(EMPTY_RESULT),
    batch.calories?.length
      ? _adapter.writeCalories(batch.calories)
      : Promise.resolve(EMPTY_RESULT),
  ]);
  return { bp, hr, spo2, sleep, steps, calories };
}

export async function readExternalSince(opts: ReadOptions) {
  return _adapter.readExternalSince(opts);
}
