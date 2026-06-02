// services/families/addAnotherFamily — Sprint 19.
//
// Caregiver-side "Care for another person" flow. Calls the existing
// `create_family` RPC for a fresh family — the caller becomes
// family_owner of the new family alongside their existing memberships.
//
// The RPC (supabase/migrations/0004_create_family_self_buyer.sql)
// already supports repeated invocations:
//   - SECURITY DEFINER + auth.uid() → identifies the caller
//   - Accepts caregiver + self_buyer account_types
//   - Creates a `families` row + a `family_members` row with role
//     'family_owner' in one transaction
// No migration is needed for this work.
//
// Unlike `completeWithWatchInHand` in state/onboarding.ts, this path:
//   - does NOT touch public.users (the caregiver's profile is already
//     correct from their first onboarding)
//   - does NOT flip caregiverOnboardingComplete (already true)
//   - does NOT consume the onboarding draft (input is passed in
//     directly from the screen)

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import { logger } from '../analytics/logger';
import type { Database } from '../../types/database';

export interface AddAnotherFamilyInput {
  /** Display name for the wearer. Required; trimmed before sending. */
  parentDisplayName: string;
  /** Encoded relationship — same convention as onboarding:
   *  'mother' | 'father' | 'aunt' | 'uncle' | 'other' | 'other:<label>'.
   *  Required. */
  parentRelationship: string;
  /** Caller's relationship to the new wearer — 'daughter' | 'son' |
   *  'niece' | 'nephew' | 'other'. The RPC stores this in the audit
   *  metadata; not surfaced on the families row itself. */
  caregiverRelationship: string;
}

export interface AddAnotherFamilyResult {
  /** UUID of the newly-created family. The caller is family_owner. */
  familyId: string;
}

export async function addAnotherFamily(
  input: AddAnotherFamilyInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<AddAnotherFamilyResult> {
  const name = input.parentDisplayName.trim();
  const rel = input.parentRelationship.trim();
  const cgRel = input.caregiverRelationship.trim();
  if (!name) throw new Error('Wearer name is required.');
  if (!rel) throw new Error('Wearer relationship is required.');
  if (!cgRel) throw new Error('Your relationship to them is required.');

  logger.track('family_add_another_started');
  const { data, error } = await client.rpc('create_family', {
    _parent_display_name: name,
    _parent_relationship: rel,
    _caregiver_relationship: cgRel,
  });
  if (error) {
    logger.track('family_add_another_failed', { reason: error.message });
    throw error;
  }
  const familyId = Array.isArray(data) ? data[0]?.family_id : null;
  if (!familyId) {
    logger.track('family_add_another_failed', { reason: 'no_family_id' });
    throw new Error('Setup finished but the new circle could not be found.');
  }
  logger.track('family_add_another_completed');
  return { familyId };
}
