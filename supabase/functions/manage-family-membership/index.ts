// /manage-family-membership — Sprint 17b.
//
// Two actions on a family_members row:
//
//   action: 'remove'  — family_owner soft-deletes a caregiver's
//                       membership. Audit row + push notification
//                       to the removed user.
//   action: 'leave'   — caregiver soft-deletes their own membership.
//                       Audit row, no push (self-initiated).
//
// Why Edge Function (not pure client + RLS):
//   - audit_log INSERT requires the service_role per the "service
//     inserts audit" policy (0001_initial.sql §audit_log RLS). The
//     client `authenticated` role can read its own audit rows but
//     cannot write any. Routing through an Edge Function with the
//     service-role client keeps the audit trail intact.
//   - Single transaction-like sequence: validate auth → soft-delete
//     → audit → push. The soft-delete itself could be done client-
//     side (RLS "owner edits members" + "self-leave" allow it) but
//     batching it server-side keeps the failure modes coherent.
//
// Validation rules:
//   action='remove':
//     • caller must be the family_owner of `familyId`
//     • targetUserId must be an active member (removed_at IS NULL)
//     • targetUserId must NOT be the family_owner (block self-
//       removal by the owner; the only path to "delete the family"
//       is /delete-account)
//   action='leave':
//     • caller must be an active member of `familyId`
//     • caller must NOT be the family_owner (same rule — owners use
//       /delete-account to disband)
//
// Per CLAUDE.md data rules: no PHI in audit metadata. Push payload
// carries display names + circle labels only; the send-push function
// runs voice-lint on the rendered output.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { withInternalHeader } from '../_shared/internal-auth.ts';

type Action = 'remove' | 'leave';

interface BaseRequest {
  action: Action;
  familyId: string;
}

interface RemoveRequest extends BaseRequest {
  action: 'remove';
  targetUserId: string;
}

interface LeaveRequest extends BaseRequest {
  action: 'leave';
}

type RequestBody = RemoveRequest | LeaveRequest;

interface OkResponse {
  ok: true;
  pushed: boolean;
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

  // Resolve the calling user from their JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const callerId = userData.user.id;

  // Parse + shape-check the body.
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body || (body.action !== 'remove' && body.action !== 'leave')) {
    return json({ error: 'invalid_action' }, 400);
  }
  if (!body.familyId) {
    return json({ error: 'missing_family_id' }, 400);
  }
  if (body.action === 'remove' && !body.targetUserId) {
    return json({ error: 'missing_target_user_id' }, 400);
  }

  const service: SupabaseClient = createClient(supabaseUrl, serviceKey);

  // Load the caller's active membership for this family.
  const { data: callerMembership } = await service
    .from('family_members')
    .select('user_id, role, removed_at')
    .eq('family_id', body.familyId)
    .eq('user_id', callerId)
    .maybeSingle();
  if (!callerMembership || callerMembership.removed_at !== null) {
    return json({ error: 'caller_not_a_member' }, 403);
  }

  const nowIso = new Date().toISOString();

  if (body.action === 'leave') {
    // Owners must use /delete-account; block leaving as owner.
    if (callerMembership.role === 'family_owner') {
      return json({ error: 'owner_cannot_leave' }, 403);
    }
    const { error: updateErr } = await service
      .from('family_members')
      .update({ removed_at: nowIso, removed_reason: 'self_leave' })
      .eq('family_id', body.familyId)
      .eq('user_id', callerId);
    if (updateErr) {
      return json(
        { error: 'membership_update_failed', detail: updateErr.message },
        500,
      );
    }
    try {
      await service.from('audit_log').insert({
        actor_user_id: callerId,
        family_id: body.familyId,
        action: 'family.self_left',
        metadata: {},
      });
    } catch {
      // Audit failure non-fatal — the leave already succeeded.
    }
    const resp: OkResponse = { ok: true, pushed: false };
    return json(resp, 200);
  }

  // action === 'remove'
  if (callerMembership.role !== 'family_owner') {
    return json({ error: 'only_owner_can_remove' }, 403);
  }
  if (body.targetUserId === callerId) {
    return json({ error: 'owner_cannot_remove_self' }, 403);
  }

  // Load the target's active membership.
  const { data: targetMembership } = await service
    .from('family_members')
    .select('user_id, role, removed_at')
    .eq('family_id', body.familyId)
    .eq('user_id', body.targetUserId)
    .maybeSingle();
  if (!targetMembership || targetMembership.removed_at !== null) {
    return json({ error: 'target_not_active_member' }, 404);
  }
  // Defence in depth: refuse to remove another family_owner row even
  // though by data shape there's only one per family.
  if (targetMembership.role === 'family_owner') {
    return json({ error: 'cannot_remove_owner' }, 403);
  }

  const { error: updateErr } = await service
    .from('family_members')
    .update({ removed_at: nowIso, removed_reason: 'owner_removed' })
    .eq('family_id', body.familyId)
    .eq('user_id', body.targetUserId);
  if (updateErr) {
    return json(
      { error: 'membership_update_failed', detail: updateErr.message },
      500,
    );
  }

  try {
    await service.from('audit_log').insert({
      actor_user_id: callerId,
      family_id: body.familyId,
      action: 'family.member_removed',
      metadata: { target_user_id: body.targetUserId },
    });
  } catch {
    // Audit failure non-fatal.
  }

  // Push the removed user. Best-effort — failure is logged via the
  // send-push audit but does not roll back the removal.
  let pushed = false;
  try {
    // Resolve labels for the push body.
    const [{ data: ownerProfile }, { data: family }] = await Promise.all([
      service.from('users').select('display_name').eq('id', callerId).maybeSingle(),
      service
        .from('families')
        .select('parent_display_name')
        .eq('id', body.familyId)
        .maybeSingle(),
    ]);
    const removerName =
      (ownerProfile as { display_name?: string } | null)?.display_name ||
      'Your family owner';
    const circleLabel =
      (family as { parent_display_name?: string } | null)
        ?.parent_display_name || 'the family';

    const pushResult = await service.functions.invoke('send-push', {
      body: {
        category: 'family_removed',
        userId: body.targetUserId,
        removerName,
        circleLabel,
      },
      headers: withInternalHeader(),
    });
    pushed = !pushResult.error;
  } catch {
    pushed = false;
  }

  const resp: OkResponse = { ok: true, pushed };
  return json(resp, 200);
});
