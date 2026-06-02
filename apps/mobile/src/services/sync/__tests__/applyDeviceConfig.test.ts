import { applyDeviceConfig } from '../applyDeviceConfig';
import { useVitalSetup } from '../../../state/vitalSetup';
import type { UrionDevice } from '../../ble/UrionDevice';
import type { UserRow } from '../../../types/database';

const fakeDevice = {} as UrionDevice;

function makeProfile(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u-1',
    email: 'u@test',
    display_name: 'U',
    photo_url: null,
    preferred_language: 'en',
    timezone: 'UTC',
    year_of_birth: 1985,
    account_type: 'self_buyer',
    marketing_opt_in: false,
    gender: 'male',
    height_cm: 175,
    weight_kg: 80,
    hypertension_status: null,
    deleted_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

beforeEach(() => {
  useVitalSetup.getState().__resetForTest();
});

describe('applyDeviceConfig', () => {
  it('runs even when dirty=false IF lastFlushedAtMs is stale or 0 (Sprint 16.5b debounce-or-dirty)', async () => {
    // Default state: lastFlushedAtMs=0, dirty=false. With the new debounce-
    // or-dirty gate, sinceFlushMs is POSITIVE_INFINITY > FLUSH_DEBOUNCE_MS,
    // so the flush runs. This refreshes the watch's config periodically
    // even when the user hasn't touched Settings — the load-bearing fix
    // for "demographics never reach the watch on background syncs."
    const setters = {
      setAutoHR: jest.fn().mockResolvedValue(undefined),
      setAutoSpO2: jest.fn().mockResolvedValue(undefined),
      setUserParams: jest.fn().mockResolvedValue(undefined),
      setGoals: jest.fn().mockResolvedValue(undefined),
    };
    const r = await applyDeviceConfig(fakeDevice, {
      profileSnapshot: makeProfile(),
      setters,
    });
    expect(r.ran).toBe(true);
    expect(setters.setAutoHR).toHaveBeenCalled();
  });

  it('no-ops when dirty=false AND last flush was recent (within debounce window)', async () => {
    // Simulate a successful flush moments ago (clearDirty stamps Date.now()).
    useVitalSetup.getState().setAutoHr(false);
    useVitalSetup.getState().clearDirty();
    expect(useVitalSetup.getState().dirty).toBe(false);
    expect(useVitalSetup.getState().lastFlushedAtMs).toBeGreaterThan(0);
    const setters = {
      setAutoHR: jest.fn().mockResolvedValue(undefined),
      setAutoSpO2: jest.fn().mockResolvedValue(undefined),
      setUserParams: jest.fn().mockResolvedValue(undefined),
      setGoals: jest.fn().mockResolvedValue(undefined),
    };
    const r = await applyDeviceConfig(fakeDevice, {
      profileSnapshot: makeProfile(),
      setters,
    });
    expect(r.ran).toBe(false);
    expect(setters.setAutoHR).not.toHaveBeenCalled();
  });

  it('writes all four packets when dirty + demographics populated', async () => {
    useVitalSetup.getState().setAutoHr(false);
    const setters = {
      setAutoHR: jest.fn().mockResolvedValue(undefined),
      setAutoSpO2: jest.fn().mockResolvedValue(undefined),
      setUserParams: jest.fn().mockResolvedValue(undefined),
      setGoals: jest.fn().mockResolvedValue(undefined),
    };
    const r = await applyDeviceConfig(fakeDevice, {
      profileSnapshot: makeProfile(),
      setters,
    });
    expect(r.ran).toBe(true);
    expect(r.steps).toEqual(['autoHr', 'autoSpo2', 'userParams', 'goals']);
    expect(setters.setAutoHR).toHaveBeenCalledWith(fakeDevice, false);
    // Sprint 16.5b — Auto-SpO2 default flipped from false to true.
    expect(setters.setAutoSpO2).toHaveBeenCalledWith(fakeDevice, true);
    expect(setters.setUserParams).toHaveBeenCalledWith(
      fakeDevice,
      expect.objectContaining({
        gender: 'male',
        ageYears: expect.any(Number),
        heightCm: 175,
        weightKg: 80,
      }),
    );
    expect(setters.setGoals).toHaveBeenCalledWith(
      fakeDevice,
      expect.objectContaining({ stepsTarget: 6000, sleepTargetMinutes: 480 }),
    );
    // Dirty cleared after success.
    expect(useVitalSetup.getState().dirty).toBe(false);
  });

  it('skips setUserParams when demographics are incomplete', async () => {
    useVitalSetup.getState().setAutoHr(false);
    const setters = {
      setAutoHR: jest.fn().mockResolvedValue(undefined),
      setAutoSpO2: jest.fn().mockResolvedValue(undefined),
      setUserParams: jest.fn().mockResolvedValue(undefined),
      setGoals: jest.fn().mockResolvedValue(undefined),
    };
    await applyDeviceConfig(fakeDevice, {
      profileSnapshot: makeProfile({ height_cm: null }),
      setters,
    });
    expect(setters.setUserParams).not.toHaveBeenCalled();
    expect(setters.setGoals).toHaveBeenCalled();
  });

  it('leaves dirty=true when an early step fails', async () => {
    useVitalSetup.getState().setAutoHr(false);
    const setters = {
      setAutoHR: jest.fn().mockRejectedValue(new Error('GATT timeout')),
      setAutoSpO2: jest.fn().mockResolvedValue(undefined),
      setUserParams: jest.fn().mockResolvedValue(undefined),
      setGoals: jest.fn().mockResolvedValue(undefined),
    };
    const r = await applyDeviceConfig(fakeDevice, {
      profileSnapshot: makeProfile(),
      setters,
    });
    expect(r.error).toContain('autoHr');
    expect(setters.setAutoSpO2).not.toHaveBeenCalled();
    expect(useVitalSetup.getState().dirty).toBe(true);
  });

  it('respects force=true even when dirty=false', async () => {
    const setters = {
      setAutoHR: jest.fn().mockResolvedValue(undefined),
      setAutoSpO2: jest.fn().mockResolvedValue(undefined),
      setUserParams: jest.fn().mockResolvedValue(undefined),
      setGoals: jest.fn().mockResolvedValue(undefined),
    };
    const r = await applyDeviceConfig(fakeDevice, {
      profileSnapshot: makeProfile(),
      setters,
      force: true,
    });
    expect(r.ran).toBe(true);
    expect(setters.setAutoHR).toHaveBeenCalled();
  });
});
