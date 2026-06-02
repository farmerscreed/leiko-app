// checkOnboardingState — Sprint 19 Block 8 + v7 hotfix (RPC switch).

import { checkOnboardingState } from '../checkOnboardingState';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

interface RpcCall {
  fn: string;
  args: unknown;
}

function buildClient(
  resp: { data: unknown; error: { message: string } | null },
  capture?: { calls: RpcCall[] },
): SupabaseClient<Database> {
  return {
    rpc(fn: string, args: unknown) {
      if (capture) capture.calls.push({ fn, args });
      return Promise.resolve(resp);
    },
  } as unknown as SupabaseClient<Database>;
}

describe('checkOnboardingState (RPC)', () => {
  it('hits the get_user_onboarding_state RPC', async () => {
    const capture = { calls: [] as RpcCall[] };
    const client = buildClient(
      { data: [{ has_onboarded: true, primary_family_id: 'fam-1' }], error: null },
      capture,
    );
    await checkOnboardingState('user-1', client);
    expect(capture.calls).toHaveLength(1);
    expect(capture.calls[0].fn).toBe('get_user_onboarding_state');
  });

  it('returns hasOnboarded=true + primaryFamilyId when RPC returns a membership row', async () => {
    const client = buildClient({
      data: [{ has_onboarded: true, primary_family_id: 'fam-abc' }],
      error: null,
    });
    const state = await checkOnboardingState('user-1', client);
    expect(state).toEqual({ hasOnboarded: true, primaryFamilyId: 'fam-abc' });
  });

  it('returns hasOnboarded=true with null primaryFamilyId when RPC says onboarded but provides no family', async () => {
    // Defensive shape — should not happen in practice but the client
    // tolerates it.
    const client = buildClient({
      data: [{ has_onboarded: true, primary_family_id: null }],
      error: null,
    });
    const state = await checkOnboardingState('user-1', client);
    expect(state).toEqual({ hasOnboarded: true, primaryFamilyId: null });
  });

  it('returns hasOnboarded=false when RPC returns has_onboarded=false', async () => {
    const client = buildClient({
      data: [{ has_onboarded: false, primary_family_id: null }],
      error: null,
    });
    const state = await checkOnboardingState('user-1', client);
    expect(state).toEqual({ hasOnboarded: false, primaryFamilyId: null });
  });

  it('returns hasOnboarded=false when RPC returns an empty data array', async () => {
    const client = buildClient({ data: [], error: null });
    const state = await checkOnboardingState('user-1', client);
    expect(state).toEqual({ hasOnboarded: false, primaryFamilyId: null });
  });

  it('returns hasOnboarded=false when RPC errors (no flag change)', async () => {
    const client = buildClient({
      data: null,
      error: { message: 'network failure' },
    });
    const state = await checkOnboardingState('user-1', client);
    expect(state).toEqual({ hasOnboarded: false, primaryFamilyId: null });
  });
});
