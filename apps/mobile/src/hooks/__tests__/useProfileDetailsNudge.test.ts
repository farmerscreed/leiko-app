import { renderHook, act } from '@testing-library/react-native';
import { useProfileDetailsNudge } from '../useProfileDetailsNudge';
import { mmkv, STORAGE_KEYS } from '../../services/storage';

let mockProfile: Record<string, unknown> | null = null;
jest.mock('../../state/auth', () => ({
  useAuth: (selector: (s: { profile: unknown }) => unknown) =>
    selector({ profile: mockProfile }),
}));

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    gender: 'male',
    height_cm: 175,
    weight_kg: 80,
    year_of_birth: 1980,
    ...overrides,
  };
}

beforeEach(() => {
  mmkv.remove(STORAGE_KEYS.profileNudgeDismissed);
  mockProfile = null;
});

describe('useProfileDetailsNudge', () => {
  it('does not show for a non-wearer even with missing fields', () => {
    mockProfile = profile({ gender: null, height_cm: null, weight_kg: null });
    const { result } = renderHook(() => useProfileDetailsNudge(false));
    expect(result.current.show).toBe(false);
  });

  it('shows for a wearer missing height', () => {
    mockProfile = profile({ height_cm: null });
    const { result } = renderHook(() => useProfileDetailsNudge(true));
    expect(result.current.show).toBe(true);
  });

  it('shows for a wearer missing gender or weight', () => {
    mockProfile = profile({ gender: null });
    expect(renderHook(() => useProfileDetailsNudge(true)).result.current.show).toBe(true);
    mockProfile = profile({ weight_kg: null });
    expect(renderHook(() => useProfileDetailsNudge(true)).result.current.show).toBe(true);
  });

  it('hides automatically when all demographics are present', () => {
    mockProfile = profile();
    const { result } = renderHook(() => useProfileDetailsNudge(true));
    expect(result.current.show).toBe(false);
  });

  it('stays hidden once dismissed', () => {
    mockProfile = profile({ height_cm: null });
    const { result, rerender } = renderHook(() => useProfileDetailsNudge(true));
    expect(result.current.show).toBe(true);
    act(() => result.current.dismiss());
    rerender({});
    expect(result.current.show).toBe(false);
    // persisted
    expect(mmkv.getBoolean(STORAGE_KEYS.profileNudgeDismissed)).toBe(true);
  });
});
