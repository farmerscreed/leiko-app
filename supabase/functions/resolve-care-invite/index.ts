// /resolve-care-invite — ADR-0006 caregiver-initiated PENDING invite,
// WEARER side.
//
// Counterpart to /send-care-invite. The flow:
//   1. A caregiver created a pending invite (kind 'parent_pairing',
//      family_id NULL) via /send-care-invite and shared the code/link.
//   2. The WEARER installs Leiko, onboards, and pairs their own watch —
//      which creates THEIR circle (create_family). They are the
//      family_owner of it.
//   3. The wearer enters the code here. We attach the INVITER (the
//      caregiver, from invitations.invited_by) as a 'caregiver' member of
//      the wearer's circle, and stamp family_id onto the invite.
//
// Note the inversion vs accept-family-invite: there the CALLER becomes the
// caregiver of someone else's circle. Here the CALLER is the wearer, and
// the invite's ORIGINATOR becomes the caregiver of the caller's circle.
//
// The wearer must already own a circle (have paired). If they don't, we
// return 'no_circle_yet' so the client can route them to pairing first.
//
// Voice + data rules: no PHI logged.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  code: string;
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

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
  const wearerId = userData.user.id;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const code = (body?.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) return json({ error: 'invalid_code' }, 400);

  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceKey);

  // Look up the PENDING invite by code.
  const { data: invitation, error: lookupErr } = await serviceClient
    .from('invitations')
    .select('id, invited_by, kind, family_id, expires_at, accepted_at, cancelled_at')
    .eq('pairing_code', code)
    .eq('kind', 'parent_pairing')
    .maybeSingle();

  if (lookupErr) return json({ error: 'lookup_failed', detail: lookupErr.message }, 500);
  if (!invitation) return json({ error: 'invitation_not_found' }, 404);
  if (invitation.cancelled_at) return json({ error: 'invitation_cancelled' }, 410);
  if (invitation.accepted_at) return json({ error: 'invitation_already_accepted' }, 409);
  if (
    invitation.expires_at &&
    new Date(invitation.expires_at as string).getTime() < Date.now()
  ) {
    return json({ error: 'invitation_expired' }, 410);
  }

  const inviterId = invitation.invited_by as string;
  if (inviterId === wearerId) {
    // A user can't invite themselves to follow their own circle.
    return json({ error: 'self_invite' }, 400);
  }

  // The wearer must already own a circle (they paired their watch). Pick
  // their owned self-circle — the one create_family made for them.
  const { data: ownedCircle, error: circleErr } = await serviceClient
    .from('family_members')
    .select('family_id')
    .eq('user_id', wearerId)
    .eq('role', 'family_owner')
    .is('removed_at', null)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (circleErr) return json({ error: 'lookup_failed', detail: circleErr.message }, 500);
  if (!ownedCircle) {
    // Not paired yet — the client should route to pairing, then retry.
    return json({ error: 'no_circle_yet' }, 409);
  }
  const familyId = ownedCircle.family_id as string;

  // Attach the INVITER as a caregiver of the wearer's circle (unless
  // they're already an active member).
  const { data: existing } = await serviceClient
    .from('family_members')
    .select('user_id, removed_at')
    .eq('family_id', familyId)
    .eq('user_id', inviterId)
    .maybeSingle();
  if (!(existing && existing.removed_at === null)) {
    const upsert = await serviceClient.from('family_members').upsert(
      {
        family_id: familyId,
        user_id: inviterId,
        role: 'caregiver',
        invited_by: inviterId,
        joined_at: new Date().toISOString(),
        removed_at: null,
        removed_reason: null,
      },
      { onConflict: 'family_id,user_id' },
    );
    if (upsert.error) {
      return json(
        { error: 'membership_insert_failed', detail: upsert.error.message },
        500,
      );
    }
  }

  // Resolve the invite: stamp family_id + mark accepted (accepted_by =
  // the wearer who completed it).
  const updateInvitation = await serviceClient
    .from('invitations')
    .update({
      family_id: familyId,
      accepted_at: new Date().toISOString(),
      accepted_by: wearerId,
    })
    .eq('id', invitation.id);
  if (updateInvitation.error) {
    // Soft failure — membership exists; audit it but don't 500.
  }

  try {
    await serviceClient.from('audit_log').insert({
      actor_user_id: wearerId,
      family_id: familyId,
      action: 'care_invite.resolved',
      metadata: { invitation_id: invitation.id },
    });
  } catch {
    // ignore
  }

  const resp: ResponseShape = { ok: true, familyId };
  return json(resp, 200);
});
