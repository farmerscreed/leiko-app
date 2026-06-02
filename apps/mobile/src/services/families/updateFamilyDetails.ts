// services/families/updateFamilyDetails — Sprint 19 Block 3.
//
// Lets the family_owner correct a mis-typed parent display name +
// relationship from inside the app, without re-onboarding. The
// `account_type` immutability rule + the lack of an edit flow used
// to mean: "I typed Mum's name wrong" → live with it forever.
//
// RLS: `families` UPDATE is already restricted to family_owners by
// the policy in 0001_initial.sql ("owner edits families"); no
// migration needed. The Edge Function path was considered but the
// direct UPDATE keeps the contract simple and avoids an unnecessary
// secret roundtrip for what is, mechanically, a single-row update.
//
// audit_log INSERT requires service_role per the existing RLS, so
// this client-side path does NOT write an audit row. The Settings
// invite + remove flows already establish the pattern of "audit
// surfaces only where it goes through an Edge Function." A future
// sprint can add an edit-family Edge Function for parity if needed.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import { logger } from '../analytics/logger';
import type { Database } from '../../types/database';

export interface UpdateFamilyDetailsInput {
  familyId: string;
  parentDisplayName: string;
  /** Encoded relationship — same convention as create_family:
   *  'mother' | 'father' | 'aunt' | 'uncle' | 'other' | 'other:<label>'. */
  parentRelationship: string;
}

export async function updateFamilyDetails(
  input: UpdateFamilyDetailsInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<void> {
  const name = input.parentDisplayName.trim();
  const rel = input.parentRelationship.trim();
  if (!input.familyId) throw new Error('Missing familyId.');
  if (!name) throw new Error('Wearer name is required.');
  if (!rel) throw new Error('Wearer relationship is required.');

  logger.track('family_details_update_started');
  const { error } = await client
    .from('families')
    .update({
      parent_display_name: name,
      parent_relationship: rel,
    })
    .eq('id', input.familyId);
  if (error) {
    logger.track('family_details_update_failed', { reason: error.message });
    throw error;
  }
  logger.track('family_details_update_completed');
}
