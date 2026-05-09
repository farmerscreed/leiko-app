// In-memory mock adapter — the contract reference implementation. Used
// by Jest tests directly and by the Metro resolver as the fallback for
// non-iOS / non-Android platforms (web preview).
//
// Behaviour:
//   • isAvailable() — flag, default true
//   • requestPermissions() — records what was requested, returns
//     `userPrompted: true` and grants for everything in the request
//   • write*() — appends to in-memory buffers, returns counts
//   • readExternalSince() — returns whatever was injected via
//     __seedExternal(); applies the `sinceSec` filter and the
//     LEIKO_BUNDLE_ID round-trip filter
//
// The mock exposes a few `__test*` helpers so tests can introspect
// internal state without going through the public surface. These are
// prefixed `__` to make their test-only nature unmistakable; production
// callers should never touch them.

import type {
  ActivityDay,
  BPReading,
  CaloriesDay,
  HRSample,
  SleepSession,
  SpO2Sample,
} from '../../../types/vitals';
import {
  EMPTY_RESULT,
  LEIKO_BUNDLE_ID,
  type ExternalVitalSample,
  type HealthPlatformAdapter,
  type PermissionGrant,
  type PermissionRequest,
  type ReadOptions,
  type WriteResultPerVital,
} from '../types';

interface MockState {
  available: boolean;
  lastPermissionRequest: PermissionRequest | null;
  lastPermissionGrant: PermissionGrant | null;
  bp: BPReading[];
  hr: HRSample[];
  spo2: SpO2Sample[];
  sleep: SleepSession[];
  steps: ActivityDay[];
  calories: CaloriesDay[];
  external: ExternalVitalSample[];
}

const state: MockState = {
  available: true,
  lastPermissionRequest: null,
  lastPermissionGrant: null,
  bp: [],
  hr: [],
  spo2: [],
  sleep: [],
  steps: [],
  calories: [],
  external: [],
};

function counted(samples: readonly unknown[]): WriteResultPerVital {
  if (samples.length === 0) return EMPTY_RESULT;
  return { written: samples.length, rejected: 0 };
}

function grantAll(req: PermissionRequest): PermissionGrant {
  const write = {} as PermissionGrant['write'];
  for (const k of req.write) write[k] = true;
  const read = {} as PermissionGrant['read'];
  for (const k of req.read) read[k] = true;
  return { write, read, userPrompted: true };
}

export const mockAdapter: HealthPlatformAdapter = {
  platform: 'mock',

  async isAvailable() {
    return state.available;
  },

  async requestPermissions(req) {
    state.lastPermissionRequest = req;
    const grant = grantAll(req);
    state.lastPermissionGrant = grant;
    return grant;
  },

  async writeBP(samples) {
    state.bp.push(...samples);
    return counted(samples);
  },
  async writeHR(samples) {
    state.hr.push(...samples);
    return counted(samples);
  },
  async writeSpO2(samples) {
    state.spo2.push(...samples);
    return counted(samples);
  },
  async writeSleep(sessions) {
    state.sleep.push(...sessions);
    return counted(sessions);
  },
  async writeSteps(days) {
    state.steps.push(...days);
    return counted(days);
  },
  async writeCalories(days) {
    state.calories.push(...days);
    return counted(days);
  },

  async readExternalSince(opts: ReadOptions) {
    const wanted = opts.vitals;
    return state.external.filter((s) => {
      if (s.measuredAtSec < opts.sinceSec) return false;
      if (wanted && !wanted.includes(s.vitalType)) return false;
      // Round-trip filter — D13 §12.6.
      if (s.sourceOrigin === LEIKO_BUNDLE_ID) return false;
      return true;
    });
  },
};

// ---- test-only introspection ---------------------------------------------

export function __reset(): void {
  state.available = true;
  state.lastPermissionRequest = null;
  state.lastPermissionGrant = null;
  state.bp = [];
  state.hr = [];
  state.spo2 = [];
  state.sleep = [];
  state.steps = [];
  state.calories = [];
  state.external = [];
}

export function __setAvailable(value: boolean): void {
  state.available = value;
}

export function __seedExternal(samples: ExternalVitalSample[]): void {
  state.external.push(...samples);
}

export function __getWritten(): {
  bp: BPReading[];
  hr: HRSample[];
  spo2: SpO2Sample[];
  sleep: SleepSession[];
  steps: ActivityDay[];
  calories: CaloriesDay[];
} {
  return {
    bp: [...state.bp],
    hr: [...state.hr],
    spo2: [...state.spo2],
    sleep: [...state.sleep],
    steps: [...state.steps],
    calories: [...state.calories],
  };
}

export function __getLastPermissionRequest(): PermissionRequest | null {
  return state.lastPermissionRequest;
}
