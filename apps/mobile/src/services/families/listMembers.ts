// services/families/listMembers — Sprint 10c.2 polish.
//
// Lists every member of a family circle for the Settings → Family
// Members screen. Returns role + joined date + display name.
// RLS: existing "members see members" policy permits any member to
// read every other member's row.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import type { Database, FamilyRole } from '../../types/database';

export interface FamilyMember {
  userId: string;
  displayName: string;
  role: FamilyRole;
  joinedAt: string;
}

interface MemberRow {
  user_id: string;
  role: FamilyRole;
  joined_at: string;
  users: { display_name: string } | { display_name: string }[] | null;
}

export async function listFamilyMembers(
  familyId: string,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<FamilyMember[]> {
  const { data, error } = await client
    .from('family_members')
    .select('user_id, role, joined_at, users(display_name)')
    .eq('family_id', familyId)
    .is('removed_at', null)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as MemberRow[];
  return rows.map((row) => {
    const userObj = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      userId: row.user_id,
      displayName: userObj?.display_name ?? 'Member',
      role: row.role,
      joinedAt: row.joined_at,
    };
  });
}
