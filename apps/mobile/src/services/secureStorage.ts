// Secure-store-backed Supabase session storage. Replaces the plain
// MMKV adapter for the single 'leiko.auth.session' key only — every
// other MMKV use (pendingReadings, pairedDevice, vital buffers, etc.)
// stays where it is.
//
// Why move just the session: it's the only value on the device that
// is bearer-equivalent. A rooted phone + filesystem read of the MMKV
// .mmkv file currently yields a long-lived Supabase access + refresh
// token pair. expo-secure-store wraps the platform Keystore (Android)
// and Keychain (iOS) so the same dump only yields ciphertext.
//
// Chunking: expo-secure-store has a ~2KB-per-item ceiling on Android.
// A Supabase session JSON blob is typically 4-8KB once the JWT +
// refresh + user object are serialised. We split into 1800-byte
// chunks and write a manifest pointing at them. The manifest tells
// the reader how many chunks to glue back together; without it the
// read returns null and the user simply has to sign in again.
//
// Migration: on the first read of a given key, we check MMKV for an
// existing value. If one is found we copy it into SecureStore and
// clear it from MMKV in the same boot. The user's session survives
// the first launch after the new build; on the second launch the
// MMKV slot is already empty.

import * as SecureStore from 'expo-secure-store';
import { mmkv } from './storage';

const CHUNK_SIZE = 1800;
const MANIFEST_SUFFIX = '.__manifest';

interface Manifest {
  v: 1;
  chunks: number;
  length: number;
}

async function readChunked(key: string): Promise<string | null> {
  const manifestRaw = await SecureStore.getItemAsync(`${key}${MANIFEST_SUFFIX}`);
  if (!manifestRaw) {
    // Legacy single-key path. Lets callers that wrote a sub-2KB blob
    // directly via SecureStore round-trip without a manifest.
    return SecureStore.getItemAsync(key);
  }
  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestRaw) as Manifest;
  } catch {
    return null;
  }
  const parts: string[] = [];
  for (let i = 0; i < manifest.chunks; i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function writeChunked(key: string, value: string): Promise<void> {
  // Clear any prior chunks first so a shorter write doesn't leave
  // dangling tail chunks that a future longer write would then mis-
  // parse via a stale manifest.
  await deleteChunked(key);
  const chunkCount = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < chunkCount; i++) {
    const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.${i}`, slice);
  }
  const manifest: Manifest = { v: 1, chunks: chunkCount, length: value.length };
  await SecureStore.setItemAsync(`${key}${MANIFEST_SUFFIX}`, JSON.stringify(manifest));
}

async function deleteChunked(key: string): Promise<void> {
  const manifestRaw = await SecureStore.getItemAsync(`${key}${MANIFEST_SUFFIX}`);
  let count = 0;
  if (manifestRaw) {
    try {
      const m = JSON.parse(manifestRaw) as Manifest;
      count = m.chunks;
    } catch {
      // ignore — fall through to the bounded sweep below
    }
  }
  // Sweep a few extra in case a previous write got further along than
  // the most recent manifest claims.
  const sweep = Math.max(count, 8);
  for (let i = 0; i < sweep; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => undefined);
  }
  await SecureStore.deleteItemAsync(`${key}${MANIFEST_SUFFIX}`).catch(() => undefined);
  // Also clear any legacy single-key write.
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

const migrated = new Set<string>();

async function migrateFromMmkv(key: string): Promise<void> {
  if (migrated.has(key)) return;
  migrated.add(key);
  const legacy = mmkv.getString(key);
  if (!legacy) return;
  try {
    await writeChunked(key, legacy);
    mmkv.remove(key);
  } catch {
    // If the secure write fails (e.g. user has not yet unlocked the
    // device on a cold boot), leave the MMKV value in place so the
    // user is not silently signed out. The next read attempt retries.
    migrated.delete(key);
  }
}

/**
 * Supabase-shaped storage adapter. Async by contract — supabase-js
 * accepts both sync and async, but secure-store is async on every
 * platform so we never hand back a sync read.
 */
export const secureSupabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    await migrateFromMmkv(key);
    return readChunked(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await writeChunked(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await deleteChunked(key);
  },
};

/** Test surface — clears the per-key migration latch between runs. */
export function _resetSecureStorageMigrationForTests(): void {
  migrated.clear();
}
