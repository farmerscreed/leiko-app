// /sync — multi-vitals ingest endpoint. Sprint 7.5 expansion of Sprint 6.
//
// Per docs/01-data-model.md: edge functions run with the service_role
// key and bypass RLS by design. This function:
//   1. Validates the caller's JWT (anon-key client, .auth.getUser()).
//   2. Resolves the caller's family via family_members.
//   3. Upserts the device row by mac_address.
//   4. Dispatches on payload shape:
//      • Legacy `{ device, reading }` → single-BP path (Sprint 6, intact)
//      • New MultiVitalsPayload → multi-vitals path (Sprint 7.5)
//
// The legacy shape stays alive so existing mobile callers
// (services/sync/postReading.ts) keep working without coordinated
// rollout. Sprint 7.5 client code (the orchestrator's batch sync) sends
// the new shape.
//
// Per CLAUDE.md voice + data rules: this function does NOT log
// reading values. Errors include codes + non-PHI metadata only.
// Rejected vital samples per D13 §4.4 are silently dropped, written to
// audit_log with `action='sync.invalid_sample'`, and surfaced via the
// response summary so PostHog `multi_vital_invalid_sample` can fire
// client-side.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  isLegacyPayload,
  type DeviceMeta,
  type LegacyReadingPayload,
  type MultiVitalsPayload,
} from '../_shared/vital-types.ts';
import {
  validateBPReadings,
  validateHRSamples,
  validateSpO2Samples,
  validateSleepSessions,
  validateActivityDays,
  validateCaloriesDays,
  type RejectedSample,
} from '../_shared/vital-validators.ts';
import {
  mapBPReadings,
  mapHRSamples,
  mapSpO2Samples,
  mapSleepSessions,
  mapActivityDays,
  mapCaloriesDays,
  type VitalsOtherRow,
} from '../_shared/vital-row-mappers.ts';

interface LegacyResponse {
  readingId: string;
  deviceId: string;
  duplicate: boolean;
}

interface MultiVitalsCounts {
  bp: number;
  hr: number;
  spo2: number;
  sleep: number;
  steps: number;
  calories: number;
}

interface MultiVitalsResponse {
  deviceId: string;
  inserted: MultiVitalsCounts;
  rejected: MultiVitalsCounts;
  duplicates: MultiVitalsCounts;
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return json({ error: 'invalid_json' }, 400);
  }

  const device = (body as { device?: DeviceMeta }).device;
  if (!device?.bleId) {
    return json({ error: 'missing_fields' }, 400);
  }

  // Device upsert is the same across both paths — do it once before
  // dispatching. Sprint-6 logic preserved exactly.
  const deviceIdResult = await ensureDeviceRow(serviceClient, familyId, userId, device);
  if ('error' in deviceIdResult) {
    return json({ error: deviceIdResult.error, detail: deviceIdResult.detail }, 500);
  }
  const deviceId = deviceIdResult.deviceId;

  if (isLegacyPayload(body)) {
    return handleLegacy(serviceClient, familyId, deviceId, body as LegacyReadingPayload);
  }
  return handleMultiVitals(
    serviceClient,
    userId,
    familyId,
    deviceId,
    body as MultiVitalsPayload,
  );
});

// ────────────────────────────────────────────────────────────────────
// Device upsert — shared by both paths.

type DeviceUpsertResult = { deviceId: string } | { error: string; detail: string };

async function ensureDeviceRow(
  serviceClient: SupabaseClient,
  familyId: string,
  userId: string,
  device: DeviceMeta,
): Promise<DeviceUpsertResult> {
  // Upsert device by mac_address. The active-mac index is partial on
  // unpaired_at IS NULL, so a forgotten-then-re-paired device may have
  // multiple rows — pick the most recent active one.
  const { data: existingDevice } = await serviceClient
    .from('devices')
    .select('id')
    .eq('family_id', familyId)
    .eq('mac_address', device.bleId)
    .is('unpaired_at', null)
    .order('paired_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDevice) {
    return { deviceId: existingDevice.id as string };
  }
  const insertDevice = await serviceClient
    .from('devices')
    .insert({
      family_id: familyId,
      serial_number: device.bleId.replace(/[^0-9a-f]/gi, ''),
      mac_address: device.bleId,
      model: device.model,
      paired_by_user_id: userId,
    })
    .select('id')
    .single();
  if (insertDevice.error) {
    return { error: 'device_insert_failed', detail: insertDevice.error.message };
  }
  return { deviceId: insertDevice.data.id as string };
}

