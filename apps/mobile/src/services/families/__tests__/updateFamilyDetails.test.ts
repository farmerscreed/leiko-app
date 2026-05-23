// updateFamilyDetails — Sprint 19 Block 3.

import { updateFamilyDetails } from '../updateFamilyDetails';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

type UpdatePayload = { parent_display_name: string; parent_relationship: string };

function buildClient(
  resp: { error: { message: string } | null },
  onUpdate?: (payload: UpdatePayload, familyId: string) => void,
): SupabaseClient<Database> {
  return {
    from() {
      return {
        update(payload: UpdatePayload) {
          return {
            eq(_col: string, familyId: string) {
              onUpdate?.(payload, familyId);
              return Promise.resolve(resp);
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

describe('updateFamilyDetails', () => {
  it('updates parent_display_name + parent_relationship for the given familyId', async () => {
    let captured: { payload: UpdatePayload; id: string } | null = null;
    const client = buildClient({ error: null }, (payload, id) => {
      captured = { payload, id };
    });
    await updateFamilyDetails(
      {
        familyId: 'fam-1',
        parentDisplayName: '  Mama Linda  ',
        parentRelationship: 'mother',
      },
      client,
    );
    expect(captured).not.toBeNull();
    expect(captured!.id).toBe('fam-1');
    expect(captured!.payload.parent_display_name).toBe('Mama Linda');
    expect(captured!.payload.parent_relationship).toBe('mother');
  });

  it('rejects empty familyId', async () => {
    const client = buildClient({ error: null });
    await expect(
      updateFamilyDetails(
        { familyId: '', parentDisplayName: 'a', parentRelationship: 'mother' },
        client,
      ),
    ).rejects.toThrow(/familyId/i);
  });

  it('rejects empty name', async () => {
    const client = buildClient({ error: null });
    await expect(
      updateFamilyDetails(
        { familyId: 'fam-1', parentDisplayName: '   ', parentRelationship: 'mother' },
        client,
      ),
    ).rejects.toThrow(/name/i);
  });

  it('rejects empty relationship', async () => {
    const client = buildClient({ error: null });
    await expect(
      updateFamilyDetails(
        { familyId: 'fam-1', parentDisplayName: 'Mama', parentRelationship: '' },
        client,
      ),
    ).rejects.toThrow(/relationship/i);
  });

  it('propagates RLS errors from the UPDATE', async () => {
    const client = buildClient({ error: { message: 'new row violates row-level security policy for table "families"' } });
    await expect(
      updateFamilyDetails(
        { familyId: 'fam-1', parentDisplayName: 'Mama', parentRelationship: 'mother' },
        client,
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('row-level security') });
  });
});
