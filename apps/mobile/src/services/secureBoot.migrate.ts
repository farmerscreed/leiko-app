// Sprint 18 / SEC-1 — copy the legacy plain MMKV blob (id: 'leiko')
// into the new encrypted MMKV blob (id: 'leiko-enc'). Runs ONCE per
// install, gated by the `migration_complete` flag in expo-secure-store.
//
// Why a separate id rather than re-keying in place: MMKV will treat
// "id:'leiko' no key" and "id:'leiko' with key" as effectively the
// same file but won't be able to read the existing data with a new
// key. Two physical files (per recommendation 2) is clearer to reason
// about, easier to inspect on-device, and gives us a deletable rollback
// blob during the 7-day grace window.
//
// This module imports react-native-mmkv DIRECTLY — it MUST NOT import
// services/storage. The whole point is to run before storage.ts has
// loaded.

import { createMMKV, deleteMMKV } from 'react-native-mmkv';
import {
  incrementMigrationAttempts,
  markMigrationComplete,
  MIGRATION_ATTEMPT_LIMIT,
} from './secureBoot';

export const LEGACY_MMKV_ID = 'leiko';
export const ENCRYPTED_MMKV_ID = 'leiko-enc';

export interface MigrationResult {
  keysCopied: number;
  keysSkipped: number;
  durationMs: number;
  attempt: number;
}

/** Copy every typed value from legacy MMKV into the encrypted instance.
 *  Idempotent: clears the encrypted instance first so a partial copy
 *  from a previous failed run is replaced by a fresh full copy. After
 *  success, calls markMigrationComplete() so future cold-starts skip
 *  this work.
 *
 *  Throws on any failure; App.tsx catches and falls back to legacy
 *  plain MMKV for the rest of the session (failure mode 2). The next
 *  cold-start will try again until MIGRATION_ATTEMPT_LIMIT.
 *
 *  Returns null if the attempt limit has been reached — caller should
 *  give up and stay on legacy permanently. */
export async function runMmkvMigration(
  encryptionKey: string,
): Promise<MigrationResult | null> {
  const attempt = await incrementMigrationAttempts();
  if (attempt > MIGRATION_ATTEMPT_LIMIT) {
    return null;
  }

  const startedAt = Date.now();
  const legacy = createMMKV({ id: LEGACY_MMKV_ID });
  const encrypted = createMMKV({ id: ENCRYPTED_MMKV_ID, encryptionKey });

  // Idempotency: wipe the encrypted instance before re-copying so a
  // partial copy from a previous failed attempt cannot leave a stale
  // value lingering for any key that was since removed from legacy.
  encrypted.clearAll();

  const keys = legacy.getAllKeys();
  let copied = 0;
  let skipped = 0;

  for (const key of keys) {
    // Typed discovery: MMKV's typed getters return undefined for the
    // wrong type, so order doesn't matter as long as we try all three.
    // App code only writes strings today, but boolean/number coverage
    // is cheap insurance against any future direct write.
    const s = legacy.getString(key);
    if (s !== undefined) {
      encrypted.set(key, s);
      copied += 1;
      continue;
    }
    const n = legacy.getNumber(key);
    if (n !== undefined) {
      encrypted.set(key, n);
      copied += 1;
      continue;
    }
    const b = legacy.getBoolean(key);
    if (b !== undefined) {
      encrypted.set(key, b);
      copied += 1;
      continue;
    }
    // Unknown type (Uint8Array — we don't use any today). Skip rather
    // than fail the whole migration; surface in the result for ops.
    skipped += 1;
  }

  await markMigrationComplete();

  return {
    keysCopied: copied,
    keysSkipped: skipped,
    durationMs: Date.now() - startedAt,
    attempt,
  };
}

/** Delete the legacy plain MMKV blob from disk. Called by App.tsx ONLY
 *  after the 7-day grace window has elapsed AND migration is confirmed
 *  complete. Safe no-op if the blob is already gone. */
export function deleteLegacyMmkv(): void {
  deleteMMKV(LEGACY_MMKV_ID);
}
