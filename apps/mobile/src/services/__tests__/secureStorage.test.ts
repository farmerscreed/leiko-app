// Coverage for the chunked secure-store adapter that backs the
// Supabase auth session on device. Three jobs:
//   1) round-trip values bigger than the SecureStore item ceiling
//   2) overwrite a long value with a shorter one without leaving
//      tail chunks from the previous write
//   3) migrate a value that was previously stored in MMKV into
//      SecureStore on first read, then clear the MMKV slot

import { mmkv } from '../storage';
import {
  _resetSecureStorageMigrationForTests,
  secureSupabaseStorage,
} from '../secureStorage';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store') as {
  __reset(): void;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const KEY = 'leiko.auth.session';

beforeEach(() => {
  SecureStore.__reset();
  _resetSecureStorageMigrationForTests();
  mmkv.clearAll?.();
  jest.clearAllMocks();
});

describe('secureSupabaseStorage', () => {
  it('round-trips a value larger than the SecureStore ceiling', async () => {
    const big = 'x'.repeat(5000);
    await secureSupabaseStorage.setItem(KEY, big);
    const read = await secureSupabaseStorage.getItem(KEY);
    expect(read).toBe(big);
    // The manifest + at least three chunks should have been written.
    const setKeys = SecureStore.setItemAsync.mock.calls.map((c) => c[0]);
    expect(setKeys).toContain('leiko.auth.session.__manifest');
    expect(setKeys).toContain('leiko.auth.session.0');
    expect(setKeys).toContain('leiko.auth.session.1');
    expect(setKeys).toContain('leiko.auth.session.2');
  });

  it('round-trips a small (< 2KB) value through a single chunk', async () => {
    const small = 'hello';
    await secureSupabaseStorage.setItem(KEY, small);
    const read = await secureSupabaseStorage.getItem(KEY);
    expect(read).toBe(small);
  });

  it('does not leave orphan tail chunks when a long write is replaced by a short one', async () => {
    const long = 'y'.repeat(7000);
    await secureSupabaseStorage.setItem(KEY, long);
    const short = 'short';
    await secureSupabaseStorage.setItem(KEY, short);
    const read = await secureSupabaseStorage.getItem(KEY);
    expect(read).toBe(short);
    // chunk 1 from the previous (long) write should have been deleted
    // so the new short value's single chunk does not get concatenated
    // with stale data.
    const stale = await SecureStore.getItemAsync('leiko.auth.session.1');
    expect(stale).toBeNull();
  });

  it('migrates an existing MMKV session into SecureStore on first read', async () => {
    const session = JSON.stringify({ access_token: 'a'.repeat(3000) });
    mmkv.set(KEY, session);
    const read = await secureSupabaseStorage.getItem(KEY);
    expect(read).toBe(session);
    // MMKV slot should be cleared so future reads come from SecureStore.
    expect(mmkv.getString(KEY)).toBeUndefined();
    // And the secure manifest exists.
    const manifest = await SecureStore.getItemAsync('leiko.auth.session.__manifest');
    expect(manifest).not.toBeNull();
  });

  it('removeItem() clears every chunk + manifest + legacy single-key slot', async () => {
    await secureSupabaseStorage.setItem(KEY, 'z'.repeat(4000));
    await secureSupabaseStorage.removeItem(KEY);
    expect(await secureSupabaseStorage.getItem(KEY)).toBeNull();
    expect(await SecureStore.getItemAsync('leiko.auth.session.__manifest')).toBeNull();
    expect(await SecureStore.getItemAsync('leiko.auth.session.0')).toBeNull();
  });
});
