// services/families/visibility — Sprint 10c.2.
//
// Per D13 §13.2 — hybrid-mode caregiver visibility. The wearer
// (parent_owner / self_buyer) opts each caregiver in or out of the
// non-BP vitals. BP is always visible — the read helper enforces that
// regardless of what the JSONB column says.
//
// Defaults (when family_members.vital_visibility IS NULL):
//   BP        — always visible
//   HR        — visible
//   SpO2      — visible
//   Sleep     — HIDDEN (intimate; opt-in to share)
//   Activity  — visible

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import type { Database, VitalVisibility } from '../../types/database';

export const DEFAULT_VISIBILITY: VitalVisibility = {
  bp: true,
  hr: true,
  spo2: true,
  sleep: false, // D13 §13.2 — hidden by default
  activity: true,
};

/**
 * Returns the effective visibility for a caregiver. When the column is
 * null, the D13 defaults apply. BP is always coerced to true regardless
 * of the stored value (defence in depth — the wearer can't accidentally
 * hide BP by editing the JSONB directly).
 */
export function getEffectiveVisibility(
  stored: VitalVisibility | null | undefined,
): VitalVisibility {
  if (!stored) return { ...DEFAULT_VISIBILITY };
  return {
    bp: true,
    hr: typeof stored.hr === 'boolean' ? stored.hr : DEFAULT_VISIBILITY.hr,
    spo2: typeof stored.spo2 === 'boolean' ? stored.spo2 : DEFAULT_VISIBILITY.spo2,
    sleep: typeof stored.sleep === 'boolean' ? stored.sleep : DEFAULT_VISIBILITY.sleep,
    activity:
      typeof stored.activity === 'boolean' ? stored.activity : DEFAULT_VISIBILITY.activity,
  };
}

export interface CaregiverWithVisibility {
  userId: string;
  displayName: string;
  joinedAt: string;
  visibility: VitalVisibility;
}

interface CaregiverRow {
  user_id: string;
  joined_at: string;
  vital_visibility: VitalVisibility | null;
  users: { display_name: string } | { display_name: string }[] | null;
}

export async function listCaregivers(
  familyId: string,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<CaregiverWithVisibility[]> {
  // Same PGRST201 disambiguation as listMembers.ts (Sprint 17a fix):
  // family_members has two FKs to users (`user_id` + `invited_by`),
  // so the bare `users(...)` embed throws and the screen stays stuck
  // on "Loading…". Pin the relationship explicitly to the
  // membership-holder.
  const { data, error } = await client
    .from('family_members')
    .select(
      'user_id, joined_at, vital_visibility, users!family_members_user_id_fkey(display_name)',
    )
    .eq('family_id', familyId)
    .eq('role', 'caregiver')
    .is('removed_at', null)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as CaregiverRow[];
  return rows.map((row) => {
    const userObj = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      userId: row.user_id,
      displayName: userObj?.display_name ?? 'Caregiver',
      joinedAt: row.joined_at,
      visibility: getEffectiveVisibility(row.vital_visibility),
    };
  });
}

export async function setCaregiverVisibility(
  familyId: string,
  caregiverUserId: string,
  visibility: VitalVisibility,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<void> {
  // Always coerce BP to true — the column accepts any boolean but the
  // spec requires BP visible (D13 §13.2).
  const safe: VitalVisibility = { ...visibility, bp: true };
  const { error } = await client
    .from('family_members')
    .update({ vital_visibility: safe })
    .eq('family_id', familyId)
    .eq('user_id', caregiverUserId);
  if (error) throw error;
}
