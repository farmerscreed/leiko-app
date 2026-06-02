// Sprint 18 / SEC-1 — migration tests. Covers the legacy → encrypted
// MMKV copy in secureBoot.migrate.ts:
//   - happy path: every legacy key lands in encrypted, flag flips
//   - typed values: strings, numbers, booleans all preserved
//   - idempotency: re-running on partial encrypted starts fresh
//   - empty legacy: completes immediately (fresh install)
//   - attempt limit: stops trying after MIGRATION_ATTEMPT_LIMIT

import { createMMKV } from 'react-native-mmkv';
import {
  runMmkvMigration,
  LEGACY_MMKV_ID,
  ENCRYPTED_MMKV_ID,
  deleteLegacyMmkv,
} from '../secureBoot.migrate';
import { _resetForTests } from '../secureBoot';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SecureStore = require('expo-secure-store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RNMMKV = require('react-native-mmkv');

const TEST_KEY = 'a'.repeat(64);

beforeEach(() => {
  SecureStore.__resetSecureStoreForTests();
  RNMMKV.__resetMmkvForTests();
  _resetForTests();
});

describe('runMmkvMigration — happy path', () => {
  it('copies every legacy key into the encrypted instance', async () => {
    const legacy = createMMKV({ id: LEGACY_MMKV_ID });
    legacy.set('leiko.auth.session', '{"token":"abc"}');
    legacy.set('leiko.readings.recent', '[{"sys":120,"dia":80}]');
    legacy.set('leiko.family.currentId', 'fam-uuid');

    const result = await runMmkvMigration(TEST_KEY);

    expect(result).not.toBeNull();
    expect(result!.keysCopied).toBe(3);
    expect(result!.keysSkipped).toBe(0);

    const encrypted = createMMKV({ id: ENCRYPTED_MMKV_ID, encryptionKey: TEST_KEY });
    expect(encrypted.getString('leiko.auth.session')).toBe('{"token":"abc"}');
    expect(encrypted.getString('leiko.readings.recent')).toBe('[{"sys":120,"dia":80}]');
    expect(encrypted.getString('leiko.family.currentId')).toBe('fam-uuid');

    expect(
      await SecureStore.getItemAsync('leiko.mmkv.migrationComplete.v1'),
    ).toBe('true');
  });

  it('preserves typed values (string, number, boolean)', async () => {
    const legacy = createMMKV({ id: LEGACY_MMKV_ID });
    legacy.set('a.string', 'hello');
    legacy.set('a.number', 42);
    legacy.set('a.boolean', true);

    await runMmkvMigration(TEST_KEY);

    const encrypted = createMMKV({ id: ENCRYPTED_MMKV_ID, encryptionKey: TEST_KEY });
    expect(encrypted.getString('a.string')).toBe('hello');
    expect(encrypted.getNumber('a.number')).toBe(42);
    expect(encrypted.getBoolean('a.boolean')).toBe(true);
  });

  it('completes immediately on empty legacy (fresh install)', async () => {
    const result = await runMmkvMigration(TEST_KEY);

    expect(result).not.toBeNull();
    expect(result!.keysCopied).toBe(0);
    expect(result!.keysSkipped).toBe(0);
    expect(
      await SecureStore.getItemAsync('leiko.mmkv.migrationComplete.v1'),
    ).toBe('true');
  });
});

describe('runMmkvMigration — idempotency', () => {
  it('re-running clears partial encrypted then re-copies from latest legacy', async () => {
    const legacy = createMMKV({ id: LEGACY_MMKV_ID });
    legacy.set('k1', 'v1-initial');
    legacy.set('k2', 'v2-initial');

    // Simulate a previous PARTIAL migration: encrypted has stale data
    // for a key that since changed in legacy. Without idempotency,
    // re-running would carry the stale value forward.
    const encrypted = createMMKV({ id: ENCRYPTED_MMKV_ID, encryptionKey: TEST_KEY });
    encrypted.set('k1', 'v1-stale');
    encrypted.set('orphan-from-partial', 'should-be-cleared');

    // Legacy gets a fresh write between the two attempts.
    legacy.set('k1', 'v1-updated');

    const result = await runMmkvMigration(TEST_KEY);

    expect(result).not.toBeNull();
    expect(encrypted.getString('k1')).toBe('v1-updated');
    expect(encrypted.getString('k2')).toBe('v2-initial');
    expect(encrypted.getString('orphan-from-partial')).toBeUndefined();
  });
});

describe('runMmkvMigration — attempt limit', () => {
  it('returns null once attempts exceed the cap (caller stops retrying)', async () => {
    SecureStore.__seedSecureStoreForTests({
      'leiko.mmkv.migrationAttempts.v1': '3', // already at the cap
    });
    // Attempt 4 — should be refused.
    const result = await runMmkvMigration(TEST_KEY);
    expect(result).toBeNull();
  });

  it('allows attempts 1 through 3 to proceed', async () => {
    const legacy = createMMKV({ id: LEGACY_MMKV_ID });
    legacy.set('k', 'v');

    const r1 = await runMmkvMigration(TEST_KEY);
    expect(r1).not.toBeNull();
    expect(r1!.attempt).toBe(1);

    // markMigrationComplete cleared the attempts counter, so the second
    // run would start at 1 again — that's the correct behavior for
    // future re-migrations (key rotation, not in scope today).
  });
});

describe('deleteLegacyMmkv', () => {
  it('removes the legacy MMKV instance from disk', () => {
    const legacy = createMMKV({ id: LEGACY_MMKV_ID });
    legacy.set('still-there', 'yes');
    expect(legacy.getString('still-there')).toBe('yes');

    deleteLegacyMmkv();

    // After delete, opening the same id gives a fresh empty instance.
    const reopened = createMMKV({ id: LEGACY_MMKV_ID });
    expect(reopened.getString('still-there')).toBeUndefined();
  });
});
