// Settings → Profile updater. Sprint 10b.1.
//
// Centralises the supabase users-table update so call sites (Settings
// screen, future onboarding edit flows) don't reach into postgrest
// directly. Returns the updated row so the auth store can refresh its
// `profile` snapshot without an extra fetch.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import type { Database, UserRow, UserUpdate } from '../../types/database';

export async function updateProfile(
  userId: string,
  patch: UserUpdate,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<UserRow> {
  const { data, error } = await client
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as UserRow;
}
