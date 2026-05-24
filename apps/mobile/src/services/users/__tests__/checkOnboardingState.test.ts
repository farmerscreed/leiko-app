// checkOnboardingState — Sprint 19 Block 8.

import { checkOnboardingState } from '../checkOnboardingState';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

interface Capture {
  table?: string;
  selectExpr?: string;
  selectOpts?: { count?: string; head?: boolean };
  filters: Array<{ op: string; col: string; val: unknown }>;
}

function buildClient(
  resp: { count: number | null; error: { message: string } | null },
  capture?: Capture,
): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (capture) capture.table = table;
      return {
        select(expr: string, opts?: { count?: string; head?: boolean }) {
          if (capture) {
            capture.selectExpr = expr;
            capture.selectOpts = opts;
          }
          const builder = {
            eq(col: string, val: unknown) {
              if (capture) capture.filters.push({ op: 'eq', col, val });
              return builder;
            },
            is(col: string, val: unknown) {
              if (capture) capture.filters.push({ op: 'is', col, val });
              return Promise.resolve(resp);
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

describe('checkOnboardingState', () => {
  it('returns hasOnboarded=true when the user has at least one active family_members row', async () => {
    const capture: Capture = { filters: [] };
    const client = buildClient({ count: 1, error: null }, capture);
    const { hasOnboarded } = await checkOnboardingState('user-1', client);
    expect(hasOnboarded).toBe(true);
    expect(capture.table).toBe('family_members');
    expect(capture.selectOpts).toEqual({ count: 'exact', head: true });
    expect(capture.filters).toEqual([
      { op: 'eq', col: 'user_id', val: 'user-1' },
      { op: 'is', col: 'removed_at', val: null },
    ]);
  });

  it('returns hasOnboarded=true when count > 1 (multiple families)', async () => {
    const client = buildClient({ count: 5, error: null });
    const { hasOnboarded } = await checkOnboardingState('user-1', client);
    expect(hasOnboarded).toBe(true);
  });

  it('returns hasOnboarded=false when count is 0', async () => {
    const client = buildClient({ count: 0, error: null });
    const { hasOnboarded } = await checkOnboardingState('user-1', client);
    expect(hasOnboarded).toBe(false);
  });

  it('returns hasOnboarded=false when count is null (defensive)', async () => {
    const client = buildClient({ count: null, error: null });
    const { hasOnboarded } = await checkOnboardingState('user-1', client);
    expect(hasOnboarded).toBe(false);
  });

  it('returns hasOnboarded=false on RLS / network error (no flag change)', async () => {
    const client = buildClient({ count: null, error: { message: 'permission denied' } });
    const { hasOnboarded } = await checkOnboardingState('user-1', client);
    expect(hasOnboarded).toBe(false);
  });

  it('filters by removed_at IS NULL — excludes soft-removed memberships', async () => {
    const capture: Capture = { filters: [] };
    const client = buildClient({ count: 0, error: null }, capture);
    await checkOnboardingState('user-1', client);
    const removedAtFilter = capture.filters.find((f) => f.col === 'removed_at');
    expect(removedAtFilter).toEqual({ op: 'is', col: 'removed_at', val: null });
  });
});
