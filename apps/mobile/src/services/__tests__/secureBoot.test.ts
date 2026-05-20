// Sprint 18 / SEC-1 — secureBoot module tests. Covers the four
// boot scenarios the migration plan committed to:
//   1. First-ever launch — generates a key, marks status pending
//   2. Returning launch with completed migration — uses cached key
//   3. Returning launch with pending migration — caller will re-run
//   4. Keychain unavailable — falls back to legacy (key=null)
//
// Also covers the singleflight contract: parallel acquireMmkvKey()
// calls share one keychain hit.

import {
  acquireMmkvKey,
  getCachedKey,
  getCachedStatus,
  incrementMigrationAttempts,
  markMigrationComplete,
  isEncrypted,
  _resetForTests,
  MIGRATION_ATTEMPT_LIMIT,
} from '../secureBoot';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Crypto = require('expo-crypto');

beforeEach(() => {
  SecureStore.__resetSecureStoreForTests();
  _resetForTests();
});

describe('secureBoot — acquireMmkvKey', () => {
  it('first launch: generates a 64-char hex key + status pending', async () => {
    const seeded = new Uint8Array(32);
    for (let i = 0; i < 32; i++) seeded[i] = (i * 7) & 0xff;
    Crypto.__setRandomBytesForTests(seeded);

    const result = await acquireMmkvKey();

    expect(result.key).toMatch(/^[0-9a-f]{64}$/);
    expect(result.migrationStatus).toBe('pending');
    expect(result.attempts).toBe(0);
    expect(result.legacyDeleteAfterMs).toBeNull();
    expect(getCachedKey()).toBe(result.key);
    expect(getCachedStatus()).toBe('pending');
    expect(isEncrypted()).toBe(false); // pending !== completed
  });

  it('returning launch with completed migration: reuses key, status completed', async () => {
    SecureStore.__seedSecureStoreForTests({
      'leiko.mmkv.key.v1': 'deadbeef'.repeat(8),
      'leiko.mmkv.migrationComplete.v1': 'true',
    });

    const result = await acquireMmkvKey();

    expect(result.key).toBe('deadbeef'.repeat(8));
    expect(result.migrationStatus).toBe('completed');
    expect(isEncrypted()).toBe(true);
  });

  it('returning launch with pending migration: reuses key, attempts surfaced', async () => {
    SecureStore.__seedSecureStoreForTests({
      'leiko.mmkv.key.v1': 'cafebabe'.repeat(8),
      'leiko.mmkv.migrationAttempts.v1': '2',
    });

    const result = await acquireMmkvKey();

    expect(result.key).toBe('cafebabe'.repeat(8));
    expect(result.migrationStatus).toBe('pending');
    expect(result.attempts).toBe(2);
  });

  it('keychain failure: key=null, status=failed (legacy fallback)', async () => {
    SecureStore.__setSecureStoreFailure('all');

    const result = await acquireMmkvKey();

    expect(result.key).toBeNull();
    expect(result.migrationStatus).toBe('failed');
    expect(getCachedKey()).toBeNull();
    expect(isEncrypted()).toBe(false);
  });

  it('singleflight: concurrent calls share the same promise', async () => {
    const seeded = new Uint8Array(32);
    Crypto.__setRandomBytesForTests(seeded);

    const a = acquireMmkvKey();
    const b = acquireMmkvKey();

    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(rb); // same object reference — promise was reused
  });

  it('surfaces legacyDeleteAfterMs when set', async () => {
    const future = Date.now() + 24 * 60 * 60 * 1000;
    SecureStore.__seedSecureStoreForTests({
      'leiko.mmkv.key.v1': 'a1b2c3d4'.repeat(8),
      'leiko.mmkv.migrationComplete.v1': 'true',
      'leiko.mmkv.legacyDeleteAfterMs.v1': String(future),
    });

    const result = await acquireMmkvKey();
    expect(result.legacyDeleteAfterMs).toBe(future);
  });
});

describe('secureBoot — markMigrationComplete', () => {
  it('sets the complete flag and schedules legacy-delete-after grace', async () => {
    SecureStore.__seedSecureStoreForTests({
      'leiko.mmkv.key.v1': 'a'.repeat(64),
    });
    await acquireMmkvKey();

    const before = Date.now();
    await markMigrationComplete();

    expect(
      await SecureStore.getItemAsync('leiko.mmkv.migrationComplete.v1'),
    ).toBe('true');
    const deleteAt = parseInt(
      (await SecureStore.getItemAsync('leiko.mmkv.legacyDeleteAfterMs.v1')) ?? '0',
      10,
    );
    // 7 days = 604800000 ms. Allow a generous window for test execution.
    expect(deleteAt - before).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(deleteAt - before).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 5_000);
    expect(getCachedStatus()).toBe('completed');
  });

  it('does not reschedule the grace window if already set', async () => {
    const fixed = 1_700_000_000_000;
    SecureStore.__seedSecureStoreForTests({
      'leiko.mmkv.key.v1': 'a'.repeat(64),
      'leiko.mmkv.legacyDeleteAfterMs.v1': String(fixed),
    });
    await acquireMmkvKey();
    await markMigrationComplete();

    expect(
      await SecureStore.getItemAsync('leiko.mmkv.legacyDeleteAfterMs.v1'),
    ).toBe(String(fixed));
  });
});

describe('secureBoot — incrementMigrationAttempts', () => {
  it('starts from 0 and increments on every call', async () => {
    await acquireMmkvKey(); // seeds nothing — fresh
    expect(await incrementMigrationAttempts()).toBe(1);
    expect(await incrementMigrationAttempts()).toBe(2);
    expect(await incrementMigrationAttempts()).toBe(3);
  });

  it('respects the MIGRATION_ATTEMPT_LIMIT constant', () => {
    expect(MIGRATION_ATTEMPT_LIMIT).toBe(3);
  });
});
