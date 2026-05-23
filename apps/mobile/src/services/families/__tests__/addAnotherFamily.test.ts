// addAnotherFamily — Sprint 19 Block 2.

import { addAnotherFamily } from '../addAnotherFamily';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

function buildClient(
  rpcImpl: (
    fn: string,
    args: { _parent_display_name: string; _parent_relationship: string; _caregiver_relationship: string },
  ) => Promise<{ data: unknown; error: { message: string } | null }>,
) {
  return {
    rpc: rpcImpl,
  } as unknown as SupabaseClient<Database>;
}

describe('addAnotherFamily', () => {
  it('calls create_family RPC with trimmed input and returns the new familyId', async () => {
    let captured: Record<string, string> | null = null;
    const client = buildClient(async (fn, args) => {
      expect(fn).toBe('create_family');
      captured = args as Record<string, string>;
      return { data: [{ family_id: 'fam-new-001' }], error: null };
    });
    const result = await addAnotherFamily(
      {
        parentDisplayName: '  Papa Tunde  ',
        parentRelationship: 'father',
        caregiverRelationship: 'son',
      },
      client,
    );
    expect(result.familyId).toBe('fam-new-001');
    expect(captured).toEqual({
      _parent_display_name: 'Papa Tunde',
      _parent_relationship: 'father',
      _caregiver_relationship: 'son',
    });
  });

  it('rejects when name is empty', async () => {
    const client = buildClient(async () => ({ data: [], error: null }));
    await expect(
      addAnotherFamily(
        {
          parentDisplayName: '   ',
          parentRelationship: 'father',
          caregiverRelationship: 'son',
        },
        client,
      ),
    ).rejects.toThrow(/name/i);
  });

  it('rejects when parent relationship is empty', async () => {
    const client = buildClient(async () => ({ data: [], error: null }));
    await expect(
      addAnotherFamily(
        {
          parentDisplayName: 'Marian',
          parentRelationship: '',
          caregiverRelationship: 'son',
        },
        client,
      ),
    ).rejects.toThrow(/Wearer relationship/i);
  });

  it('rejects when caregiver relationship is empty', async () => {
    const client = buildClient(async () => ({ data: [], error: null }));
    await expect(
      addAnotherFamily(
        {
          parentDisplayName: 'Marian',
          parentRelationship: 'mother',
          caregiverRelationship: '',
        },
        client,
      ),
    ).rejects.toThrow(/Your relationship/i);
  });

  it('throws when the RPC returns an error', async () => {
    const client = buildClient(async () => ({
      data: null,
      error: { message: 'caller has no public.users profile' },
    }));
    await expect(
      addAnotherFamily(
        {
          parentDisplayName: 'Marian',
          parentRelationship: 'mother',
          caregiverRelationship: 'daughter',
        },
        client,
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('public.users') });
  });

  it('throws when the RPC returns an unexpected shape (no family_id)', async () => {
    const client = buildClient(async () => ({ data: [{}], error: null }));
    await expect(
      addAnotherFamily(
        {
          parentDisplayName: 'Marian',
          parentRelationship: 'mother',
          caregiverRelationship: 'daughter',
        },
        client,
      ),
    ).rejects.toThrow(/could not be found/i);
  });

  it('preserves the custom encoded relationship string (other:<label>)', async () => {
    let captured: Record<string, string> | null = null;
    const client = buildClient(async (_fn, args) => {
      captured = args as Record<string, string>;
      return { data: [{ family_id: 'fam-2' }], error: null };
    });
    await addAnotherFamily(
      {
        parentDisplayName: 'Aunt Tola',
        parentRelationship: 'other:Aunt Tola',
        caregiverRelationship: 'niece',
      },
      client,
    );
    expect(captured!._parent_relationship).toBe('other:Aunt Tola');
  });
});
