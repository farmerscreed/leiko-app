// services/users/checkOnboardingState — Sprint 19 Block 8.
//
// "Has this user finished onboarding anywhere, ever?" answered from
// SERVER state, not from a per-device MMKV flag.
//
// Pre-Block-8, the navigator decided between home and onboarding
// based on `mmkv.STORAGE_KEYS.caregiverOnboardingComplete` (or the
// self-buyer twin), which was only ever set on the device where the
// user originally completed onboarding. A returning user on a fresh
// install — or whose MMKV got wiped — would correctly authenticate
// but then get pushed back through the onboarding screens because
// the local flag was false. They'd be asked to set up "their parent"
// all over again even though their account, family, and watch pairing
// already existed on the server.
//
// The canonical signal is: does the user have at least one active
// `family_members` row? That's set by `create_family` RPC (caregiver
// + self-buyer) AND by `accept-family-invite` Edge Function (invited
// caregiver). It's a single, stable, server-side fact that covers
// every onboarding-completion path.
//
// This DOES NOT cover the bail-mid-onboarding edge case (display_name
// set on `users` but no family yet). Those users correctly start over —
// they never finished creating their family, so there's nothing to
// resume.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import type { Database } from '../../types/database';

export interface OnboardingState {
  /** True iff the user has any active family_members row (any role,
   *  any family). Drives the navigator's home-vs-onboarding choice. */
  hasOnboarded: boolean;
}

export async function checkOnboardingState(
  userId: string,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<OnboardingState> {
  // `head: true` returns no rows, just the count header — cheap.
  // RLS lets the user read their own family_members rows.
  const { count, error } = await client
    .from('family_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('removed_at', null);
  if (error) {
    // Network / permission failure: don't change anything. The
    // existing MMKV flag (if any) stays in force; the next session
    // hydrate retries.
    return { hasOnboarded: false };
  }
  return { hasOnboarded: (count ?? 0) > 0 };
}
