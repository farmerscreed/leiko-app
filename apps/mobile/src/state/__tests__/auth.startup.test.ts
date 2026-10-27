// Launch-path resilience — the "app keeps loading forever" bug
// (2026-10-27). Before the fix, hydrate() awaited getSession() and the
// profile fetch with no deadline and no failure branch, so a stalled or
// failed request left status === 'loading' (the spinner) for good.
//
// These tests pin the new contract:
//   - nothing on the launch path can keep the spinner up past the deadline
//   - offline with a saved profile → the app opens (authenticated)
//   - offline with no saved profile → 'offline' (Try again screen), never 'loading'
//   - Try again recovers once the network is back
//   - a late session refresh is adopted without a tap
//   - the saved profile is written on success and cleared on sign-out

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const getSession = jest.fn();
const onAuthStateChange = jest.fn();
const signOut = jest.fn();
const fromSelectMaybeSingle = jest.fn();
const storedGetItem = jest.fn();

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => fromSelectMaybeSingle(),
        }),
      }),
    }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

jest.mock('../../services/secureStorage', () => ({
  secureSupabaseStorage: {
    getItem: (...args: unknown[]) => storedGetItem(...args),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import { useAuth, STARTUP_TIMEOUT_MS } from '../auth';
import { mmkv, STORAGE_KEYS } from '../../services/storage';

const USER_ID = 'user-1';
const session = { access_token: 'a', refresh_token: 'r', user: { id: USER_ID } };
const profile = { id: USER_ID, account_type: 'caregiver', email: 'x@example.com' };

const never = () => new Promise<never>(() => {});

beforeEach(() => {
  jest.useFakeTimers();
  getSession.mockReset();
  onAuthStateChange.mockReset();
  signOut.mockReset();
  fromSelectMaybeSingle.mockReset();
  storedGetItem.mockReset();
  mmkv.clearAll();
  useAuth.setState({ status: 'loading', session: null, profile: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('hydrate — happy path', () => {
  it('authenticates and saves the profile for offline launches', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null });
    fromSelectMaybeSingle.mockResolvedValue({ data: profile, error: null });

    await useAuth.getState().hydrate();

    expect(useAuth.getState().status).toBe('authenticated');
    expect(JSON.parse(mmkv.getString(STORAGE_KEYS.cachedProfile)!)).toEqual(profile);
  });
});

describe('hydrate — stalled network (the reported bug)', () => {
  it('opens with the saved profile when getSession never settles', async () => {
    mmkv.set(STORAGE_KEYS.cachedProfile, JSON.stringify(profile));
    getSession.mockReturnValue(never());
    storedGetItem.mockResolvedValue(JSON.stringify(session));
    fromSelectMaybeSingle.mockReturnValue(never());

    const done = useAuth.getState().hydrate();
    await jest.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS * 2 + 10);
    await done;

    expect(useAuth.getState().status).toBe('authenticated');
    expect(useAuth.getState().profile?.id).toBe(USER_ID);
  });

  it('shows the offline screen — not the spinner — when there is no saved profile', async () => {
    getSession.mockReturnValue(never());
    storedGetItem.mockResolvedValue(JSON.stringify(session));
    fromSelectMaybeSingle.mockReturnValue(never());

    const done = useAuth.getState().hydrate();
    await jest.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS * 2 + 10);
    await done;

    expect(useAuth.getState().status).toBe('offline');
  });

  it('goes to sign-in when nothing is stored on the device', async () => {
    getSession.mockReturnValue(never());
    storedGetItem.mockResolvedValue(null);

    const done = useAuth.getState().hydrate();
    await jest.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS + 10);
    await done;

    expect(useAuth.getState().status).toBe('unauthenticated');
  });

  it('adopts a session refresh that lands after the deadline', async () => {
    let resolveLive!: (v: unknown) => void;
    getSession.mockReturnValue(new Promise((r) => (resolveLive = r)));
    storedGetItem.mockResolvedValue(JSON.stringify(session));
    fromSelectMaybeSingle.mockRejectedValueOnce(new Error('Network request failed'));

    const done = useAuth.getState().hydrate();
    await jest.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS + 10);
    await done;
    expect(useAuth.getState().status).toBe('offline');

    fromSelectMaybeSingle.mockResolvedValue({ data: profile, error: null });
    resolveLive({ data: { session }, error: null });
    await jest.advanceTimersByTimeAsync(10);

    expect(useAuth.getState().status).toBe('authenticated');
  });
});

describe('hydrate — failed request', () => {
  it('a thrown profile fetch no longer leaves the app loading', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null });
    fromSelectMaybeSingle.mockRejectedValue(new Error('Network request failed'));

    await useAuth.getState().hydrate();

    expect(useAuth.getState().status).toBe('offline');
  });

  it('Try again recovers once the network is back, without a second listener', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null });
    fromSelectMaybeSingle.mockRejectedValueOnce(new Error('Network request failed'));
    await useAuth.getState().hydrate();
    expect(useAuth.getState().status).toBe('offline');

    fromSelectMaybeSingle.mockResolvedValue({ data: profile, error: null });
    await useAuth.getState().hydrate();

    expect(useAuth.getState().status).toBe('authenticated');
    // Listener is module-scoped; a retry must never stack another one.
    expect(onAuthStateChange.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('ignores a saved profile that belongs to a different user', async () => {
    mmkv.set(STORAGE_KEYS.cachedProfile, JSON.stringify({ ...profile, id: 'someone-else' }));
    getSession.mockResolvedValue({ data: { session }, error: null });
    fromSelectMaybeSingle.mockRejectedValue(new Error('Network request failed'));

    await useAuth.getState().hydrate();

    expect(useAuth.getState().status).toBe('offline');
    expect(useAuth.getState().profile).toBeNull();
  });
});

describe('signOut', () => {
  it('clears the saved profile', async () => {
    mmkv.set(STORAGE_KEYS.cachedProfile, JSON.stringify(profile));
    signOut.mockResolvedValue({ error: null });

    await useAuth.getState().signOut();

    expect(mmkv.getString(STORAGE_KEYS.cachedProfile)).toBeUndefined();
  });
});
