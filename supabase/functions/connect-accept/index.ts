// /connect-accept — ADR-0007 unified connect, accepter side.
//
// The accepter enters the code (+ their email, matched against the
// invite). We resolve DIRECTION from who actually wears a watch:
//
//   sharer wears, accepter doesn't  -> accepter follows sharer
//   accepter wears, sharer doesn't  -> sharer follows accepter
//   both wear                       -> accepter follows sharer now;
//                                      response flags canFollowBack so the
//                                      sharer can be OFFERED follow-back
//                                      (NOT auto-mutual, per ADR-0007)
//   neither wears                   -> pending: nothing to wire yet;
//                                      resolves when one pairs (handled by
//                                      the existing resolve-on-home path)
//
// "Following" = a caregiver family_members row on the WEARER's circle.
// The wearer's existing per-vital visibility controls are unchanged.
//
// Replaces accept-family-invite + resolve-care-invite. Keeps the email
// match guard. Voice + data rules: no PHI logged.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  code: string;
  email: string;
  /** Optional per-relationship label the accepter sets for the wearer. */
  caregiverRelationshipLabel?: string;
}

interface ResponseShape {
  ok: true;
  /** The circle that now has a new follower (the wearer's circle), or null
   *  when the connection is still pending (neither party wears a watch). */
  familyId: string | null;
  /** 'accepter_follows' | 'sharer_follows' | 'pending'. */
  outcome: 'accepter_follows' | 'sharer_follows' | 'pending';
  /** True when BOTH wear watches and the sharer may be offered follow-back. */
  canFollowBack: boolean;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Returns the user's active watch-circle id (self-circle with a paired
// device), or null if they don't wear a watch yet.
async function watchCircleOf(
  serviceClient: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: fams } = await serviceClient
    .from('families')
    .select('id')
    .eq('parent_user_id', userId);
  const ids = (fams ?? []).map((f) => f.id as string);
  if (ids.length === 0) return null;
  const { data: dev } = await serviceClient
    .from('devices')
    .select('family_id')
    .in('family_id', ids)
    .is('unpaired_at', null)
    .limit(1)
    .maybeSingle();
  return dev ? (dev.family_id as string) : null;
}

// Add `follower` as a caregiver of `circleId` (idempotent — skips if
// already an active member). Optional relationship label.
async function addFollower(
  serviceClient: SupabaseClient,
  circleId: string,
  followerId: string,
  label?: string,
): Promise<string | null> {
  const { data: existing } = await serviceClient
    .from('family_members')
    .select('user_id, removed_at')
    .eq('family_id', circleId)
    .eq('user_id', followerId)
    .maybeSingle();
  if (existing && existing.removed_at === null) return null; // already in
  const row: Record<string, unknown> = {
    family_id: circleId,
    user_id: followerId,
    role: 'caregiver',
    invited_by: followerId,
    joined_at: new Date().toISOString(),
    removed_at: null,
    removed_reason: null,
  };
  if (label && label.length > 0) row.caregiver_relationship_label = label;
  const up = await serviceClient
    .from('family_members')
    .upsert(row, { onConflict: 'family_id,user_id' });
  return up.error ? up.error.message : null;
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
  const accepterId = userData.user.id;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const code = (body?.code ?? '').trim();
  const email = (body?.email ?? '').trim();
  const label = (body?.caregiverRelationshipLabel ?? '').trim();
  if (!/^\d{6}$/.test(code)) return json({ error: 'invalid_code' }, 400);
  if (!email.includes('@')) return json({ error: 'invalid_email' }, 400);

  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceKey);

  // Look up the invite by code (connect uses kind 'parent_pairing'; also
  // accept legacy 'caregiver' rows during the back-compat window).
  const { data: invitation, error: lookupErr } = await serviceClient
    .from('invitations')
    .select('id, invited_by, invitee_email, family_id, expires_at, accepted_at, cancelled_at')
    .eq('pairing_code', code)
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
  const inviteeEmail = (invitation.invitee_email as string | null) ?? '';
  if (inviteeEmail.toLowerCase() !== email.toLowerCase()) {
    return json({ error: 'email_mismatch' }, 403);
  }

  const sharerId = invitation.invited_by as string;
  if (sharerId === accepterId) return json({ error: 'self_invite' }, 400);

  // Resolve direction from CURRENT watch ownership (re-derived, not trusting
  // the stored family_id — either party may have paired since creation).
  const sharerCircle = await watchCircleOf(serviceClient, sharerId);
  const accepterCircle = await watchCircleOf(serviceClient, accepterId);

  let outcome: ResponseShape['outcome'] = 'pending';
  let familyId: string | null = null;
  let canFollowBack = false;

  if (sharerCircle && !accepterCircle) {
    // Sharer wears, accepter doesn't -> accepter follows sharer.
    const err = await addFollower(serviceClient, sharerCircle, accepterId, label);
    if (err) return json({ error: 'membership_insert_failed', detail: err }, 500);
    outcome = 'accepter_follows';
    familyId = sharerCircle;
  } else if (!sharerCircle && accepterCircle) {
    // Accepter wears, sharer doesn't -> sharer follows accepter.
    const err = await addFollower(serviceClient, accepterCircle, sharerId);
    if (err) return json({ error: 'membership_insert_failed', detail: err }, 500);
    outcome = 'sharer_follows';
    familyId = accepterCircle;
  } else if (sharerCircle && accepterCircle) {
    // Both wear -> accepter follows sharer now; offer follow-back (ADR-0007:
    // ask, don't auto-mutual). The sharer's follow-back is a separate
    // explicit action (a second connect/accept or an in-app prompt).
    const err = await addFollower(serviceClient, sharerCircle, accepterId, label);
    if (err) return json({ error: 'membership_insert_failed', detail: err }, 500);
    outcome = 'accepter_follows';
    familyId = sharerCircle;
    canFollowBack = true;
  }
  // else: neither wears a watch -> pending; leave the invite OPEN so it can
  // resolve once one of them pairs (do NOT mark accepted).

  if (outcome !== 'pending') {
    const upd = await serviceClient
      .from('invitations')
      .update({
        family_id: familyId,
        accepted_at: new Date().toISOString(),
        accepted_by: accepterId,
      })
      .eq('id', invitation.id);
    if (upd.error) {
      // Soft failure — membership exists; don't 500.
    }
  }

  try {
    await serviceClient.from('audit_log').insert({
      actor_user_id: accepterId,
      family_id: familyId,
      action: 'connect.accepted',
      metadata: { invitation_id: invitation.id, outcome, can_follow_back: canFollowBack },
    });
  } catch {
    // ignore
  }

  const resp: ResponseShape = { ok: true, familyId, outcome, canFollowBack };
  return json(resp, 200);
});
