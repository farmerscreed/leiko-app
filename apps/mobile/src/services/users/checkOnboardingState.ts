// services/users/checkOnboardingState — Sprint 19 Block 8 + v7 hotfix.
//
// "Has this user finished onboarding anywhere, ever?" answered from
// SERVER state, not from a per-device MMKV flag.
//
// Pre-Block-8, the navigator decided between home and onboarding
// based on `mmkv.STORAGE_KEYS.caregiverOnboardingComplete` (or the
// self-buyer twin), which was only ever set on the device where the
// user originally completed onboarding. A returning user on a fresh
// install — or whose MMKV got wiped — would correctly authenticate
// but then get pushed back through the onboarding screens.
//
// v7 hotfix (2026-05-24) — switched from a direct family_members
// query (which empirically returned 0 in production for a user with
// an active membership row, despite the RLS being correct in theory)
// to the `get_user_onboarding_state()` SECURITY DEFINER RPC. The RPC
// bypasses RLS entirely and reads `auth.uid()` directly inside the
// function, so it can never return the wrong answer due to JWT-
// propagation timing, RLS recursion quirks, or supabase-js caching.
// It also returns the primary family_id so the caller can write
// MMKV.currentFamilyId at the same moment it flips the onboarding
// flag — pre-fix Block 8 only wrote the flag, leaving the user with
// a flag=true / familyId=null half-state.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import type { Database } from '../../types/database';

export interface OnboardingState {
  /** True iff the user has any active family_members row (any role,
   *  any family). Drives the navigator's home-vs-onboarding choice. */
  hasOnboarded: boolean;
  /** Oldest active family the user is a member of, or null. Used to
   *  seed MMKV.currentFamilyId on fresh install so the user lands in
   *  the right family on the first post-onboarding render. */
  primaryFamilyId: string | null;
}

interface OnboardingRpcRow {
  has_onboarded: boolean | null;
  primary_family_id: string | null;
}

export async function checkOnboardingState(
  _userId: string,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<OnboardingState> {
  // Calls the SECURITY DEFINER RPC. _userId is accepted for backwards
  // compat with callers + tests but the RPC actually reads auth.uid()
  // internally, so the user can only retrieve their own state — there
  // is no privilege-escalation surface here.
  const { data, error } = await (client as SupabaseClient<Database>)
    .rpc('get_user_onboarding_state' as never);
  if (error) {
    // Network / permission failure: don't change anything. The existing
    // MMKV flag (if any) stays in force; the next session hydrate
    // retries.
    return { hasOnboarded: false, primaryFamilyId: null };
  }
  const rows = (data ?? []) as OnboardingRpcRow[];
  const first = rows[0] ?? null;
  if (!first) return { hasOnboarded: false, primaryFamilyId: null };
  return {
    hasOnboarded: first.has_onboarded === true,
    primaryFamilyId: first.primary_family_id ?? null,
  };
}
