// /sync-external-vitals — Sprint 9.5 / Task 7.
//
// Receives a batch of vitals the client read from Apple HealthKit /
// Android Health Connect (Sprint 9.5 / Task 7's background-fetch path)
// and inserts them into public.external_vitals via service_role. The
// table's RLS only permits service_role inserts (see
// 0006_external_vitals.sql), so this Edge Function is the sole writer.
//
// Round-trip prevention is enforced *client-side*, not here — the
// adapter's read path strips samples whose sourceBundleId equals our
// own bundle id (LEIKO_BUNDLE_ID) before calling this endpoint. We
// still check the source_origin field server-side as a defence-in-depth
// gate; a sample with origin == 'com.leiko.app' is rejected with code
// 'leiko_origin_rejected'.
//
// Per CLAUDE.md voice + data rules: this function does NOT log values.
// Errors include codes + non-PHI metadata only.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const LEIKO_BUNDLE_ID = 'com.leiko.app';

const VITAL_TYPES = new Set(['weight', 'height', 'blood_glucose']);
const PLATFORMS = new Set(['apple_health', 'health_connect']);
const UNITS = new Set(['kg', 'lb', 'm', 'cm', 'in', 'mg/dL', 'mmol/L']);

interface ExternalVitalSample {
  vitalType: 'weight' | 'height' | 'blood_glucose';
  measuredAtSec: number;
  valueNumeric: number;
  valueUnit: string;
  sourceOrigin: string;
}

interface RequestBody {
  samples: ExternalVitalSample[];
  sourcePlatform: 'apple_health' | 'health_connect';
}

interface RejectedSample {
  index: number;
  reason: string;
}

interface ResponseShape {
  inserted: number;
  duplicates: number;
  rejected: RejectedSample[];
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validateSample(s: unknown, idx: number): RejectedSample | null {
  if (!s || typeof s !== 'object') return { index: idx, reason: 'not_object' };
  const v = s as Partial<ExternalVitalSample>;
  if (!v.vitalType || !VITAL_TYPES.has(v.vitalType)) {
    return { index: idx, reason: 'invalid_vital_type' };
  }
  if (typeof v.measuredAtSec !== 'number' || !Number.isFinite(v.measuredAtSec)) {
    return { index: idx, reason: 'invalid_measured_at' };
  }
  if (typeof v.valueNumeric !== 'number' || v.valueNumeric <= 0) {
    return { index: idx, reason: 'invalid_value' };
  }
  if (!v.valueUnit || !UNITS.has(v.valueUnit)) {
    return { index: idx, reason: 'invalid_unit' };
  }
  if (typeof v.sourceOrigin !== 'string' || v.sourceOrigin.length === 0) {
    return { index: idx, reason: 'invalid_source_origin' };
  }
  if (v.sourceOrigin === LEIKO_BUNDLE_ID) {
    return { index: idx, reason: 'leiko_origin_rejected' };
  }
  return null;
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

  // Resolve the caller's family. Same lookup as /sync — first active
  // membership wins. external_vitals.user_id stays the caller's id;
  // family_id is the caller's family scope so caregivers in hybrid
  // mode can read these rows.
  const { data: membership, error: memberErr } = await serviceClient
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .is('removed_at', null)
    .limit(1)
    .maybeSingle();
  if (memberErr) {
    return json({ error: 'member_lookup_failed', detail: memberErr.message }, 500);
  }
  if (!membership) return json({ error: 'no_family' }, 403);
  const familyId = membership.family_id as string;

  // Caregivers must not write external_vitals — D13 §12.6 + the same
  // gate the client-side syncBridge enforces. This is defence-in-depth.
  const { data: callerProfile } = await serviceClient
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .maybeSingle();
  if (callerProfile?.account_type === 'caregiver') {
    return json({ error: 'caregiver_not_allowed' }, 403);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!Array.isArray(body.samples)) {
    return json({ error: 'missing_samples' }, 400);
  }
  if (!body.sourcePlatform || !PLATFORMS.has(body.sourcePlatform)) {
    return json({ error: 'invalid_source_platform' }, 400);
  }
  // Hard cap to keep the function bounded — clients should batch within
  // this ceiling. 500 is well above a 24h-window's worth of weight /
  // glucose / height samples.
  if (body.samples.length > 500) {
    return json({ error: 'too_many_samples' }, 400);
  }

  const rejected: RejectedSample[] = [];
  const validRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < body.samples.length; i += 1) {
    const reason = validateSample(body.samples[i], i);
    if (reason) {
      rejected.push(reason);
      continue;
    }
    const s = body.samples[i];
    validRows.push({
      family_id: familyId,
      user_id: userId,
      source_platform: body.sourcePlatform,
      source_origin: s.sourceOrigin,
      vital_type: s.vitalType,
      measured_at: new Date(s.measuredAtSec * 1000).toISOString(),
      value_numeric: s.valueNumeric,
      value_unit: s.valueUnit,
    });
  }

  let inserted = 0;
  let duplicates = 0;
  if (validRows.length > 0) {
    // The dedupe unique index on (user_id, source_platform, source_origin,
    // vital_type, measured_at) makes retries safe; we use ignoreDuplicates
    // so a re-pull of the same window absorbs cleanly. The upsert returns
    // only the rows it actually inserted; we infer duplicates by diff.
    const upsert = await serviceClient
      .from('external_vitals')
      .upsert(validRows, {
        onConflict: 'user_id,source_platform,source_origin,vital_type,measured_at',
        ignoreDuplicates: true,
      })
      .select('id');
    if (upsert.error) {
      return json(
        { error: 'insert_failed', detail: upsert.error.message },
        500,
      );
    }
    inserted = upsert.data?.length ?? 0;
    duplicates = validRows.length - inserted;
  }

  const response: ResponseShape = { inserted, duplicates, rejected };
  return json(response, 200);
});
