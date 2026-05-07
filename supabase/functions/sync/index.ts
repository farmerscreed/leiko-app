// /sync — single-reading ingest endpoint. Sprint 6.
//
// Per docs/01-data-model.md: edge functions run with the service_role
// key and bypass RLS by design. This function:
//   1. Validates the caller's JWT (anon-key client, .auth.getUser()).
//   2. Resolves the caller's family via family_members.
//   3. Upserts the device row by mac_address.
//   4. Inserts the reading row; the (device_id, measured_at) unique
//      index makes retries idempotent — a duplicate insert returns
//      the existing reading_id with `duplicate: true`.
//
// Sprint 6 scope is single-reading. Sprint 9+ may extend to batched
// trends backfill — keep the request shape easy to evolve to an array.
//
// Per CLAUDE.md voice + data rules: this function does NOT log
// reading values. Errors include codes + non-PHI metadata only.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface DeviceMeta {
  bleId: string;
  macSuffix: string;
  name: string | null;
  model: 'U16H' | 'U19M';
}

interface ReadingPayload {
  measuredAtSec: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  source: 'watch' | 'manual';
}

interface SyncRequest {
  device: DeviceMeta;
  reading: ReadingPayload;
}

interface SyncResponse {
  readingId: string;
  deviceId: string;
  duplicate: boolean;
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

  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: membership, error: memberErr } = await serviceClient
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .is('removed_at', null)
    .limit(1)
    .maybeSingle();
  if (memberErr) return json({ error: 'member_lookup_failed', detail: memberErr.message }, 500);
  if (!membership) return json({ error: 'no_family' }, 403);
  const familyId = membership.family_id as string;

  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body?.device?.bleId || !body?.reading?.measuredAtSec) {
    return json({ error: 'missing_fields' }, 400);
  }
  if (body.reading.systolic < 30 || body.reading.systolic > 300) {
    return json({ error: 'systolic_out_of_range' }, 400);
  }
  if (body.reading.diastolic < 20 || body.reading.diastolic > 200) {
    return json({ error: 'diastolic_out_of_range' }, 400);
  }

  // Upsert device by mac_address. The active-mac index is partial on
  // unpaired_at IS NULL, so a forgotten-then-re-paired device may have
  // multiple rows — pick the most recent active one.
  const { data: existingDevice } = await serviceClient
    .from('devices')
    .select('id')
    .eq('family_id', familyId)
    .eq('mac_address', body.device.bleId)
    .is('unpaired_at', null)
    .order('paired_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let deviceId: string;
  if (existingDevice) {
    deviceId = existingDevice.id as string;
  } else {
    const insertDevice = await serviceClient
      .from('devices')
      .insert({
        family_id: familyId,
        serial_number: body.device.bleId.replace(/[^0-9a-f]/gi, ''),
        mac_address: body.device.bleId,
        model: body.device.model,
        paired_by_user_id: userId,
      })
      .select('id')
      .single();
    if (insertDevice.error) {
      return json(
        { error: 'device_insert_failed', detail: insertDevice.error.message },
        500,
      );
    }
    deviceId = insertDevice.data.id as string;
  }

  const measuredAt = new Date(body.reading.measuredAtSec * 1000).toISOString();
  const insertReading = await serviceClient
    .from('readings')
    .insert({
      family_id: familyId,
      device_id: deviceId,
      source: body.reading.source,
      measured_at: measuredAt,
      measured_at_local: measuredAt, // Sprint 7 wires the parent IANA TZ
      systolic: body.reading.systolic,
      diastolic: body.reading.diastolic,
      pulse: body.reading.pulse,
    })
    .select('id')
    .single();

  if (insertReading.error) {
    // 23505 = unique_violation (readings_dedupe). Return the existing row.
    if ((insertReading.error as any).code === '23505') {
      const dup = await serviceClient
        .from('readings')
        .select('id')
        .eq('device_id', deviceId)
        .eq('measured_at', measuredAt)
        .single();
      if (dup.error) {
        return json(
          { error: 'dedupe_lookup_failed', detail: dup.error.message },
          500,
        );
      }
      const resp: SyncResponse = {
        readingId: dup.data.id as string,
        deviceId,
        duplicate: true,
      };
      return json(resp, 200);
    }
    return json(
      { error: 'reading_insert_failed', detail: insertReading.error.message },
      500,
    );
  }

  const resp: SyncResponse = {
    readingId: insertReading.data.id as string,
    deviceId,
    duplicate: false,
  };
  return json(resp, 200);
});
