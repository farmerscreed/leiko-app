// Deno tests for sync family-routing resolution — ADR-0006 Phase 1.
//
// These cover the device-authoritative + deterministic routing contract
// in resolveFamilyAndDevice (index.ts). They use a minimal chainable fake
// Supabase client: each query builder records its (table, op, filters) and
// resolves to a programmed response supplied by the test. This documents
// the routing contract executably; it runs in CI (Deno) — note it cannot
// be run in the no-Deno dev container, so it is authored against the
// repo's Deno.test convention and gated on CI.
//
// Run: deno test supabase/functions/sync/resolve-routing.test.ts

import { assertEquals } from 'jsr:@std/assert@1';
import { resolveFamilyAndDevice } from './index.ts';

// ── Minimal chainable fake ────────────────────────────────────────────
// A query builder that collects chained filters and is awaitable at any
// termination point (.maybeSingle / .single / .limit / direct await on an
// .update().eq() chain). The test supplies a `respond(call)` function that
// returns { data, error } given the recorded call.

type Call = {
  table: string;
  op: 'select' | 'update' | 'insert';
  filters: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

function makeClient(
  respond: (call: Call) => { data: unknown; error: unknown },
  calls: Call[],
) {
  function builder(table: string) {
    const call: Call = { table, op: 'select', filters: {} };
    const resolveCall = () => {
      const r = respond(call);
      calls.push(call);
      return r;
    };
    const b: Record<string, unknown> = {
      select() {
        call.op = 'select';
        return b;
      },
      update(payload: Record<string, unknown>) {
        call.op = 'update';
        call.payload = payload;
        return b;
      },
      insert(payload: Record<string, unknown>) {
        call.op = 'insert';
        call.payload = payload;
        return b;
      },
      eq(col: string, val: unknown) {
        call.filters[col] = val;
        return b;
      },
      is(col: string, val: unknown) {
        call.filters[col] = val;
        return b;
      },
      order() {
        return b;
      },
      limit() {
        return b;
      },
      maybeSingle() {
        return Promise.resolve(resolveCall());
      },
      single() {
        return Promise.resolve(resolveCall());
      },
      // Direct await on a builder (e.g. update().eq()) resolves here.
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(resolveCall()).then(onF, onR);
      },
    };
    return b;
  }
  return { from: (table: string) => builder(table) } as never;
}

const DEVICE = {
  bleId: 'CA:BF:55:1F:32:7B',
  macSuffix: '327b',
  name: 'U19M_327B',
  model: 'U19M' as const,
  clientDeviceId: 'stable-uuid-1',
};

// ── 1. Device-authoritative: stable id wins, routes to BOUND family ────
Deno.test('stable clientDeviceId routes to the device\'s bound family', async () => {
  const calls: Call[] = [];
  const client = makeClient((call) => {
    if (call.table === 'devices' && call.filters.client_device_id === 'stable-uuid-1') {
      return { data: { id: 'dev-1', family_id: 'fam-BOUND' }, error: null };
    }
    if (call.table === 'family_members') {
      // caller IS a member of the bound family
      return { data: { user_id: 'user-1' }, error: null };
    }
    if (call.table === 'devices' && call.op === 'update') return { data: null, error: null };
    return { data: null, error: null };
  }, calls);

  const res = await resolveFamilyAndDevice(client, 'user-1', DEVICE);
  assertEquals(res, { familyId: 'fam-BOUND', deviceId: 'dev-1' });
});

// ── 2. Stable-id match but caller NOT a member → rejected ──────────────
Deno.test('rejects when caller is not a member of the device family', async () => {
  const calls: Call[] = [];
  const client = makeClient((call) => {
    if (call.table === 'devices' && call.filters.client_device_id === 'stable-uuid-1') {
      return { data: { id: 'dev-1', family_id: 'fam-BOUND' }, error: null };
    }
    if (call.table === 'family_members') return { data: null, error: null }; // not a member
    return { data: null, error: null };
  }, calls);

  const res = await resolveFamilyAndDevice(client, 'stranger', DEVICE);
  assertEquals('error' in res, true);
  if ('error' in res) {
    assertEquals(res.error, 'not_family_member');
    assertEquals(res.status, 403);
  }
});

