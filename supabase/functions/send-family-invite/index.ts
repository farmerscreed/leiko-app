// /send-family-invite — Sprint 10c.1.
//
// Per CLAUDE.md + D8a §10.3:
//   "Family invites use email + 6-digit code, never URL tokens."
//
// Caller must be the family_owner of the family they're inviting to.
// We check this server-side via the user JWT + a family_members lookup
// (defence in depth — the invitations table's RLS already restricts
// inserts to family_owners, but the Edge Function uses service_role so
// the explicit check matters).
//
// Code generation: random 6-digit numeric, retry on collision against
// the unique index. The code is short-lived (7 days) and one-shot
// (accepted_at flips it out of the active window).
//
// Per CLAUDE.md voice + data rules: no PHI logged. Audit row records
// {invitee_email_domain, has_label} — never the email itself.
//
// Email transport: deferred. The inviter sees the code in-app and
// shares it manually (per the Settings UI in 10c.1). When SMTP / a
// provider lands at launch-prep, this Function can fan out an email
// alongside the response.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  /** Email or phone the inviter typed. Email-only for v1. */
  inviteeEmail: string;
  /** Friendly label for the inviter's family list, e.g. "Sarah". */
  inviteeLabel?: string;
}

interface ResponseShape {
  invitationId: string;
  pairingCode: string;
  expiresAt: string;
}

const CODE_RETRY_LIMIT = 6;
const EXPIRY_DAYS = 7;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateCode(): string {
  // 6-digit numeric padded with leading zeros so 000123 is valid.
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
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
  const inviteeEmail = (body?.inviteeEmail ?? '').trim();
  if (!inviteeEmail || !inviteeEmail.includes('@')) {
    return json({ error: 'invalid_email' }, 400);
  }
  const inviteeLabel = (body?.inviteeLabel ?? '').trim() || null;

  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceKey);

  // Resolve the caller's family_owner row.
  const { data: ownerRow, error: ownerErr } = await serviceClient
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .eq('role', 'family_owner')
    .is('removed_at', null)
    .limit(1)
    .maybeSingle();
  if (ownerErr) {
    return json({ error: 'lookup_failed', detail: ownerErr.message }, 500);
  }
  if (!ownerRow) {
    return json({ error: 'not_family_owner' }, 403);
  }
  const familyId = ownerRow.family_id as string;

  // Generate a non-colliding code. Collision is exceedingly unlikely
  // across the active-invitations index, but we retry to be defensive.
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (let attempt = 0; attempt < CODE_RETRY_LIMIT; attempt += 1) {
    const code = generateCode();
    const insertResult = await serviceClient
      .from('invitations')
      .insert({
        family_id: familyId,
        invited_by: userId,
        kind: 'caregiver',
        invitee_label: inviteeLabel,
        invitee_email: inviteeEmail,
        pairing_code: code,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertResult.error) {
      // 23505 = unique_violation against pairing_code. Retry.
      if ((insertResult.error as any).code === '23505') {
        continue;
      }
      return json(
        { error: 'invite_insert_failed', detail: insertResult.error.message },
        500,
      );
    }

    // Best-effort audit (no PHI).
    try {
      const domain = inviteeEmail.includes('@')
        ? inviteeEmail.split('@')[1]?.toLowerCase() ?? null
        : null;
      await serviceClient.from('audit_log').insert({
        actor_user_id: userId,
        family_id: familyId,
        action: 'family.invite_sent',
        metadata: {
          invitee_email_domain: domain,
          has_label: inviteeLabel !== null,
        },
      });
    } catch {
      // ignore
    }

    const resp: ResponseShape = {
      invitationId: insertResult.data.id as string,
      pairingCode: code,
      expiresAt,
    };
    return json(resp, 200);
  }

  return json({ error: 'code_collision_retry_exhausted' }, 503);
});
