// Auth store unit tests. Run under the `pure` Jest project (ts-jest +
// node) — react-native-mmkv is auto-mocked via __mocks__/react-native-
// mmkv.js, and we hand-mock services/supabase so no network or env vars
// are required.
//
// The high-value assertions per the Sprint 2 acceptance criteria:
//   - setPendingAccountType persists to MMKV and updates store state
//   - signUpWithOtp refuses to proceed without a fork choice
//   - signUpWithOtp forwards account_type as raw_user_meta_data so the
//     handle_new_user trigger (migration 0002) stamps it onto
//     public.users at first insert
//   - verifyOtp clears the pending fork choice on success so a future
//     signed-out state doesn't replay it
//   - signOut resets session/profile/status

// Set env vars BEFORE importing the supabase module — otherwise the
// module-load assertion in services/supabase.ts will throw.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const signInWithOtp = jest.fn();
const verifyOtp = jest.fn();
const signOut = jest.fn();
const getSession = jest.fn();
const onAuthStateChange = jest.fn();

const fromSelectMaybeSingle = jest.fn();

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      signOut: (...args: unknown[]) => signOut(...args),
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => fromSelectMaybeSingle(),
        }),
      }),
    }),
  },
}));

import { useAuth } from '../auth';
import { mmkv, STORAGE_KEYS } from '../../services/storage';

beforeEach(() => {
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
  signOut.mockReset();
  getSession.mockReset();
  onAuthStateChange.mockReset();
  fromSelectMaybeSingle.mockReset();
  mmkv.clearAll();
  useAuth.setState({
    status: 'loading',
    session: null,
    profile: null,
    pendingAccountType: null,
    lastOtpEmail: null,
  });
});

describe('useAuth — pendingAccountType', () => {
  it('writes the choice to MMKV and exposes it on the store', () => {
    useAuth.getState().setPendingAccountType('caregiver');

    expect(useAuth.getState().pendingAccountType).toBe('caregiver');
    expect(mmkv.getString(STORAGE_KEYS.pendingAccountType)).toBe('caregiver');
  });

  it('clears the choice from MMKV and the store', () => {
    useAuth.getState().setPendingAccountType('self_buyer');
    useAuth.getState().clearPendingAccountType();

    expect(useAuth.getState().pendingAccountType).toBeNull();
    expect(mmkv.contains(STORAGE_KEYS.pendingAccountType)).toBe(false);
  });
});

describe('useAuth — signUpWithOtp', () => {
  it('refuses to proceed if no fork choice is cached', async () => {
    await expect(useAuth.getState().signUpWithOtp('a@b.co')).rejects.toThrow(
      /No account type/,
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('forwards account_type as raw_user_meta_data when caregiver was chosen', async () => {
    signInWithOtp.mockResolvedValueOnce({ data: {}, error: null });
    useAuth.getState().setPendingAccountType('caregiver');

    await useAuth.getState().signUpWithOtp('mum@example.com');

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'mum@example.com',
      options: {
        shouldCreateUser: true,
        data: { account_type: 'caregiver' },
      },
    });
    expect(useAuth.getState().lastOtpEmail).toBe('mum@example.com');
  });

  it('forwards account_type for self_buyer', async () => {
    signInWithOtp.mockResolvedValueOnce({ data: {}, error: null });
    useAuth.getState().setPendingAccountType('self_buyer');

    await useAuth.getState().signUpWithOtp('me@example.com');

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'me@example.com',
      options: {
        shouldCreateUser: true,
        data: { account_type: 'self_buyer' },
      },
    });
  });

  it('surfaces a Supabase error', async () => {
    signInWithOtp.mockResolvedValueOnce({
      data: null,
      error: new Error('rate limit'),
    });
    useAuth.getState().setPendingAccountType('caregiver');

    await expect(useAuth.getState().signUpWithOtp('x@y.z')).rejects.toThrow(/rate limit/);
  });
});

describe('useAuth — signInWithOtp', () => {
  it('uses shouldCreateUser=false and does not pass account_type', async () => {
    signInWithOtp.mockResolvedValueOnce({ data: {}, error: null });

    await useAuth.getState().signInWithOtp('returning@example.com');

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'returning@example.com',
      options: { shouldCreateUser: false },
    });
  });
});

describe('useAuth — verifyOtp', () => {
  const sessionFixture = {
    access_token: 'a',
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 9999999999,
    user: { id: 'user-1', email: 'mum@example.com' },
  };
  const profileFixture = {
    id: 'user-1',
    email: 'mum@example.com',
    display_name: 'mum',
    photo_url: null,
    preferred_language: 'en',
    timezone: 'UTC',
    year_of_birth: null,
    account_type: 'caregiver' as const,
    marketing_opt_in: false,
    deleted_at: null,
    created_at: '2026-05-06T00:00:00Z',
    updated_at: '2026-05-06T00:00:00Z',
  };

  it('hydrates the profile and clears pendingAccountType on success', async () => {
    verifyOtp.mockResolvedValueOnce({ data: { session: sessionFixture }, error: null });
    fromSelectMaybeSingle.mockResolvedValueOnce({ data: profileFixture, error: null });
    useAuth.getState().setPendingAccountType('caregiver');

    await useAuth.getState().verifyOtp('mum@example.com', '123456');

    const state = useAuth.getState();
    expect(state.status).toBe('authenticated');
    expect(state.profile?.account_type).toBe('caregiver');
    expect(state.pendingAccountType).toBeNull();
    expect(mmkv.contains(STORAGE_KEYS.pendingAccountType)).toBe(false);
  });

  it('does not clear pendingAccountType when verifyOtp returns no session', async () => {
    verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: null });
    useAuth.getState().setPendingAccountType('caregiver');

    await useAuth.getState().verifyOtp('mum@example.com', '999999');

    expect(useAuth.getState().pendingAccountType).toBe('caregiver');
    expect(useAuth.getState().status).toBe('unauthenticated');
  });

  it('surfaces a verifyOtp error and leaves state unchanged', async () => {
    verifyOtp.mockResolvedValueOnce({ data: null, error: new Error('Token has expired') });
    useAuth.getState().setPendingAccountType('caregiver');

    await expect(useAuth.getState().verifyOtp('mum@example.com', '000000')).rejects.toThrow(
      /Token has expired/,
    );
    expect(useAuth.getState().pendingAccountType).toBe('caregiver');
    expect(useAuth.getState().status).toBe('loading');
  });
});

describe('useAuth — signOut', () => {
  it('resets session, profile, and status to unauthenticated', async () => {
    useAuth.setState({
      status: 'authenticated',
      session: { access_token: 'a' } as never,
      profile: { id: 'x' } as never,
    });
    signOut.mockResolvedValueOnce({ error: null });

    await useAuth.getState().signOut();

    const state = useAuth.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.session).toBeNull();
    expect(state.profile).toBeNull();
  });
});
