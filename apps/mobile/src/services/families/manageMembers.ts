// services/families/manageMembers — Sprint 17b.
//
// Thin client wrapper over the `manage-family-membership` Edge
// Function. Two flows:
//   - `removeMember`: family_owner soft-deletes a caregiver's
//     membership. Server-side: validates owner role, refuses
//     self-removal, soft-deletes, writes audit_log, fires a push.
//   - `leaveFamily`: caregiver soft-deletes their own membership.
//     Server-side: refuses if the caller is the family_owner.
//
// Why an Edge Function (not pure-client RLS):
//   - `audit_log` INSERT requires the service_role (RLS "service
//     inserts audit"). The client `authenticated` role can read its
//     own audit rows but not write them.
//   - Validation rules ("owner can't remove themselves", "owner
//     can't leave their own family") are server-authoritative.
//
// Error mapping: callers receive the raw error from supabase-js
// `functions.invoke`. The UI consumer is responsible for the calm
// retry copy.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import { logger } from '../analytics/logger';
import type { Database } from '../../types/database';

const FUNCTION_NAME = 'manage-family-membership';

export interface RemoveMemberInput {
  familyId: string;
  targetUserId: string;
}

export interface LeaveFamilyInput {
  familyId: string;
}

interface ManageMembershipResponse {
  ok: true;
  pushed: boolean;
}

export async function removeMember(
  input: RemoveMemberInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<{ pushed: boolean }> {
  const { data, error } = await client.functions.invoke<ManageMembershipResponse>(
    FUNCTION_NAME,
    {
      body: {
        action: 'remove',
        familyId: input.familyId,
        targetUserId: input.targetUserId,
      },
    },
  );
  if (error) {
    logger.track('family_member_remove_failed', {
      reason: error.message ?? 'unknown',
    });
    throw error;
  }
  logger.track('family_member_removed');
  if (data && !data.pushed) {
    logger.track('family_removal_push_failed', { reason: 'send_push_returned_error' });
  }
  return { pushed: data?.pushed ?? false };
}

export async function leaveFamily(
  input: LeaveFamilyInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<void> {
  const { error } = await client.functions.invoke<ManageMembershipResponse>(
    FUNCTION_NAME,
    {
      body: {
        action: 'leave',
        familyId: input.familyId,
      },
    },
  );
  if (error) {
    logger.track('family_self_leave_failed', {
      reason: error.message ?? 'unknown',
    });
    throw error;
  }
  logger.track('family_self_left');
}
