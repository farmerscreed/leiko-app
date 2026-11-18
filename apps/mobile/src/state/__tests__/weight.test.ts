// Weight log — 2026-11-18.

const mockInvoke: jest.Mock = jest.fn();
const mockUpdateProfile: jest.Mock = jest.fn().mockResolvedValue({});
const mockRefresh: jest.Mock = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: () => ({}),
  },
}));
jest.mock('../../services/users/updateProfile', () => ({
  updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
}));
jest.mock('../auth', () => ({
  useAuth: {
    getState: () => ({ profile: { id: 'u1', weight_kg: 115 }, refreshProfile: mockRefresh }),
  },
}));

import { mmkv } from '../../services/storage';
import { useWeight, weightChangeOver, MANUAL_WEIGHT_ORIGIN, type WeightEntry } from '../weight';

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  mmkv.clearAll();
  useWeight.getState().reset();
});

describe('useWeight.addEntry', () => {
  it('saves to the phone first, posts as a leiko_manual weight, and updates the profile weight', async () => {
    mockInvoke.mockResolvedValue({ data: { inserted: 1, duplicates: 0, rejected: [] }, error: null });
    await useWeight.getState().addEntry(114.26, 1_763_470_800);
    await flush();
    const [fn, opts] = mockInvoke.mock.calls[0] as [string, { body: { sourcePlatform: string; samples: Array<Record<string, unknown>> } }];
    expect(fn).toBe('sync-external-vitals');
    expect(opts.body.sourcePlatform).toBe('leiko_manual');
    expect(opts.body.samples[0]).toEqual({
      vitalType: 'weight',
      measuredAtSec: 1_763_470_800,
      valueNumeric: 114.3,
      valueUnit: 'kg',
      sourceOrigin: MANUAL_WEIGHT_ORIGIN,
    });
    expect(mockUpdateProfile).toHaveBeenCalledWith('u1', { weight_kg: 114 });
    expect(useWeight.getState().pending).toHaveLength(0);
    expect(useWeight.getState().recent[0].kg).toBe(114.3);
  });

  it('keeps the entry pending when offline', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') });
    await useWeight.getState().addEntry(100);
    await flush();
    expect(useWeight.getState().pending).toHaveLength(1);
    expect(useWeight.getState().all()).toHaveLength(1);
  });

  it('refuses an out-of-range weight', async () => {
    await expect(useWeight.getState().addEntry(5)).rejects.toThrow('weight_out_of_range');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('weightChangeOver', () => {
  const day = 86400;
  const now = 1_763_470_800;
  const e = (daysAgo: number, kg: number): WeightEntry => ({ measuredAtSec: now - daysAgo * day, kg, source: 'leiko_manual' });

  it('compares the latest with the entry nearest the window start', () => {
    expect(weightChangeOver([e(0, 112), e(10, 113), e(29, 115), e(60, 118)], 30, now)).toBe(-3);
  });

  it('returns null without old enough history', () => {
    expect(weightChangeOver([e(0, 112), e(5, 113)], 30, now)).toBeNull();
    expect(weightChangeOver([e(0, 112)], 30, now)).toBeNull();
  });
});
