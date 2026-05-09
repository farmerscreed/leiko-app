// /delete-account — Sprint 10b.3.
//
// Soft-deletes the caller's user row (sets users.deleted_at = now()).
// Per docs/01-data-model.md the actual data purge happens on a 30-day
// grace cron (Sprint 17 scope alongside the audit_log partition
// rolling). Until that cron lands, soft-deleted rows persist
// indefinitely; the auth.users row is also flipped to "soft-banned"
// by the client signing out after success.
//
// Confirmation gate: the client passes the user's email in the body.
// We compare against auth.users to ensure the user typed their own
// email — a basic sanity gate, not OTP-grade. The Settings spec calls
// for full OTP reauthentication; that hardening rides along with the
// 30-day cron in Sprint 17.
//
// Per CLAUDE.md voice + data rules: this function does NOT log the
// email. The audit_log entry records {confirmed=true} only.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  /** The user's own email, typed into a confirm field. Compared
   *  case-insensitively against auth.users.email. */
  confirmEmail: string;
}

interface ResponseBody {
  ok: true;
  deletedAt: string;
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
  const userEmail = userData.user.email ?? null;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof body?.confirmEmail !== 'string' || !body.confirmEmail.trim()) {
    return json({ error: 'missing_confirmation' }, 400);
  }
  if (
    !userEmail ||
    body.confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()
  ) {
    return json({ error: 'email_mismatch' }, 400);
  }

  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceKey);

  const deletedAt = new Date().toISOString();
  const { error: updateErr } = await serviceClient
    .from('users')
    .update({ deleted_at: deletedAt })
    .eq('id', userId)
    .is('deleted_at', null);
  if (updateErr) {
    return json({ error: 'delete_failed', detail: updateErr.message }, 500);
  }

  // Best-effort audit; never blocks a successful delete.
  try {
    await serviceClient.from('audit_log').insert({
      actor_user_id: userId,
      action: 'account.delete_requested',
      metadata: { confirmed: true, deleted_at: deletedAt },
    });
  } catch {
    // ignore
  }

  const resp: ResponseBody = { ok: true, deletedAt };
  return json(resp, 200);
});
