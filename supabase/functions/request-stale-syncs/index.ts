// /request-stale-syncs — auto remote-refresh (cron trigger).
//
// Invoked every 3h by pg_cron (migration 0048). Finds families whose
// paired watch has gone stale and nudges each owner's phone with a silent
// push (send-push 'sync_refresh') so it syncs without anyone opening the
// app. The companion to the on-demand caregiver button (request-sync).
//
// Service-role only — there is no caller to authenticate. send-push
// remains the single Expo egress; this function never talks to Expo
// directly. Carries no PHI (silent payload is { type: 'sync_refresh' }).

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const service = createClient(supabaseUrl, serviceKey);

  // How stale before we nudge. Overridable per-invocation for tuning.
  let staleInterval = '6 hours';
  try {
    const body = (await req.json()) as { staleInterval?: string } | null;
    if (body?.staleInterval) staleInterval = body.staleInterval;
  } catch {
    // cron sends { mode: 'cron' } or nothing — default stands.
  }

  const { data: families, error } = await service.rpc('families_needing_refresh', {
    p_stale: staleInterval,
  });
  if (error) {
    return json({ error: 'rpc_failed', detail: error.message }, 502);
  }

  const owners = (families ?? []) as Array<{ family_id: string; owner_id: string }>;
  let requested = 0;
  for (const f of owners) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: withInternalHeader({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        }),
        body: JSON.stringify({ category: 'sync_refresh', userId: f.owner_id }),
      });
      const out = (await res.json()) as { outcome?: string };
      if (out.outcome === 'sent') requested += 1;
    } catch {
      // Best-effort per family; one failure shouldn't stop the sweep.
    }
  }

  return json({ scanned: owners.length, requested }, 200);
});
