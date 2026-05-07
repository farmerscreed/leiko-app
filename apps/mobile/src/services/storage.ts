// MMKV-backed key/value layer. CLAUDE.md mandates MMKV (no localStorage /
// sessionStorage). The Supabase auth client expects a Storage adapter
// matching {getItem, setItem, removeItem}; this file exports both the raw
// MMKV instance (for the Zustand auth store's pendingAccountType cache)
// and the Supabase-shaped adapter.
//
// Test surface: mocked at __mocks__/react-native-mmkv.js so jest projects
// (pure + rn) can import this module without the native module loading.
// Tokens live here in dev only — the production build will gate access
// through the platform Keychain/Keystore (per docs/00-tech-stack.md
// §Encryption inventory). Keychain integration is a follow-up task.

import { createMMKV, type MMKV } from 'react-native-mmkv';

export const mmkv: MMKV = createMMKV({ id: 'leiko' });

export const STORAGE_KEYS = {
  pendingAccountType: 'leiko.onboarding.pendingAccountType',
  authStorePrefix: 'leiko.auth.',
  // Set true at the end of caregiver onboarding (FamilyWatch "I have the
  // watch with me"). The navigator reads this to decide whether to render
  // the onboarding stack or the home stack.
  caregiverOnboardingComplete: 'leiko.onboarding.caregiver.complete',
  // Set true at the end of self-buyer onboarding (Watch "I have it"),
  // parallel to caregiverOnboardingComplete. Sprint 4.
  selfBuyerOnboardingComplete: 'leiko.onboarding.selfBuyer.complete',
  // Family id returned by the create_family RPC. Persisted so a crash
  // mid-flow doesn't orphan the family record.
  currentFamilyId: 'leiko.family.currentId',
  // Paired Urion device for the current user/family. Sprint 5.
  // Stored as JSON: { id, mac, model, deviceId (Supabase row id), pairedAt }.
  pairedDevice: 'leiko.ble.pairedDevice',
  // Readings buffer — Sprint 6. Two arrays of LocalReading rows:
  //   pending: not yet successfully POSTed to /sync
  //   recent:  synced + persisted, capped at RECENT_READINGS_CAP for UI
  // Both serialised as JSON. Pending is the source of truth for the
  // offline-first guarantee per CLAUDE.md ("every reading is saved to
  // MMKV before any sync attempt"). Sprint 7+ replaces the recent
  // cache with WatermelonDB queries.
  pendingReadings: 'leiko.readings.pending',
  recentReadings: 'leiko.readings.recent',
  // Per-device sync cursor — Sprint 6. JSON map { [bleId]: timestampSec }
  // of the newest reading already pulled from each watch. Drives the
  // incremental readBPHistory(sinceTimestampSec=cursor) calls so we
  // backfill everything captured while the app was closed.
  // The lastSync is per-device (not per-family) because the watch is
  // the unit that buffers; pairing a different watch resets that
  // device's cursor naturally on first sync.
  lastSyncByDevice: 'leiko.sync.lastSyncByDevice',
} as const;

export const supabaseStorage = {
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    mmkv.set(key, value);
  },
  removeItem: (key: string): void => {
    mmkv.remove(key);
  },
};
