// /send-family-invite — Sprint 10c.1 + Sprint 16.6 FUN-1.
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
// {invitee_email_domain, has_label, email_attempted, email_sent} —
// never the email itself.
//
// Email transport (Sprint 16.6 FUN-1): if RESEND_API_KEY +
// RESEND_FROM_EMAIL are set, we fan out an invite email via Resend's
// REST API after the invitations row is inserted. If either env var
// is missing, we skip the email and rely on the in-app code as the
// fallback (the inviter sees it on screen and can share manually).
// Email failures NEVER fail the request — the invite still exists.

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
  /** True when the Resend email send returned 2xx. False when the
   *  email path is disabled (no API key configured) or the send
   *  failed. The caller may use this to choose between "we emailed
   *  the code" and "share this code yourself" copy. */
  emailSent: boolean;
}

const CODE_RETRY_LIMIT = 6;
const EXPIRY_DAYS = 7;

/**
 * Best-effort invite email via Resend. Returns `true` on a 2xx
 * response from the Resend API; `false` for any other outcome
 * (missing env, network error, 4xx/5xx). Never throws.
 *
 * Voice rules apply to the subject + body — no fear language,
 * no "patient" / "diagnose" / promise-of-outcome phrasing.
 */
async function sendInviteEmail(args: {
  toEmail: string;
  code: string;
  inviterDisplayName: string | null;
  inviteeLabel: string | null;
}): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !fromEmail) return false;

  const inviter = args.inviterDisplayName?.trim() || 'A family member';
  const greeting = args.inviteeLabel ? `Hi ${args.inviteeLabel},` : 'Hi,';
  const subject = args.inviterDisplayName
    ? `${inviter} invited you to Leiko`
    : 'You have been invited to Leiko';

  const text = [
    greeting,
    '',
    `${inviter} uses Leiko to keep close to the people they care about, and they would like to share readings with you.`,
    '',
    `Your invite code: ${args.code}`,
    '',
    'Open the Leiko app, go to Settings → Family, and enter this code to connect. It expires in 7 days.',
    '',
    "If you weren't expecting this, you can ignore the email.",
    '',
    '— The Leiko team',
  ].join('\n');

  const safeInviter = inviter.replace(/[<>&]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;',
  );
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1A1A1A;">
      <p>${greeting}</p>
      <p><strong>${safeInviter}</strong> uses Leiko to keep close to the people they care about, and they would like to share readings with you.</p>
      <p style="margin: 32px 0; padding: 16px 24px; background: #FAF6F0; border-radius: 12px; text-align: center;">
        <span style="font-size: 14px; color: #6B6B6B; display: block;">Your invite code</span>
        <span style="font-size: 32px; letter-spacing: 4px; font-weight: 600; color: #1A1A1A;">${args.code}</span>
      </p>
      <p>Open the Leiko app, go to <strong>Settings → Family</strong>, and enter this code to connect. It expires in 7 days.</p>
      <p style="color: #6B6B6B; font-size: 14px;">If you weren't expecting this, you can ignore the email.</p>
      <p style="color: #6B6B6B; font-size: 14px;">— The Leiko team</p>
    </div>
  `.trim();

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: args.toEmail,
        subject,
        text,
        html,
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

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

    // Look up inviter display name for the email body. Best-effort —
    // a null name falls back to a generic phrasing.
    const { data: inviterRow } = await serviceClient
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    const inviterDisplayName = inviterRow?.display_name ?? null;

    const emailAttempted = Boolean(
      Deno.env.get('RESEND_API_KEY') && Deno.env.get('RESEND_FROM_EMAIL'),
    );
    const emailSent = emailAttempted
      ? await sendInviteEmail({
          toEmail: inviteeEmail,
          code,
          inviterDisplayName,
          inviteeLabel,
        })
      : false;

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
          email_attempted: emailAttempted,
          email_sent: emailSent,
        },
      });
    } catch {
      // ignore
    }

    const resp: ResponseShape = {
      invitationId: insertResult.data.id as string,
      pairingCode: code,
      expiresAt,
      emailSent,
    };
    return json(resp, 200);
  }

  return json({ error: 'code_collision_retry_exhausted' }, 503);
});
