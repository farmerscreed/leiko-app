// fetchParentSummaries unit test.
//
// Mocks the Supabase client's chainable builder. The shape we assert
// matches what the caregiver home consumes: parents sorted by latest
// reading, each carrying a 14-row recent buffer for the sparkline.

import { fetchParentSummaries } from '../fetchParentSummaries';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

type MembershipRow = {
  family_id: string;
  families: {
    id: string;
    parent_display_name: string;
    parent_relationship: string;
    parent_year_of_birth: number | null;
  };
};

type ReadingRow = {
  id: string;
  family_id: string;
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  quality_score: 'good' | 'fair' | 'suspect' | null;
};

function makeClient(opts: {
  memberships: MembershipRow[];
  readings: ReadingRow[];
}): SupabaseClient<Database> {
  const builder = (table: string) => {
    if (table === 'family_members') {
      const chain: Record<string, jest.Mock> = {} as never;
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.is = jest.fn(() => Promise.resolve({ data: opts.memberships, error: null }));
      return chain;
    }
    if (table === 'readings') {
      const chain: Record<string, jest.Mock> = {} as never;
      chain.select = jest.fn(() => chain);
      chain.in = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.order = jest.fn(() => Promise.resolve({ data: opts.readings, error: null }));
      return chain;
    }
    throw new Error(`unexpected table: ${table}`);
  };
  return { from: builder } as unknown as SupabaseClient<Database>;
}

describe('fetchParentSummaries', () => {
  it('returns an empty array when the user has no active memberships', async () => {
    const client = makeClient({ memberships: [], readings: [] });
    const result = await fetchParentSummaries(client, 'user-1');
    expect(result).toEqual([]);
  });

  it('shapes one summary per family with the latest reading + recent buffer', async () => {
    const client = makeClient({
      memberships: [
        {
          family_id: 'fam-mum',
          families: {
            id: 'fam-mum',
            parent_display_name: 'Mum',
            parent_relationship: 'mother',
            parent_year_of_birth: 1955,
          },
        },
        {
          family_id: 'fam-dad',
          families: {
            id: 'fam-dad',
            parent_display_name: 'Dad',
            parent_relationship: 'father',
            parent_year_of_birth: 1953,
          },
        },
      ],
      readings: [
        // Newer for Dad → Dad sorts above Mum.
        { id: 'r1', family_id: 'fam-dad', measured_at: '2026-05-07T08:00:00Z', systolic: 122, diastolic: 78, pulse: 70, quality_score: 'good' },
        { id: 'r2', family_id: 'fam-dad', measured_at: '2026-05-06T08:00:00Z', systolic: 120, diastolic: 80, pulse: 72, quality_score: 'good' },
        { id: 'r3', family_id: 'fam-mum', measured_at: '2026-05-05T08:00:00Z', systolic: 130, diastolic: 85, pulse: 75, quality_score: 'fair' },
      ],
    });
    const result = await fetchParentSummaries(client, 'user-1');
    expect(result).toHaveLength(2);
    expect(result[0].familyId).toBe('fam-dad');
    expect(result[0].latestReading?.systolic).toBe(122);
    expect(result[0].recentReadings).toHaveLength(2);
    expect(result[1].familyId).toBe('fam-mum');
    expect(result[1].latestReading?.systolic).toBe(130);
    expect(result[1].recentReadings).toHaveLength(1);
  });

  it('returns null latestReading when a family has no readings', async () => {
    const client = makeClient({
      memberships: [
        {
          family_id: 'fam-quiet',
          families: {
            id: 'fam-quiet',
            parent_display_name: 'Aunt',
            parent_relationship: 'aunt',
            parent_year_of_birth: null,
          },
        },
      ],
      readings: [],
    });
    const result = await fetchParentSummaries(client, 'user-1');
    expect(result).toHaveLength(1);
    expect(result[0].latestReading).toBeNull();
    expect(result[0].recentReadings).toEqual([]);
  });

  it('caps recentReadings at 14 entries for the sparkline buffer', async () => {
    const readings: ReadingRow[] = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`,
      family_id: 'fam-busy',
      measured_at: new Date(2026, 4, 7 - i).toISOString(),
      systolic: 120,
      diastolic: 80,
      pulse: 70,
      quality_score: 'good' as const,
    }));
    const client = makeClient({
      memberships: [
        {
          family_id: 'fam-busy',
          families: {
            id: 'fam-busy',
            parent_display_name: 'Mum',
            parent_relationship: 'mother',
            parent_year_of_birth: 1955,
          },
        },
      ],
      readings,
    });
    const result = await fetchParentSummaries(client, 'user-1');
    expect(result[0].recentReadings).toHaveLength(14);
  });
});
