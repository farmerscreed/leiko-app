// /request-sync — remote-refresh trigger (Leiko Studio-era addition).
//
// A family member (typically a remote caregiver) asks the watch-owner to
// sync their watch NOW. SILENT-FIRST with a human-confirmed visible fallback:
//
//   - Default (escalate=false): sends the SILENT 'sync_refresh' push. The
//     owner's phone syncs invisibly when it can (foreground, or backgrounded
//     while battery-opt-exempt). The wearer is never interrupted.
//   - Escalated (escalate=true): the silent attempt didn't surface fresh
//     data and the caregiver chose "send a reminder", so we send the VISIBLE
//     'sync_nudge' — a tappable notification Android delivers reliably even
//     in Doze. The wearer taps it to sync.
//
// (The automatic 3-hourly cron, request-stale-syncs, always uses the silent
// path — it must never nag.)
//
// This is the AUTHENTICATED, client-facing entry point. It does NOT talk
// to Expo directly — per the hard rule, send-push is the only Expo egress.
// Flow:
//   1. Authenticate the caller via their JWT.
//   2. Verify the caller is a member of the target family.
//   3. Resolve the watch-owner = active device's paired_by_user_id.
//   4. escalate ? VISIBLE 'sync_nudge' (+ requester display_name)
//               : SILENT 'sync_refresh'.
//
// Input:  { familyId: string, escalate?: boolean }
// Output: { outcome: 'requested' | 'no_owner' | 'not_a_member'
//           | 'suppressed_opt_out' | 'suppressed_quiet_hours'
//           | 'suppressed_rate_limit' | 'suppressed_no_token' | 'failed' }
//
// Per CLAUDE.md: carries no PHI. The nudge body names only the requester;
// the data payload is just { type: 'sync_refresh' }.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { withInternalHeader } from '../_shared/internal-auth.ts';

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

  // Caller identity from the JWT.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  const callerId = userData?.user?.id;
  if (userErr || !callerId) return json({ error: 'unauthorized' }, 401);

  let familyId: string | undefined;
  let escalate = false;
  try {
    const body = (await req.json()) as { familyId?: string; escalate?: boolean };
    familyId = body.familyId;
    escalate = body.escalate === true;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!familyId) return json({ error: 'missing_family_id' }, 400);

  const service = createClient(supabaseUrl, serviceKey);

  // 1. Authz — caller must belong to the family.
  const { data: membership } = await service
    .from('family_members')
    .select('user_id')
    .eq('family_id', familyId)
    .eq('user_id', callerId)
    .is('removed_at', null)
    .maybeSingle();
  if (!membership) return json({ outcome: 'not_a_member' }, 403);

  // 2. Resolve the watch-owner — the user who paired the active device.
  const { data: device } = await service
    .from('devices')
    .select('paired_by_user_id')
    .eq('family_id', familyId)
    .is('unpaired_at', null)
    .order('paired_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const ownerId = device?.paired_by_user_id as string | undefined;
  if (!ownerId) return json({ outcome: 'no_owner' }, 200);

  // 3. Build the send-push payload. Default = SILENT 'sync_refresh' (the
  //    phone syncs invisibly when it can). Only when the caller escalates —
  //    i.e. the silent attempt didn't surface fresh data and the caregiver
  //    chose to send a reminder — do we send the VISIBLE 'sync_nudge', which
  //    Android delivers reliably even in Doze. The nudge names the requester,
  //    so resolve their display name on that path only.
  let pushBody: Record<string, unknown>;
  if (escalate) {
    const { data: requester } = await service
      .from('users')
      .select('display_name')
      .eq('id', callerId)
      .maybeSingle();
    const requesterName = (requester?.display_name as string | undefined) ?? undefined;
    pushBody = { category: 'sync_nudge', userId: ownerId, requesterName };
  } else {
    pushBody = { category: 'sync_refresh', userId: ownerId };
  }

  // 4. Delegate to send-push (the single Expo egress).
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: withInternalHeader({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      }),
      body: JSON.stringify(pushBody),
    });
    const out = (await res.json()) as { outcome?: string };
    // Map send-push outcomes to this endpoint's vocabulary.
    if (out.outcome === 'sent') return json({ outcome: 'requested' }, 200);
    return json({ outcome: out.outcome ?? 'failed' }, res.ok ? 200 : 502);
  } catch {
    return json({ outcome: 'failed' }, 502);
  }
});
