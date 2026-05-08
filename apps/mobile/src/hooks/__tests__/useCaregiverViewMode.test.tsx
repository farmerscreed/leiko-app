import { act, renderHook } from '@testing-library/react-native';
import { mmkv, STORAGE_KEYS } from '../../services/storage';
import { useCaregiverViewMode } from '../useCaregiverViewMode';

beforeEach(() => {
  mmkv.clearAll();
});

describe('useCaregiverViewMode', () => {
  it("defaults to 'birds' when MMKV has no value", () => {
    const { result } = renderHook(() => useCaregiverViewMode());
    expect(result.current.viewMode).toBe('birds');
  });

  it("hydrates from MMKV when 'cards' was previously persisted", () => {
    mmkv.set(STORAGE_KEYS.caregiverViewMode, 'cards');
    const { result } = renderHook(() => useCaregiverViewMode());
    expect(result.current.viewMode).toBe('cards');
  });

  it("falls back to 'birds' when MMKV holds an invalid value", () => {
    mmkv.set(STORAGE_KEYS.caregiverViewMode, 'unknown');
    const { result } = renderHook(() => useCaregiverViewMode());
    expect(result.current.viewMode).toBe('birds');
  });

  it("setViewMode persists to MMKV and updates the returned value", () => {
    const { result } = renderHook(() => useCaregiverViewMode());
    expect(result.current.viewMode).toBe('birds');

    act(() => {
      result.current.setViewMode('cards');
    });

    expect(result.current.viewMode).toBe('cards');
    expect(mmkv.getString(STORAGE_KEYS.caregiverViewMode)).toBe('cards');
  });

  it("setViewMode round-trips back to 'birds'", () => {
    mmkv.set(STORAGE_KEYS.caregiverViewMode, 'cards');
    const { result } = renderHook(() => useCaregiverViewMode());
    expect(result.current.viewMode).toBe('cards');

    act(() => {
      result.current.setViewMode('birds');
    });

    expect(result.current.viewMode).toBe('birds');
    expect(mmkv.getString(STORAGE_KEYS.caregiverViewMode)).toBe('birds');
  });
});
