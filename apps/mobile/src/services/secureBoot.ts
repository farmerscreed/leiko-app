// Sprint 18 / SEC-1 — async keychain bootstrap that runs BEFORE
// services/storage.ts evaluates. CLAUDE.md mandates "encrypt at rest";
// MMKV's encryptionKey is the load-bearing piece. This module acquires
// (or generates) a 32-byte key from expo-secure-store, caches it in
// module scope, and exposes it via getCachedKey() to storage.ts.
//
// Contract: storage.ts must not be imported until acquireMmkvKey() has
// resolved. App.tsx enforces this by dynamic-importing the navigator
// tree (which transitively imports storage.ts) only after the boot
// awaits complete. Static imports of storage.ts before that point
// would race the key acquisition and silently fall through to the
// legacy plain instance.
//
// This module MUST NOT import services/storage (would create a load
// cycle and re-introduce the race we're trying to avoid). It also
// MUST NOT import services/analytics/logger (which imports storage).
// Telemetry of failures is emitted by App.tsx after storage is ready.

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/** Keychain item names. Prefixed to avoid colliding with anything else
 *  the app might one day stash in the OS keychain. */
const KC_KEY = 'leiko.mmkv.key.v1';
const KC_MIGRATION_COMPLETE = 'leiko.mmkv.migrationComplete.v1';
const KC_MIGRATION_ATTEMPTS = 'leiko.mmkv.migrationAttempts.v1';
const KC_LEGACY_DELETE_AFTER = 'leiko.mmkv.legacyDeleteAfterMs.v1';

/** Per recommendation (5): default accessibility = WHEN_UNLOCKED.
 *  Survives reboot; readable only when device is unlocked. Stronger
 *  than AFTER_FIRST_UNLOCK (which would let pre-unlock background tasks
 *  read PHI); weaker than WHEN_PASSCODE_SET_THIS_DEVICE_ONLY (which
 *  would lose the key on passcode reset and erase user history). */
const KEYCHAIN_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

/** ~7-day grace before the legacy plain MMKV blob is deleted. Per
 *  recommendation (1): keeps a rollback path if a bug surfaces in the
 *  encrypted path after launch. App.tsx schedules the delete once this
 *  timestamp is in the past. */
const LEGACY_DELETE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Cap on consecutive migration failures before we give up on this
 *  install and stay on legacy plain MMKV. Each cold-start re-attempts
 *  until this is hit, then logs and stops. User keeps data; encryption
 *  at rest is degraded for this install only. */
export const MIGRATION_ATTEMPT_LIMIT = 3;

export type MigrationStatus = 'completed' | 'pending' | 'failed';

interface BootResult {
  /** Hex-encoded 32-byte key. null only when keychain access failed
   *  entirely (rare); in that case storage falls back to legacy plain. */
  key: string | null;
  migrationStatus: MigrationStatus;
  /** How many times migration has been attempted across cold starts.
   *  Caller uses MIGRATION_ATTEMPT_LIMIT to decide whether to retry. */
  attempts: number;
  /** Wall-clock ms after which the legacy plain MMKV blob should be
   *  deleted. null = grace not yet started (migration just completed
   *  this session, schedule it now). */
  legacyDeleteAfterMs: number | null;
}

let cachedKey: string | null = null;
let cachedStatus: MigrationStatus | 'unknown' = 'unknown';
let acquirePromise: Promise<BootResult> | null = null;

/** Reset the module-scoped cache. Test surface only — production never
 *  calls this. The cache survives the lifetime of the JS bundle, which
 *  is by design (one keychain hit per cold start). */
export function _resetForTests(): void {
  cachedKey = null;
  cachedStatus = 'unknown';
  acquirePromise = null;
}

/** Read by storage.ts at module load. Returns null pre-acquire OR if
 *  the keychain step failed; in either case storage falls through to
 *  the legacy plain MMKV instance. */
export function getCachedKey(): string | null {
  return cachedKey;
}

export function getCachedStatus(): MigrationStatus | 'unknown' {
  return cachedStatus;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function generateKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return bytesToHex(bytes);
}

/** Idempotent. Safe to call multiple times during boot — returns the
 *  same in-flight promise on concurrent calls. */
export function acquireMmkvKey(): Promise<BootResult> {
  if (acquirePromise) return acquirePromise;
  acquirePromise = (async (): Promise<BootResult> => {
    try {
      let key = await SecureStore.getItemAsync(KC_KEY, KEYCHAIN_OPTS);
      if (!key) {
        key = await generateKey();
        await SecureStore.setItemAsync(KC_KEY, key, KEYCHAIN_OPTS);
      }
      cachedKey = key;

      const completeFlag = await SecureStore.getItemAsync(
        KC_MIGRATION_COMPLETE,
        KEYCHAIN_OPTS,
      );
      const status: MigrationStatus =
        completeFlag === 'true' ? 'completed' : 'pending';
      cachedStatus = status;

      const attemptsStr = await SecureStore.getItemAsync(
        KC_MIGRATION_ATTEMPTS,
        KEYCHAIN_OPTS,
      );
      const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

      const deleteAfterStr = await SecureStore.getItemAsync(
        KC_LEGACY_DELETE_AFTER,
        KEYCHAIN_OPTS,
      );
      const legacyDeleteAfterMs = deleteAfterStr
        ? parseInt(deleteAfterStr, 10)
        : null;

      return { key, migrationStatus: status, attempts, legacyDeleteAfterMs };
    } catch {
      // Keychain unavailable — rare. App stays on legacy plain MMKV
      // this session. Encryption at rest is degraded; data + UX intact.
      cachedKey = null;
      cachedStatus = 'failed';
      return {
        key: null,
        migrationStatus: 'failed',
        attempts: 0,
        legacyDeleteAfterMs: null,
      };
    }
  })();
  return acquirePromise;
}

export async function incrementMigrationAttempts(): Promise<number> {
  try {
    const current = await SecureStore.getItemAsync(
      KC_MIGRATION_ATTEMPTS,
      KEYCHAIN_OPTS,
    );
    const next = (current ? parseInt(current, 10) : 0) + 1;
    await SecureStore.setItemAsync(
      KC_MIGRATION_ATTEMPTS,
      String(next),
      KEYCHAIN_OPTS,
    );
    return next;
  } catch {
    return 0;
  }
}

export async function markMigrationComplete(): Promise<void> {
  await SecureStore.setItemAsync(KC_MIGRATION_COMPLETE, 'true', KEYCHAIN_OPTS);
  cachedStatus = 'completed';
  // Schedule the legacy-delete grace if not already scheduled. Per
  // recommendation (1): one-week buffer keeps a hotfix rollback path.
  const existing = await SecureStore.getItemAsync(
    KC_LEGACY_DELETE_AFTER,
    KEYCHAIN_OPTS,
  );
  if (!existing) {
    await SecureStore.setItemAsync(
      KC_LEGACY_DELETE_AFTER,
      String(Date.now() + LEGACY_DELETE_GRACE_MS),
      KEYCHAIN_OPTS,
    );
  }
  // Successful completion — reset the attempts counter so a later
  // re-migration (e.g. key rotation, not in scope today) starts clean.
  try {
    await SecureStore.deleteItemAsync(KC_MIGRATION_ATTEMPTS, KEYCHAIN_OPTS);
  } catch {
    /* attempts cleanup is best-effort */
  }
}

/** True when the cached store IS the encrypted one. Telemetry surface
 *  per recommendation (3). storage.ts re-exports this so callers don't
 *  need to know about secureBoot. */
export function isEncrypted(): boolean {
  return cachedKey !== null && cachedStatus === 'completed';
}
