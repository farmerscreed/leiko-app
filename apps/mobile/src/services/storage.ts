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