// ── 3. New device + multi-circle user → oldest family_owner circle ─────
// The fallback query carries role=family_owner + order(joined_at); the fake
// returns whatever that filtered query is programmed to, proving the code
// asks for the owned circle (not an arbitrary membership).
Deno.test('new device binds to the user\'s owned circle (deterministic fallback)', async () => {
  const calls: Call[] = [];
  const client = makeClient((call) => {
    // no device matches the stable id
    if (call.table === 'devices' && call.op === 'select' && 'client_device_id' in call.filters) {
      return { data: null, error: null };
    }
    // owned-circle lookup: must filter role=family_owner
    if (call.table === 'family_members' && call.filters.role === 'family_owner') {
      return { data: { family_id: 'fam-OWN' }, error: null };
    }
    // bindDeviceInFamily: no existing active device to adopt → insert
    if (call.table === 'devices' && call.op === 'select') {
      return { data: null, error: null };
    }
    if (call.table === 'devices' && call.op === 'insert') {
      return { data: { id: 'dev-new' }, error: null };
    }
    return { data: null, error: null };
  }, calls);

  const res = await resolveFamilyAndDevice(client, 'user-1', DEVICE);
  assertEquals(res, { familyId: 'fam-OWN', deviceId: 'dev-new' });
  // Prove the fallback actually queried for role=family_owner.
  const ownedLookup = calls.find(
    (c) => c.table === 'family_members' && c.filters.role === 'family_owner',
  );
  assertEquals(Boolean(ownedLookup), true);
});

// ── 4. User owns no circle → no_family (a follower can't capture a watch)
Deno.test('rejects with no_family when the user owns no circle', async () => {
  const calls: Call[] = [];
  const client = makeClient((call) => {
    if (call.table === 'devices' && call.op === 'select') return { data: null, error: null };
    if (call.table === 'family_members') return { data: null, error: null }; // owns nothing
    return { data: null, error: null };
  }, calls);

  const res = await resolveFamilyAndDevice(client, 'follower-only', DEVICE);
  assertEquals('error' in res, true);
  if ('error' in res) {
    assertEquals(res.error, 'no_family');
    assertEquals(res.status, 403);
  }
});

// ── 5. Legacy client (no clientDeviceId) → MAC match within owned circle
Deno.test('legacy client without clientDeviceId resolves via owned circle + MAC', async () => {
  const calls: Call[] = [];
  const legacy = { ...DEVICE, clientDeviceId: undefined };
  const client = makeClient((call) => {
    if (call.table === 'family_members' && call.filters.role === 'family_owner') {
      return { data: { family_id: 'fam-OWN' }, error: null };
    }
    // bindDeviceInFamily MAC lookup hits
    if (call.table === 'devices' && call.op === 'select' && 'mac_address' in call.filters) {
      return { data: { id: 'dev-legacy' }, error: null };
    }
    return { data: null, error: null };
  }, calls);

  const res = await resolveFamilyAndDevice(client, 'user-1', legacy);
  assertEquals(res, { familyId: 'fam-OWN', deviceId: 'dev-legacy' });
});

// ── 6. Reinstall: new clientDeviceId, owned circle has ONE active device
// that already carries an OLD stable id → re-stamp (adopt), do NOT insert.
// This is the regression for the 500 the founder hit after an app reinstall.
Deno.test('reinstall re-stamps the circle\'s single active device (no duplicate insert)', async () => {
  const calls: Call[] = [];
  const client = makeClient((call) => {
    // new stable id matches no device globally
    if (call.table === 'devices' && call.op === 'select' && 'client_device_id' in call.filters) {
      return { data: null, error: null };
    }
    if (call.table === 'family_members' && call.filters.role === 'family_owner') {
      return { data: { family_id: 'fam-OWN' }, error: null };
    }
    // owned-circle active-device lookup (.limit(2)) returns exactly one
    // active device, which already carries an old stable id.
    if (call.table === 'devices' && call.op === 'select' && call.filters.family_id === 'fam-OWN') {
      return { data: [{ id: 'dev-existing' }], error: null };
    }
    // re-stamp update succeeds
    if (call.table === 'devices' && call.op === 'update') {
      return { data: { id: 'dev-existing' }, error: null };
    }
    return { data: null, error: null };
  }, calls);

  const res = await resolveFamilyAndDevice(client, 'user-1', DEVICE);
  assertEquals(res, { familyId: 'fam-OWN', deviceId: 'dev-existing' });
  // No insert should have happened.
  assertEquals(
    calls.some((c) => c.table === 'devices' && c.op === 'insert'),
    false,
  );
});
