// Typed Supabase client. Singleton — created once at module load.
//
// Storage: MMKV via supabaseStorage (see ./storage.ts). The auth-js client
// persists session JWTs through this adapter.
//
// Env vars (Expo public, baked into the bundle at build time):
//   EXPO_PUBLIC_SUPABASE_URL      — http://127.0.0.1:54321 in local Docker
//   EXPO_PUBLIC_SUPABASE_ANON_KEY — read from `supabase status` after `supabase start`
//
// `.env.local` (gitignored) holds these for dev. See `.env.example` at the
// app root for the template. EAS builds pass them through `eas.json`
// "build.*.env" later.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseStorage } from './storage';
import type { Database } from '../types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env.local. ' +
      'For local Docker, copy them from `supabase status`.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: {
    storage: supabaseStorage,
    storageKey: 'leiko.auth.session',
    autoRefreshToken: true,
    persistSession: true,
    // Mobile flow uses verifyOtp with the 6-digit code; we never receive a
    // session via URL, so disable URL parsing.
    detectSessionInUrl: false,
  },
});
