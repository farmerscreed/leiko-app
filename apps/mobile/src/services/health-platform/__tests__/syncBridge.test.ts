// Bridge tests — Sprint 9.5 / Task 5.
//
// Two gates need verifying:
//   1. account_type — caregiver short-circuits to no-op (D13 §12.6)
//   2. toggles — master OFF or per-vital OFF skips that vital
// Plus error containment: a thrown write must not bubble up.

import {
  __getWritten,
  __reset as resetMockAdapter,
  mockAdapter,
} from '../adapters/mock';
import { __setAdapterForTest, __resetAdapterForTest } from '../index';
import {
  forwardMultiVitalsToPlatform,
  forwardReadingToPlatform,
} from '../syncBridge';
import {
  __resetForTest as resetToggles,
  setMaster,
  setWriteVital,
} from '../toggles';
import { useAuth } from '../../../state/auth';
import type { UserRow, AccountType } from '../../../types/database';
import type { MultiVitalsPayload } from '../../../types/vitals';

function setAccountType(kind: AccountType): void {
  const profile: UserRow = {
    id: 'user-1',
    email: 'test@example.local',
    display_name: 'Test',
    photo_url: null,
    preferred_language: 'en',
    timezone: 'UTC',
    year_of_birth: 1980,
    account_type: kind,
    marketing_opt_in: false,
    gender: null,
    height_cm: null,
    weight_kg: null,
    hypertension_status: null,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  useAuth.setState({ profile, status: 'authenticated' });
}

function clearAuth(): void {
  useAuth.setState({ profile: null, status: 'unauthenticated' });
}

beforeEach(() => {
  resetMockAdapter();
  __setAdapterForTest(mockAdapter);
  resetToggles();
  clearAuth();
});

afterAll(() => {
  __resetAdapterForTest();
  clearAuth();
});

const SAMPLE_BP = {
  measuredAtSec: 1700000000,
  systolic: 124,
  diastolic: 78,
  pulse: 72,
  source: 'watch' as const,
};

describe('forwardReadingToPlatform — gating', () => {
  it('no-ops when no profile is loaded', async () => {
    await forwardReadingToPlatform(SAMPLE_BP);
    expect(__getWritten().bp).toHaveLength(0);
  });

  it('no-ops for caregiver account_type (D13 §12.6)', async () => {
    setAccountType('caregiver');
    setMaster(true);
    setWriteVital('bp', true);
    await forwardReadingToPlatform(SAMPLE_BP);
    expect(__getWritten().bp).toHaveLength(0);
  });

  it('no-ops when master toggle is off', async () => {
    setAccountType('self_buyer');
    setWriteVital('bp', true); // per-vital on, master off
    await forwardReadingToPlatform(SAMPLE_BP);
    expect(__getWritten().bp).toHaveLength(0);
  });

  it('no-ops when bp per-vital toggle is off, even with master on', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    // bp toggle stays off
    await forwardReadingToPlatform(SAMPLE_BP);
    expect(__getWritten().bp).toHaveLength(0);
  });

  it('writes bp when self_buyer + master + per-vital all on', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setWriteVital('bp', true);
    await forwardReadingToPlatform(SAMPLE_BP);
    expect(__getWritten().bp).toHaveLength(1);
    expect(__getWritten().bp[0].systolic).toBe(124);
  });

  it('writes bp for parent (own phone) account_type', async () => {
    setAccountType('parent');
    setMaster(true);
    setWriteVital('bp', true);
    await forwardReadingToPlatform(SAMPLE_BP);
    expect(__getWritten().bp).toHaveLength(1);
  });
});

describe('forwardMultiVitalsToPlatform — per-vital filtering', () => {
  const PAYLOAD: MultiVitalsPayload = {
    device: {
      bleId: 'b1',
      macSuffix: 'aa00',
      name: 'U16',
      model: 'U16H',
    },
    bpReadings: [SAMPLE_BP],
    hrSamples: [
      {
        measuredAtSec: 1700000060,
        bpm: 70,
        sampleWindowSec: 30,
        motionState: 'rest',
        isSpotCheck: false,
      },
    ],
    spo2Samples: [
      {
        measuredAtSec: 1700000120,
        percent: 97,
        maxInWindow: 99,
        minInWindow: 95,
        sampleWindowSec: 60,
        isSpotCheck: false,
        perfusionIndex: null,
      },
    ],
    activityDays: [
      {
        dayLocal: '2026-05-09',
        measuredAtSec: 1700000000,
        totalSteps: 4321,
        targetSteps: 6000,
        lastSampleAtSec: 1700000000,
        hourly: Array(24).fill(0),
      },
    ],
    clientSyncedAtSec: 1700000200,
    clientAppVersion: '0.0.1',
  };

  it('returns null and writes nothing for caregiver', async () => {
    setAccountType('caregiver');
    setMaster(true);
    setWriteVital('bp', true);
    setWriteVital('hr', true);

    const result = await forwardMultiVitalsToPlatform(PAYLOAD);
    expect(result).toBeNull();
    const w = __getWritten();
    expect(w.bp).toHaveLength(0);
    expect(w.hr).toHaveLength(0);
  });

  it('writes only the per-vital toggles that are on', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setWriteVital('hr', true);
    setWriteVital('steps', true);
    // bp + spo2 toggles stay off

    const result = await forwardMultiVitalsToPlatform(PAYLOAD);
    expect(result).not.toBeNull();
    const w = __getWritten();
    expect(w.bp).toHaveLength(0);
    expect(w.hr).toHaveLength(1);
    expect(w.spo2).toHaveLength(0);
    expect(w.steps).toHaveLength(1);
  });

  it('returns null when nothing is enabled (no-op + no telemetry leak)', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    // No per-vital toggles on
    const result = await forwardMultiVitalsToPlatform(PAYLOAD);
    expect(result).toBeNull();
  });
});

describe('error containment', () => {
  it('does not throw when the underlying adapter rejects', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setWriteVital('bp', true);

    const failingAdapter = {
      ...mockAdapter,
      writeBP: jest.fn(async () => {
        throw new Error('boom');
      }),
    };
    __setAdapterForTest(failingAdapter);

    // Must not throw.
    await expect(forwardReadingToPlatform(SAMPLE_BP)).resolves.toBeUndefined();
  });
});
