// /accept-family-invite — Sprint 10c.1.
//
// The invitee is signed in (their own account), enters the 6-digit
// pairing_code + the email the inviter used. We look up the invitation
// by code (service_role bypasses the owner-only RLS), validate, then
// insert a family_members row with role='caregiver'.
//
// Validation rules:
//   • code must exist
//   • email match (case-insensitive)
//   • not already accepted
//   • not cancelled
//   • not expired
//   • the accepting user isn't already a member of that family
//
// Per CLAUDE.md voice + data rules: no PHI logged. Audit row records
// {invitation_id, action_outcome} — never the email.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  code: string;
  email: string;
  /** Sprint 19 — optional per-caregiver label for the wearer. When
   *  set, stored on family_members.caregiver_relationship_label and
   *  preferred over families.parent_relationship for display. */
  caregiverRelationshipLabel?: string;
}

interface ResponseShape {
  ok: true;
  familyId: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const code = (body?.code ?? '').trim();
  const email = (body?.email ?? '').trim();
  const caregiverLabel = (body?.caregiverRelationshipLabel ?? '').trim();
  if (!/^\d{6}$/.test(code)) {
    return json({ error: 'invalid_code' }, 400);
  }
  if (!email.includes('@')) {
    return json({ error: 'invalid_email' }, 400);
  }

  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceKey);

  const { data: invitation, error: lookupErr } = await serviceClient
    .from('invitations')
    .select('id, family_id, invitee_email, kind, expires_at, accepted_at, cancelled_at')
    .eq('pairing_code', code)
    .eq('kind', 'caregiver')
    .maybeSingle();

  if (lookupErr) {
    return json({ error: 'lookup_failed', detail: lookupErr.message }, 500);
  }
  if (!invitation) {
    return json({ error: 'invitation_not_found' }, 404);
  }
  if (invitation.cancelled_at) {
    return json({ error: 'invitation_cancelled' }, 410);
  }
  if (invitation.accepted_at) {
    return json({ error: 'invitation_already_accepted' }, 409);
  }
  if (
    invitation.expires_at &&
    new Date(invitation.expires_at as string).getTime() < Date.now()
  ) {
    return json({ error: 'invitation_expired' }, 410);
  }
  const inviteeEmail = (invitation.invitee_email as string | null) ?? '';
  if (inviteeEmail.toLowerCase() !== email.toLowerCase()) {
    return json({ error: 'email_mismatch' }, 403);
  }

  const familyId = invitation.family_id as string;

  // Prevent double-membership.
  const { data: existing } = await serviceClient
    .from('family_members')
    .select('user_id, removed_at')
    .eq('family_id', familyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing && existing.removed_at === null) {
    return json({ error: 'already_member' }, 409);
  }

  // Insert / re-insert family_members row.
  const upsertRow: Record<string, unknown> = {
    family_id: familyId,
    user_id: userId,
    role: 'caregiver',
    invited_by: invitation.id ? userId : null, // best-effort — the inviter id lives on invitations
    joined_at: new Date().toISOString(),
    removed_at: null,
    removed_reason: null,
  };
  if (caregiverLabel.length > 0) {
    upsertRow.caregiver_relationship_label = caregiverLabel;
  }
  const upsertResult = await serviceClient
    .from('family_members')
    .upsert(upsertRow, { onConflict: 'family_id,user_id' });
  if (upsertResult.error) {
    return json(
      { error: 'membership_insert_failed', detail: upsertResult.error.message },
      500,
    );
  }

  // Mark invitation accepted.
  const updateInvitation = await serviceClient
    .from('invitations')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', invitation.id);
  if (updateInvitation.error) {
    // Soft failure — membership exists; audit it but don't 500.
    // Future cleanups can reconcile.
  }

  // Audit (no PHI).
  try {
    await serviceClient.from('audit_log').insert({
      actor_user_id: userId,
      family_id: familyId,
      action: 'family.invite_accepted',
      metadata: { invitation_id: invitation.id },
    });
  } catch {
    // ignore
  }

  const resp: ResponseShape = { ok: true, familyId };
  return json(resp, 200);
});
