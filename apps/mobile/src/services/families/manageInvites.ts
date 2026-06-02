// services/families/manageInvites — Sprint 10c.1.
//
// Thin wrappers over the /send-family-invite + /accept-family-invite
// Edge Functions. Centralises auth-header passthrough (supabase-js's
// functions.invoke handles it for us) + analytics + error mapping.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../supabase';
import { logger } from '../analytics/logger';
import type { Database } from '../../types/database';

export interface SendInviteInput {
  inviteeEmail: string;
  inviteeLabel?: string;
}

export interface SendInviteResult {
  invitationId: string;
  pairingCode: string;
  /** ADR-0006 — url_token for building a shareable deep link, so a
   *  not-yet-installed recipient can be routed through install → accept.
   *  Optional for back-compat with an older edge-function deployment. */
  urlToken?: string;
  expiresAt: string;
  /** Sprint 16.6 FUN-1: true when the server emailed the code via
   *  Resend. False when the Edge Function's RESEND_API_KEY is unset
   *  or the send failed. Callers may surface different copy
   *  ("We emailed Sarah" vs "Share this code with Sarah"). */
  emailSent?: boolean;
}

export interface AcceptInviteInput {
  code: string;
  email: string;
  /** Sprint 19 Block 5 — per-caregiver label for the wearer.
   *  Optional; when set, stored on family_members and preferred over
   *  families.parent_relationship for display. Same encoding
   *  convention as families.parent_relationship: 'mother' | 'father'
   *  | 'aunt' | 'uncle' | 'daughter' | 'son' | 'niece' | 'nephew' |
   *  'other' | 'other:<label>'. */
  caregiverRelationshipLabel?: string;
}

export interface AcceptInviteResult {
  familyId: string;
}

interface FunctionError {
  message: string;
}

function mapError(error: FunctionError | null | undefined): string | null {
  if (!error) return null;
  return error.message;
}

export async function sendFamilyInvite(
  input: SendInviteInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<SendInviteResult> {
  logger.track('family_invite_send_started');
  const { data, error } = await client.functions.invoke<SendInviteResult>(
    'send-family-invite',
    { body: input },
  );
  if (error) {
    const mapped = mapError(error) ?? 'unknown';
    logger.track('family_invite_send_failed', { reason: mapped });
    throw error;
  }
  if (!data?.pairingCode) {
    throw new Error('invalid_response');
  }
  logger.track('family_invite_send_completed');
  return data;
}

export async function acceptFamilyInvite(
  input: AcceptInviteInput,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<AcceptInviteResult> {
  logger.track('family_invite_accept_started');
  const { data, error } = await client.functions.invoke<AcceptInviteResult>(
    'accept-family-invite',
    { body: input },
  );
  if (error) {
    const mapped = mapError(error) ?? 'unknown';
    logger.track('family_invite_accept_failed', { reason: mapped });
    throw error;
  }
  if (!data?.familyId) {
    throw new Error('invalid_response');
  }
  logger.track('family_invite_accept_completed', { familyId: data.familyId });
  return data;
}
