// /export-data — Sprint 10b.3.
//
// Returns a CSV of the caller's family readings + multi-vital samples.
// Plus-gated: free users hit the paywall before they ever reach this
// endpoint, but we double-check entitlement here defence-in-depth.
//
// Per docs/04-screens/settings.md §Privacy + D6 US-82. The CSV mirrors
// the shape Trends renders so the user gets "what they see" not the
// raw schema. Header row is the column names; rows are CRLF-separated
// per RFC 4180.
//
// Per CLAUDE.md voice + data rules: this function does NOT log values.
// The audit_log entry records {row_count} only, never the data itself.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ResponseBody {
  csv: string;
  rowCount: number;
}

const PLUS_TIERS = new Set(['plus', 'plus_trial', 'plus_grace']);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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

  const serviceClient: SupabaseClient = createClient(supabaseUrl, serviceKey);

  // Resolve the caller's family + entitlement.
  const { data: membership } = await serviceClient
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .is('removed_at', null)
    .limit(1)
    .maybeSingle();
  if (!membership) return json({ error: 'no_family' }, 403);
  const familyId = membership.family_id as string;

  const { data: family } = await serviceClient
    .from('families')
    .select('subscription_status')
    .eq('id', familyId)
    .maybeSingle();
  if (!family || !PLUS_TIERS.has(family.subscription_status as string)) {
    return json({ error: 'plus_required' }, 402);
  }

  // BP readings ----------------------------------------------------------
  const { data: readings, error: readingsErr } = await serviceClient
    .from('readings')
    .select('measured_at, systolic, diastolic, pulse, source, quality_score')
    .eq('family_id', familyId)
    .eq('hidden', false)
    .order('measured_at', { ascending: false })
    .limit(10_000);
  if (readingsErr) {
    return json({ error: 'export_failed', detail: readingsErr.message }, 500);
  }

  const rows: string[] = [];
  rows.push(['measured_at', 'kind', 'value_a', 'value_b', 'unit', 'source', 'quality'].join(','));
  for (const r of readings ?? []) {
    rows.push(
      [
        csvEscape(r.measured_at),
        'bp',
        csvEscape(r.systolic),
        csvEscape(r.diastolic),
        'mmHg',
        csvEscape(r.source),
        csvEscape(r.quality_score),
      ].join(','),
    );
  }

  // Multi-vitals --------------------------------------------------------
  const { data: vitals, error: vitalsErr } = await serviceClient
    .from('vitals_other')
    .select('measured_at, vital_type, value_int, value_int_2, value_int_3')
    .eq('family_id', familyId)
    .eq('hidden', false)
    .order('measured_at', { ascending: false })
    .limit(20_000);
  if (vitalsErr) {
    return json({ error: 'export_failed', detail: vitalsErr.message }, 500);
  }
  for (const v of vitals ?? []) {
    rows.push(
      [
        csvEscape(v.measured_at),
        csvEscape(v.vital_type),
        csvEscape(v.value_int),
        csvEscape(v.value_int_2),
        unitForVital(String(v.vital_type)),
        '',
        '',
      ].join(','),
    );
  }

  const csv = rows.join('\r\n');
  const rowCount = rows.length - 1;

  // Audit-log — best-effort, count only.
  await serviceClient.from('audit_log').insert({
    actor_user_id: userId,
    family_id: familyId,
    action: 'data.export_completed',
    metadata: { row_count: rowCount },
  });

  const resp: ResponseBody = { csv, rowCount };
  return json(resp, 200);
});

function unitForVital(vt: string): string {
  switch (vt) {
    case 'hr':
      return 'bpm';
    case 'spo2':
      return '%';
    case 'sleep_session':
      return 'min';
    case 'steps_day':
      return 'steps';
    case 'calories_day':
      return 'kcal';
    default:
      return '';
  }
}
