// /request-sync — remote-refresh trigger (Leiko Studio-era addition).
//
// A family member (typically a remote caregiver) asks the watch-owner's
// phone to sync NOW, without the owner opening the app. The owner's phone
// receives a silent push (send-push 'sync_refresh') and runs a background
// BLE pull.
//
// This is the AUTHENTICATED, client-facing entry point. It does NOT talk
// to Expo directly — per the hard rule, send-push is the only Expo egress.
// Flow:
//   1. Authenticate the caller via their JWT.
//   2. Verify the caller is a member of the target family.
//   3. Resolve the watch-owner = active device's paired_by_user_id.
//   4. Delegate to send-push with { category: 'sync_refresh', userId }.
//
// Input:  { familyId: string }
// Output: { outcome: 'requested' | 'no_owner' | 'not_a_member'
//           | 'suppressed_rate_limit' | 'suppressed_no_token' | 'failed' }
//
// Per CLAUDE.md: carries no PHI. The silent push payload is just
// { type: 'sync_refresh' }.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
  try {
    ({ familyId } = (await req.json()) as { familyId?: string });
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

  // 3. Delegate to send-push (the single Expo egress) for the silent push.
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ category: 'sync_refresh', userId: ownerId }),
    });
    const out = (await res.json()) as { outcome?: string };
    // Map send-push outcomes to this endpoint's vocabulary.
    if (out.outcome === 'sent') return json({ outcome: 'requested' }, 200);
    return json({ outcome: out.outcome ?? 'failed' }, res.ok ? 200 : 502);
  } catch {
    return json({ outcome: 'failed' }, 502);
  }
});
