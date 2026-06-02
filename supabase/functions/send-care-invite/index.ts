// /send-care-invite — ADR-0006 caregiver-initiated PENDING invite.
//
// This is the INVERSE of /send-family-invite. There, a family_owner
// invites a caregiver to follow an EXISTING circle. Here, a caregiver
// invites a wearer who is NOT yet on Leiko: the invite is created with
// NO family_id (the wearer's circle doesn't exist yet) and kind
// 'parent_pairing'. It resolves later — when the wearer installs Leiko,
// onboards, pairs their own watch (creating their circle), and accepts —
// at which point the caregiver (invited_by) is attached as a follower.
//
// No family_owner check: the caller is the caregiver-to-be, who may not
// own any circle. We only require an authenticated user.
//
// Dual delivery (ADR-0006): returns both pairingCode and urlToken so the
// client can share a link + code. Email via Resend is best-effort.
//
// Voice + data rules (CLAUDE.md): no PHI logged; audit records only
// {invitee_email_domain, has_label, email_attempted, email_sent}.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  /** Email the inviter typed for the person they want to care for. */
  inviteeEmail: string;
  /** Friendly label for the inviter's pending list, e.g. "Mum". */
  inviteeLabel?: string;
}

interface ResponseShape {
  invitationId: string;
  pairingCode: string;
  urlToken: string;
  expiresAt: string;
  emailSent: boolean;
}

const CODE_RETRY_LIMIT = 6;
const EXPIRY_DAYS = 7;

async function sendInviteEmail(args: {
  toEmail: string;
  code: string;
  inviterDisplayName: string | null;
  inviteeLabel: string | null;
}): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !fromEmail) return false;

  const inviter = args.inviterDisplayName?.trim() || 'Someone who cares about you';
  const greeting = args.inviteeLabel ? `Hi ${args.inviteeLabel},` : 'Hi,';
  const subject = args.inviterDisplayName
    ? `${inviter} would like to keep an eye on your readings`
    : 'You have been invited to Leiko';

  const text = [
    greeting,
    '',
    `${inviter} would like to follow your readings on Leiko, so they can keep a gentle eye on how you're doing.`,
    '',
    `Your invite code: ${args.code}`,
    '',
    'Get the Leiko app, set up your watch, and enter this code when asked. It expires in 7 days.',
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
      <p><strong>${safeInviter}</strong> would like to follow your readings on Leiko, so they can keep a gentle eye on how you're doing.</p>
      <p style="margin: 32px 0; padding: 16px 24px; background: #FAF6F0; border-radius: 12px; text-align: center;">
        <span style="font-size: 14px; color: #6B6B6B; display: block;">Your invite code</span>
        <span style="font-size: 32px; letter-spacing: 4px; font-weight: 600; color: #1A1A1A;">${args.code}</span>
      </p>
      <p>Get the Leiko app, set up your watch, and enter this code when asked. It expires in 7 days.</p>
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
      body: JSON.stringify({ from: fromEmail, to: args.toEmail, subject, text, html }),
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
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
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

  // NO family_owner check — the caller is inviting someone not yet on
  // Leiko, so there's no circle to own yet. Pending invite: family_id NULL,
  // kind 'parent_pairing', invited_by = caller.
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (let attempt = 0; attempt < CODE_RETRY_LIMIT; attempt += 1) {
    const code = generateCode();
    const insertResult = await serviceClient
      .from('invitations')
      .insert({
        family_id: null,
        invited_by: userId,
        kind: 'parent_pairing',
        invitee_label: inviteeLabel,
        invitee_email: inviteeEmail,
        pairing_code: code,
        expires_at: expiresAt,
      })
      .select('id, url_token')
      .single();

    if (insertResult.error) {
      // 23505 = unique_violation against pairing_code. Retry.
      if ((insertResult.error as any).code === '23505') continue;
      return json(
        { error: 'invite_insert_failed', detail: insertResult.error.message },
        500,
      );
    }

    // Inviter display name for the email body. Best-effort.
    let inviterName: string | null = null;
    const { data: inviter } = await serviceClient
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    inviterName = (inviter?.display_name as string | undefined) ?? null;

    const emailSent = await sendInviteEmail({
      toEmail: inviteeEmail,
      code,
      inviterDisplayName: inviterName,
      inviteeLabel,
    });

    // Audit — no PHI; family_id is null for pending invites.
    try {
      await serviceClient.from('audit_log').insert({
        actor_user_id: userId,
        family_id: null,
        action: 'care_invite.created',
        metadata: {
          invitee_email_domain: inviteeEmail.split('@')[1] ?? null,
          has_label: inviteeLabel !== null,
          email_attempted: true,
          email_sent: emailSent,
        },
      });
    } catch {
      // ignore
    }

    const resp: ResponseShape = {
      invitationId: insertResult.data.id as string,
      pairingCode: code,
      urlToken: insertResult.data.url_token as string,
      expiresAt,
      emailSent,
    };
    return json(resp, 200);
  }

  return json({ error: 'code_collision_retry_exhausted' }, 503);
});
