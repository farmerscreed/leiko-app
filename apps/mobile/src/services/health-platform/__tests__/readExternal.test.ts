// Background read pipeline tests — Sprint 9.5 / Task 7.
//
// Coverage:
//   • Gating: caregiver / master off / no read toggles → ran=false
//   • Debounce: foreground trigger inside 24h → too_recent
//   • Cursor advance: success → cursor moves to attempt-start;
//     failure → cursor untouched
//   • Per-vital filtering: only enabled kinds are passed to the adapter
//   • Empty-result still advances cursor (no infinite refetch)

// Mock the supabase module surface that readExternal POSTs through.
// jest.spyOn against supabase.functions.invoke does NOT intercept the
// real supabase-js FunctionsClient (the property isn't writable in a
// way that survives the bound dispatch), so we mock the module instead.
jest.mock('../../supabase', () => ({
  supabase: {
    functions: { invoke: jest.fn() },
  },
}));

import { __reset as resetMockAdapter, __seedExternal, mockAdapter } from '../adapters/mock';
import { __setAdapterForTest, __resetAdapterForTest } from '../index';
import {
  __getCursorSec,
  __getLastAttemptMs,
  __resetForTest,
  READ_DEBOUNCE_MS,
  runExternalVitalsFetch,
} from '../readExternal';
import {
  __resetForTest as resetToggles,
  setMaster,
  setReadVital,
} from '../toggles';
import { useAuth } from '../../../state/auth';
import { mmkv, STORAGE_KEYS } from '../../storage';
import { supabase } from '../../supabase';
import type { AccountType, UserRow } from '../../../types/database';

const invokeSpy = supabase.functions.invoke as jest.Mock;

function setAccountType(kind: AccountType): void {
  const profile: UserRow = {
    id: 'user-7',
    email: 'r7@test.local',
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
  __resetForTest();
  clearAuth();
  invokeSpy.mockReset();
});

afterAll(() => {
  __resetAdapterForTest();
  clearAuth();
});

describe('runExternalVitalsFetch — gating', () => {
  it('skips when no profile is loaded', async () => {
    const r = await runExternalVitalsFetch('foreground');
    expect(r).toEqual({ ran: false, reason: 'no_user' });
  });

  it('skips for caregiver account_type', async () => {
    setAccountType('caregiver');
    setMaster(true);
    setReadVital('weight', true);
    const r = await runExternalVitalsFetch('foreground');
    expect(r).toEqual({ ran: false, reason: 'caregiver' });
  });

  it('skips when master toggle is off', async () => {
    setAccountType('self_buyer');
    setReadVital('weight', true); // child on, master off
    const r = await runExternalVitalsFetch('foreground');
    expect(r.ran).toBe(false);
    expect(r.reason).toBe('master_off');
  });

  it('skips when no read toggles are enabled, master on', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    const r = await runExternalVitalsFetch('foreground');
    expect(r.ran).toBe(false);
  });
});

describe('runExternalVitalsFetch — debounce', () => {
  it('skips foreground trigger inside the 24h window', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setReadVital('weight', true);
    // Mark a recent attempt.
    mmkv.set(STORAGE_KEYS.healthPlatformLastAttempt, String(Date.now()));
    const r = await runExternalVitalsFetch('foreground');
    expect(r).toEqual({ ran: false, reason: 'too_recent' });
  });

  it('manual trigger bypasses the debounce', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setReadVital('weight', true);
    mmkv.set(STORAGE_KEYS.healthPlatformLastAttempt, String(Date.now()));
    invokeSpy.mockResolvedValue({
      data: { inserted: 0, duplicates: 0, rejected: [] },
      error: null,
    });
    const r = await runExternalVitalsFetch('manual');
    expect(r.ran).toBe(true);
  });
});

describe('runExternalVitalsFetch — cursor advance', () => {
  it('advances cursor on a successful POST', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setReadVital('weight', true);
    __seedExternal([
      {
        vitalType: 'weight',
        measuredAtSec: Math.floor(Date.now() / 1000) - 3600,
        valueNumeric: 78.4,
        valueUnit: 'kg',
        sourceOrigin: 'com.withings.scale',
      },
    ]);
    invokeSpy.mockResolvedValue({
      data: { inserted: 1, duplicates: 0, rejected: [] },
      error: null,
    });
    const before = __getCursorSec();
    const r = await runExternalVitalsFetch('foreground');
    expect(r.ran).toBe(true);
    expect(r.inserted).toBe(1);
    expect(__getCursorSec()).toBeGreaterThanOrEqual(before);
  });

  it('does NOT advance cursor on POST failure', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setReadVital('weight', true);
    __seedExternal([
      {
        vitalType: 'weight',
        measuredAtSec: Math.floor(Date.now() / 1000) - 3600,
        valueNumeric: 78.4,
        valueUnit: 'kg',
        sourceOrigin: 'com.withings.scale',
      },
    ]);
    invokeSpy.mockResolvedValue({ data: null, error: { message: 'network' } });
    // Cursor seeded explicitly so we can detect non-advance.
    mmkv.set(STORAGE_KEYS.healthPlatformReadCursor, '1700000000');
    await runExternalVitalsFetch('foreground');
    expect(__getCursorSec()).toBe(1700000000);
  });

  it('advances cursor when the platform returns no samples', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setReadVital('weight', true);
    mmkv.set(STORAGE_KEYS.healthPlatformReadCursor, '1700000000');
    const r = await runExternalVitalsFetch('foreground');
    expect(r.reason).toBe('no_samples');
    expect(__getCursorSec()).toBeGreaterThan(1700000000);
  });

  it('updates last-attempt-ms even when the fetch errors', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setReadVital('weight', true);
    __seedExternal([
      {
        vitalType: 'weight',
        measuredAtSec: Math.floor(Date.now() / 1000) - 3600,
        valueNumeric: 78,
        valueUnit: 'kg',
        sourceOrigin: 'com.withings.scale',
      },
    ]);
    invokeSpy.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const before = __getLastAttemptMs();
    await runExternalVitalsFetch('foreground');
    expect(__getLastAttemptMs()).toBeGreaterThan(before);
  });
});

describe('runExternalVitalsFetch — per-vital filter to adapter', () => {
  it('only asks the adapter for enabled vital kinds', async () => {
    setAccountType('self_buyer');
    setMaster(true);
    setReadVital('weight', true);
    // height + glucose stay off

    const readSpy = jest.spyOn(mockAdapter, 'readExternalSince');
    invokeSpy.mockResolvedValue({
      data: { inserted: 0, duplicates: 0, rejected: [] },
      error: null,
    });
    await runExternalVitalsFetch('foreground');
    expect(readSpy).toHaveBeenCalledTimes(1);
    expect(readSpy.mock.calls[0][0].vitals).toEqual(['weight']);
    readSpy.mockRestore();
  });
});

describe('READ_DEBOUNCE_MS', () => {
  it('is 24 hours', () => {
    expect(READ_DEBOUNCE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
