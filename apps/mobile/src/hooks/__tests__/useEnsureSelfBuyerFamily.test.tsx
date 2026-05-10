// useEnsureSelfBuyerFamily tests — Sprint 14.5 task 2.
//
// Coverage:
//   - No-op when not signed in
//   - No-op when account_type !== 'self_buyer'
//   - No-op when a membership row already exists
//   - Calls create_family RPC with the expected args when missing
//   - Idempotent across re-renders (same effect dependencies)

import { renderHook, waitFor } from '@testing-library/react-native';
import { useEnsureSelfBuyerFamily } from '../useEnsureSelfBuyerFamily';

// jest hoists jest.mock() calls above imports — closure access to
// regular `const`s isn't allowed. Names prefixed with `mock` are
// the documented escape hatch.
const mockRpc = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock('../../services/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            limit: () => ({
              maybeSingle: () => mockMaybeSingle(),
            }),
          }),
        }),
      }),
    }),
  },
}));

jest.mock('../../services/storage', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      getString: (k: string) => store.get(k),
      getNumber: () => undefined,
      getBoolean: () => undefined,
      set: (k: string, v: string) => store.set(k, v),
      delete: (k: string) => store.delete(k),
      contains: (k: string) => store.has(k),
    },
    STORAGE_KEYS: {
      currentFamilyId: 'currentFamilyId',
      caregiverOnboardingComplete: 'caregiverOnboardingComplete',
      selfBuyerOnboardingComplete: 'selfBuyerOnboardingComplete',
    },
  };
});

jest.mock('../../services/analytics/logger', () => ({
  logger: { track: jest.fn() },
}));

import { useAuth } from '../../state/auth';
import type { AccountType, UserRow } from '../../types/database';

function setProfile(accountType: AccountType | null, displayName = 'Test'): void {
  if (accountType === null) {
    useAuth.setState({ profile: null, status: 'unauthenticated' });
    return;
  }
  const profile: UserRow = {
    id: 'user-1',
    email: 'u@test.local',
    display_name: displayName,
    photo_url: null,
    preferred_language: 'en',
    timezone: 'UTC',
    year_of_birth: 1980,
    account_type: accountType,
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

beforeEach(() => {
  mockRpc.mockReset();
  mockMaybeSingle.mockReset();
});

it('no-ops when there is no signed-in profile', () => {
  setProfile(null);
  renderHook(() => useEnsureSelfBuyerFamily());
  expect(mockMaybeSingle).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('no-ops when account_type is caregiver', () => {
  setProfile('caregiver');
  renderHook(() => useEnsureSelfBuyerFamily());
  expect(mockMaybeSingle).not.toHaveBeenCalled();
  expect(mockRpc).not.toHaveBeenCalled();
});

it('no-ops when a membership row already exists', async () => {
  setProfile('self_buyer');
  mockMaybeSingle.mockResolvedValueOnce({
    data: { family_id: 'fam-existing' },
    error: null,
  });
  renderHook(() => useEnsureSelfBuyerFamily());
  await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
  expect(mockRpc).not.toHaveBeenCalled();
});

it('calls create_family with self params when no membership exists', async () => {
  setProfile('self_buyer', 'Biebele');
  mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
  mockRpc.mockResolvedValueOnce({
    data: [{ family_id: 'fam-new-1' }],
    error: null,
  });
  renderHook(() => useEnsureSelfBuyerFamily());
  await waitFor(() => expect(mockRpc).toHaveBeenCalled());
  expect(mockRpc).toHaveBeenCalledWith('create_family', {
    _parent_display_name: 'Biebele',
    _parent_relationship: 'self',
    _caregiver_relationship: 'self',
  });
});

it('does NOT call rpc again on re-render with same dependencies', async () => {
  setProfile('self_buyer');
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockRpc.mockResolvedValue({ data: [{ family_id: 'fam-x' }], error: null });
  const { rerender } = renderHook(() => useEnsureSelfBuyerFamily());
  await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
  rerender({});
  // No new effect should fire because deps (userId, accountType,
  // displayName) are unchanged. rpc still 1.
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