// ────────────────────────────────────────────────────────────────────
// Legacy single-BP path — Sprint 6, behaviour preserved exactly.

async function handleLegacy(
  serviceClient: SupabaseClient,
  familyId: string,
  deviceId: string,
  body: LegacyReadingPayload,
): Promise<Response> {
  const { reading } = body;
  if (!reading?.measuredAtSec) {
    return json({ error: 'missing_fields' }, 400);
  }
  // Validate via the shared validators so the legacy gate matches the
  // multi-vitals gate — D13 §4.4 cannot drift between the two paths.
  const { accepted, rejected } = validateBPReadings([reading]);
  if (rejected.length > 0) {
    return json({ error: rejected[0].reason }, 400);
  }
  const r = accepted[0];
  const measuredAt = new Date(r.measuredAtSec * 1000).toISOString();
  const insertReading = await serviceClient
    .from('readings')
    .insert({
      family_id: familyId,
      device_id: deviceId,
      source: r.source,
      measured_at: measuredAt,
      measured_at_local: measuredAt, // Sprint 7 wires the parent IANA TZ
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
    })
    .select('id')
    .single();

  if (insertReading.error) {
    // 23505 = unique_violation (readings_dedupe). Return existing row.
    if ((insertReading.error as any).code === '23505') {
      const dup = await serviceClient
        .from('readings')
        .select('id')
        .eq('device_id', deviceId)
        .eq('measured_at', measuredAt)
        .single();
      if (dup.error) {
        return json({ error: 'dedupe_lookup_failed', detail: dup.error.message }, 500);
      }
      const resp: LegacyResponse = {
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

  const newReadingId = insertReading.data.id as string;
  // Fire detect-anomaly inline — legacy single-reading path mirrors
  // the multi-vitals BP trigger so behaviour is identical regardless
  // of which payload shape the client sent.
  await triggerDetectAnomalyBatch(familyId, [newReadingId]);

  const resp: LegacyResponse = {
    readingId: newReadingId,
    deviceId,
    duplicate: false,
  };
  return json(resp, 200);
}

// ────────────────────────────────────────────────────────────────────
// Multi-vitals path — Sprint 7.5.

async function handleMultiVitals(
  serviceClient: SupabaseClient,
  userId: string,
  familyId: string,
  deviceId: string,
  payload: MultiVitalsPayload,
): Promise<Response> {
  const counts: { inserted: MultiVitalsCounts; rejected: MultiVitalsCounts; duplicates: MultiVitalsCounts } = {
    inserted: { bp: 0, hr: 0, spo2: 0, sleep: 0, steps: 0, calories: 0 },
    rejected: { bp: 0, hr: 0, spo2: 0, sleep: 0, steps: 0, calories: 0 },
    duplicates: { bp: 0, hr: 0, spo2: 0, sleep: 0, steps: 0, calories: 0 },
  };

  // BP — different table (readings), but follows the same accept-then-
  // bulk-upsert pattern. Inserts use `ignoreDuplicates` against the
  // (device_id, measured_at) unique index → idempotent retry.
  const newBpReadingIds: string[] = [];
  if (payload.bpReadings?.length) {
    const { accepted, rejected } = validateBPReadings(payload.bpReadings);
    counts.rejected.bp = rejected.length;
    await logRejected(serviceClient, familyId, userId, 'bp', rejected);
    if (accepted.length > 0) {
      const rows = mapBPReadings(accepted, familyId, deviceId);
      const result = await insertReadings(serviceClient, rows);
      if (result.errored) {
        return json({ error: 'bp_insert_failed', detail: result.errored }, 500);
      }
      counts.inserted.bp = result.inserted;
      counts.duplicates.bp = result.duplicates;
      if (result.insertedReadingIds) newBpReadingIds.push(...result.insertedReadingIds);
    }
  }

  // HR / SpO2 / Sleep / Activity / Calories all land in vitals_other,
  // discriminated by vital_type. Same upsert pattern across all five.
  if (payload.hrSamples?.length) {
    const { accepted, rejected } = validateHRSamples(payload.hrSamples);
    counts.rejected.hr = rejected.length;
    await logRejected(serviceClient, familyId, userId, 'hr', rejected);
    if (accepted.length > 0) {
      const rows = mapHRSamples(accepted, familyId, deviceId);
      const { inserted, duplicates, errored } = await insertVitalRows(serviceClient, rows);
      if (errored) return json({ error: 'hr_insert_failed', detail: errored }, 500);
      counts.inserted.hr = inserted;
      counts.duplicates.hr = duplicates;
    }
  }

  if (payload.spo2Samples?.length) {
    const { accepted, rejected } = validateSpO2Samples(payload.spo2Samples);
    counts.rejected.spo2 = rejected.length;
    await logRejected(serviceClient, familyId, userId, 'spo2', rejected);
    if (accepted.length > 0) {
      const rows = mapSpO2Samples(accepted, familyId, deviceId);
      const { inserted, duplicates, errored } = await insertVitalRows(serviceClient, rows);
      if (errored) return json({ error: 'spo2_insert_failed', detail: errored }, 500);
      counts.inserted.spo2 = inserted;
      counts.duplicates.spo2 = duplicates;
    }
  }

  if (payload.sleepSessions?.length) {
    const { accepted, rejected } = validateSleepSessions(payload.sleepSessions);
    counts.rejected.sleep = rejected.length;
    await logRejected(serviceClient, familyId, userId, 'sleep_session', rejected);
    if (accepted.length > 0) {
      const rows = mapSleepSessions(accepted, familyId, deviceId);
      // Mutable: re-synced sessions reconcile totals + inferred wake.
      const { inserted, duplicates, errored } = await insertVitalRows(serviceClient, rows, { mutable: true });
      if (errored) return json({ error: 'sleep_insert_failed', detail: errored }, 500);
      counts.inserted.sleep = inserted;
      counts.duplicates.sleep = duplicates;
    }
  }

  if (payload.activityDays?.length) {
    const { accepted, rejected } = validateActivityDays(payload.activityDays);
    counts.rejected.steps = rejected.length;
    await logRejected(serviceClient, familyId, userId, 'steps_day', rejected);
    if (accepted.length > 0) {
      const rows = mapActivityDays(accepted, familyId, deviceId);
      // Mutable: steps accumulate through the day — last read wins.
      const { inserted, duplicates, errored } = await insertVitalRows(serviceClient, rows, { mutable: true });
      if (errored) return json({ error: 'activity_insert_failed', detail: errored }, 500);
      counts.inserted.steps = inserted;
      counts.duplicates.steps = duplicates;
    }
  }

  if (payload.caloriesDays?.length) {
    const { accepted, rejected } = validateCaloriesDays(payload.caloriesDays);
    counts.rejected.calories = rejected.length;
    await logRejected(serviceClient, familyId, userId, 'calories_day', rejected);
    if (accepted.length > 0) {
      const rows = mapCaloriesDays(accepted, familyId, deviceId);
      // Mutable: kcal accumulate through the day — last read wins.
      const { inserted, duplicates, errored } = await insertVitalRows(serviceClient, rows, { mutable: true });
      if (errored) return json({ error: 'calories_insert_failed', detail: errored }, 500);
      counts.inserted.calories = inserted;
      counts.duplicates.calories = duplicates;
    }
  }

  // Fire detect-anomaly for every newly inserted BP reading. Sprint 15:
  // BP runs on the hot path; HR/SpO2 trends live on the nightly cron.
  // Awaited so the response can carry tier info back to the client.
  if (newBpReadingIds.length > 0) {
    await triggerDetectAnomalyBatch(familyId, newBpReadingIds);
  }

  const resp: MultiVitalsResponse = { deviceId, ...counts };
  return json(resp, 200);
}

// ────────────────────────────────────────────────────────────────────
// detect-anomaly trigger — Sprint 15.
//
// One internal HTTP call per newly inserted BP reading. Fan-out is
// awaited in parallel so the /sync response stays below the 5-second
// latency budget from docs/10-anomaly-logic.md §2 even on a 24h
// backfill sync (typical BP volume: 1-3 readings, ceiling ~20).

async function triggerDetectAnomalyBatch(
  familyId: string,
  readingIds: string[],
): Promise<void> {
  const baseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const calls = readingIds.map((readingId) =>
    fetch(`${baseUrl}/functions/v1/detect-anomaly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        mode: 'reading_inserted',
        familyId,
        readingId,
      }),
    }).catch(() => undefined),
  );
  await Promise.all(calls);
}

// ────────────────────────────────────────────────────────────────────
// Insert helpers — supabase-js v2 upsert with ignoreDuplicates is the
// idempotency primitive. The dedupe indexes:
//   • readings:      (device_id, measured_at) where device_id is not null
//   • vitals_other:  (device_id, vital_type, measured_at) where device_id is not null
// Calling upsert with these as `onConflict` lets us batch-insert without
// failing the whole batch on a single duplicate.

interface InsertSummary {
  inserted: number;
  duplicates: number;
  errored: string | null;
  insertedReadingIds?: string[];
}

async function insertReadings(
  serviceClient: SupabaseClient,
  rows: ReturnType<typeof mapBPReadings>,
): Promise<InsertSummary> {
  // We need both the inserted count and the inserted ids — the latter
  // feeds the post-insert detect-anomaly trigger. ignoreDuplicates +
  // .select() yields only newly inserted rows; skipped duplicates are
  // counted by subtraction (rows.length - insertedRows.length).
  const { error, data } = await serviceClient
    .from('readings')
    .upsert(rows, {
      onConflict: 'device_id,measured_at',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) return { inserted: 0, duplicates: 0, errored: error.message };
  const insertedRows = data ?? [];
  return {
    inserted: insertedRows.length,
    duplicates: rows.length - insertedRows.length,
    errored: null,
    insertedReadingIds: insertedRows.map((r) => r.id as string),
  };
}

async function insertVitalRows(
  serviceClient: SupabaseClient,
  rows: VitalsOtherRow[],
  // `mutable` distinguishes the two upsert semantics on the shared
  // (device_id, vital_type, measured_at) dedupe key:
  //
  //   false (default) — immutable POINT samples (hr / spo2). Each has a
  //     unique timestamp, so a conflict is a genuine re-sync duplicate:
  //     ignore it (idempotent).
  //
  //   true — mutable DAILY aggregates (steps_day, calories_day) and
  //     reconciled sleep_session. Their measured_at is the day's
  //     midnight (steps/calories) or the synthesized session start
  //     (sleep) — CONSTANT across the day/night — while the value keeps
  //     changing: steps accumulate, sleep totals + inferred wake get
  //     reconciled. ignoreDuplicates here froze the row at the first
  //     sync of the day (e.g. 0 steps before the user walked), so the
  //     caregiver view — which reads the server — never saw the updated
  //     count even though the device's local store had it. Update on
  //     conflict so the latest read wins.
  options: { mutable?: boolean } = {},
): Promise<InsertSummary> {
  const ignoreDuplicates = !options.mutable;
  const { error, count } = await serviceClient
    .from('vitals_other')
    .upsert(rows, {
      onConflict: 'device_id,vital_type,measured_at',
      ignoreDuplicates,
      count: 'exact',
    });
  if (error) return { inserted: 0, duplicates: 0, errored: error.message };
  const inserted = count ?? 0;
  return { inserted, duplicates: rows.length - inserted, errored: null };
}

// ────────────────────────────────────────────────────────────────────
// Audit-log writer for rejected samples.
//
// Per CLAUDE.md + D13 §13.4: never log values, only counts + reasons +
// the index inside the original batch. The intent is post-hoc ops
// monitoring ("we dropped 3 HR samples for bpm_out_of_range last
// week"), not user-visible diagnostics.
//
// audit_log is partitioned, so writes here go to the default partition
// in pre-Sprint-17 environments. The default partition catches all
// writes until the partition-rolling cron lands.

async function logRejected(
  serviceClient: SupabaseClient,
  familyId: string,
  userId: string,
  vitalType: 'bp' | 'hr' | 'spo2' | 'sleep_session' | 'steps_day' | 'calories_day',
  rejected: RejectedSample[],
): Promise<void> {
  if (rejected.length === 0) return;
  const rows = rejected.map((r) => ({
    actor_user_id: userId,
    family_id: familyId,
    action: 'sync.invalid_sample',
    metadata: {
      vital_type: vitalType,
      reason: r.reason,
      sample_index: r.idx,
    },
  }));
  // Best-effort write — a failed audit-log insert should NOT fail the
  // ingest path. The PostHog event fired client-side already gives ops
  // the rejection signal even if audit_log misses.
  try {
    await serviceClient.from('audit_log').insert(rows);
  } catch {
    // ignore
  }
}
