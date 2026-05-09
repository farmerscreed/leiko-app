// Onboarding store unit tests. Sprint 3.
//
// Bar:
//   - setCaregiver / setParent merge into the draft
//   - hydrate() reflects MMKV state (familyId + complete flag)
//   - completeWithWatchInHand:
//       - refuses without a profile, draft.caregiver, or draft.parent
//       - calls supabase.from('users').update with the captured display_name
//         and timezone
//       - calls supabase.rpc('create_family', { ... }) with the encoded
//         relationship strings
//       - on success: persists familyId + caregiverOnboardingComplete to
//         MMKV, flips the store flag, clears the draft
//       - on RPC failure: leaves the flag false, surfaces an error message,
//         keeps the draft for the user to retry

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const updateUser = jest.fn();
const rpc = jest.fn();

jest.mock('../../services/supabase', () => ({
  supabase: {
    from: () => ({
      update: (values: unknown) => ({
        eq: () => updateUser(values),
      }),
    }),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

import { useAuth } from '../auth';
import { useOnboarding } from '../onboarding';
import { mmkv, STORAGE_KEYS } from '../../services/storage';

const profileFixture = {
  id: 'user-1',
  email: 'mum@example.com',
  display_name: 'mum',
  photo_url: null,
  preferred_language: 'en',
  timezone: 'UTC',
  year_of_birth: null,
  account_type: 'caregiver' as const,
  marketing_opt_in: false,
  gender: null,
  height_cm: null,
  weight_kg: null,
  hypertension_status: null,
  deleted_at: null,
  created_at: '2026-05-06T00:00:00Z',
  updated_at: '2026-05-06T00:00:00Z',
};

beforeEach(() => {
  updateUser.mockReset();
  rpc.mockReset();
  mmkv.clearAll();
  useAuth.setState({
    status: 'authenticated',
    session: null,
    profile: profileFixture,
    pendingAccountType: null,
    lastOtpEmail: null,
  });
  useOnboarding.setState({
    caregiver: { displayName: '', relationship: null },
    parent: {
      displayName: '',
      relationship: null,
      relationshipCustom: null,
      timezone: 'UTC',
    },
    selfBuyer: {
      displayName: '',
      yearOfBirth: null,
      timezone: 'UTC',
    },
    familyId: null,
    caregiverOnboardingComplete: false,
    selfBuyerOnboardingComplete: false,
    finalizing: false,
    finalizeError: null,
  });
});

describe('useOnboarding — draft', () => {
  it('setCaregiver merges into the caregiver draft', () => {
    useOnboarding.getState().setCaregiver({ displayName: 'Tunde' });
    useOnboarding.getState().setCaregiver({ relationship: 'son' });

    const { caregiver } = useOnboarding.getState();
    expect(caregiver.displayName).toBe('Tunde');
    expect(caregiver.relationship).toBe('son');
  });

  it('setParent merges into the parent draft', () => {
    useOnboarding.getState().setParent({ displayName: 'Mama Linda' });
    useOnboarding.getState().setParent({
      relationship: 'mother',
      timezone: 'Africa/Lagos',
    });

    const { parent } = useOnboarding.getState();
    expect(parent.displayName).toBe('Mama Linda');
    expect(parent.relationship).toBe('mother');
    expect(parent.timezone).toBe('Africa/Lagos');
  });
});

describe('useOnboarding — hydrate', () => {
  it('reads familyId and caregiverOnboardingComplete from MMKV', () => {
    mmkv.set(STORAGE_KEYS.currentFamilyId, 'family-uuid');
    mmkv.set(STORAGE_KEYS.caregiverOnboardingComplete, true);

    useOnboarding.getState().hydrate();

    expect(useOnboarding.getState().familyId).toBe('family-uuid');
    expect(useOnboarding.getState().caregiverOnboardingComplete).toBe(true);
  });

  it('reads selfBuyerOnboardingComplete from MMKV', () => {
    mmkv.set(STORAGE_KEYS.currentFamilyId, 'family-uuid-2');
    mmkv.set(STORAGE_KEYS.selfBuyerOnboardingComplete, true);

    useOnboarding.getState().hydrate();

    expect(useOnboarding.getState().familyId).toBe('family-uuid-2');
    expect(useOnboarding.getState().selfBuyerOnboardingComplete).toBe(true);
  });
});

describe('useOnboarding — selfBuyer draft', () => {
  it('setSelfBuyer merges into the self-buyer draft', () => {
    useOnboarding.getState().setSelfBuyer({ displayName: 'Lawrence' });
    useOnboarding.getState().setSelfBuyer({
      yearOfBirth: 1985,
      timezone: 'Africa/Lagos',
    });

    const { selfBuyer } = useOnboarding.getState();
    expect(selfBuyer.displayName).toBe('Lawrence');
    expect(selfBuyer.yearOfBirth).toBe(1985);
    expect(selfBuyer.timezone).toBe('Africa/Lagos');
  });
});

describe('useOnboarding — completeWithWatchInHand', () => {
  function fillDraft() {
    useOnboarding.getState().setCaregiver({
      displayName: 'Tunde',
      relationship: 'son',
    });
    useOnboarding.getState().setParent({
      displayName: 'Mama Linda',
      relationship: 'mother',
      timezone: 'Africa/Lagos',
    });
  }

  it('refuses if there is no signed-in profile', async () => {
    useAuth.setState({ profile: null });
    fillDraft();
    await expect(
      useOnboarding.getState().completeWithWatchInHand(),
    ).rejects.toThrow(/Not signed in/);
  });

  it('refuses if the caregiver draft is incomplete', async () => {
    await expect(
      useOnboarding.getState().completeWithWatchInHand(),
    ).rejects.toThrow(/Caregiver profile is incomplete/);
  });

  it('refuses if the parent draft is incomplete', async () => {
    useOnboarding.getState().setCaregiver({
      displayName: 'Tunde',
      relationship: 'son',
    });
    await expect(
      useOnboarding.getState().completeWithWatchInHand(),
    ).rejects.toThrow(/Parent profile is incomplete/);
  });

  it('updates public.users with display_name + timezone', async () => {
    fillDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-1' }], error: null });

    await useOnboarding.getState().completeWithWatchInHand();

    expect(updateUser).toHaveBeenCalledWith({
      display_name: 'Tunde',
      timezone: 'Africa/Lagos',
    });
  });

  it('calls create_family with encoded relationship strings', async () => {
    fillDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-1' }], error: null });

    await useOnboarding.getState().completeWithWatchInHand();

    expect(rpc).toHaveBeenCalledWith('create_family', {
      _parent_display_name: 'Mama Linda',
      _parent_relationship: 'mother',
      _caregiver_relationship: 'son',
    });
  });

  it("encodes 'other' relationship with a custom label", async () => {
    useOnboarding.getState().setCaregiver({
      displayName: 'Tunde',
      relationship: 'other',
    });
    useOnboarding.getState().setParent({
      displayName: 'Aunty Tola',
      relationship: 'other',
      relationshipCustom: 'Aunty',
      timezone: 'Africa/Lagos',
    });
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-2' }], error: null });

    await useOnboarding.getState().completeWithWatchInHand();

    expect(rpc).toHaveBeenCalledWith('create_family', {
      _parent_display_name: 'Aunty Tola',
      _parent_relationship: 'other:Aunty',
      _caregiver_relationship: 'other',
    });
  });

  it('persists familyId + complete flag, clears the draft on success', async () => {
    fillDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-1' }], error: null });

    await useOnboarding.getState().completeWithWatchInHand();

    const state = useOnboarding.getState();
    expect(state.familyId).toBe('fam-1');
    expect(state.caregiverOnboardingComplete).toBe(true);
    expect(state.caregiver.displayName).toBe('');
    expect(state.parent.displayName).toBe('');
    expect(mmkv.getString(STORAGE_KEYS.currentFamilyId)).toBe('fam-1');
    expect(mmkv.getBoolean(STORAGE_KEYS.caregiverOnboardingComplete)).toBe(true);
  });

  it('surfaces an RPC failure, keeps the draft, leaves the flag off', async () => {
    fillDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'P0001 something blew up' },
    });

    await expect(
      useOnboarding.getState().completeWithWatchInHand(),
    ).rejects.toMatchObject({ message: expect.stringContaining('P0001') });

    const state = useOnboarding.getState();
    expect(state.caregiverOnboardingComplete).toBe(false);
    expect(state.familyId).toBeNull();
    expect(state.caregiver.displayName).toBe('Tunde');
    expect(state.finalizeError).toMatch(/P0001/);
    expect(mmkv.contains(STORAGE_KEYS.caregiverOnboardingComplete)).toBe(false);
  });

  it('surfaces a users.update failure before calling create_family', async () => {
    fillDraft();
    updateUser.mockResolvedValueOnce({
      error: { message: 'permission denied' },
    });

    await expect(
      useOnboarding.getState().completeWithWatchInHand(),
    ).rejects.toMatchObject({ message: expect.stringContaining('permission denied') });

    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('useOnboarding — completeSelfBuyer', () => {
  function fillSelfBuyerDraft() {
    useOnboarding.getState().setSelfBuyer({
      displayName: 'Lawrence',
      yearOfBirth: 1985,
      timezone: 'Africa/Lagos',
    });
  }

  it('refuses if there is no signed-in profile', async () => {
    useAuth.setState({ profile: null });
    fillSelfBuyerDraft();
    await expect(
      useOnboarding.getState().completeSelfBuyer(),
    ).rejects.toThrow(/Not signed in/);
  });

  it('refuses if the self-buyer name is empty', async () => {
    await expect(
      useOnboarding.getState().completeSelfBuyer(),
    ).rejects.toThrow(/Profile is incomplete/);
  });

  it('updates public.users with display_name + timezone + year_of_birth when provided', async () => {
    fillSelfBuyerDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-sb-1' }], error: null });

    await useOnboarding.getState().completeSelfBuyer();

    expect(updateUser).toHaveBeenCalledWith({
      display_name: 'Lawrence',
      timezone: 'Africa/Lagos',
      year_of_birth: 1985,
    });
  });

  it('omits year_of_birth from the patch when not provided', async () => {
    useOnboarding.getState().setSelfBuyer({
      displayName: 'Lawrence',
      yearOfBirth: null,
      timezone: 'Africa/Lagos',
    });
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-sb-2' }], error: null });

    await useOnboarding.getState().completeSelfBuyer();

    expect(updateUser).toHaveBeenCalledWith({
      display_name: 'Lawrence',
      timezone: 'Africa/Lagos',
    });
    expect(updateUser.mock.calls[0][0]).not.toHaveProperty('year_of_birth');
  });

  it("calls create_family with parent_relationship='self'", async () => {
    fillSelfBuyerDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-sb-3' }], error: null });

    await useOnboarding.getState().completeSelfBuyer();

    expect(rpc).toHaveBeenCalledWith('create_family', {
      _parent_display_name: 'Lawrence',
      _parent_relationship: 'self',
      _caregiver_relationship: 'self',
    });
  });

  it('persists familyId + selfBuyerOnboardingComplete on success', async () => {
    fillSelfBuyerDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ family_id: 'fam-sb-4' }], error: null });

    await useOnboarding.getState().completeSelfBuyer();

    const state = useOnboarding.getState();
    expect(state.familyId).toBe('fam-sb-4');
    expect(state.selfBuyerOnboardingComplete).toBe(true);
    expect(state.caregiverOnboardingComplete).toBe(false);
    expect(state.selfBuyer.displayName).toBe('');
    expect(mmkv.getString(STORAGE_KEYS.currentFamilyId)).toBe('fam-sb-4');
    expect(mmkv.getBoolean(STORAGE_KEYS.selfBuyerOnboardingComplete)).toBe(true);
  });

  it('surfaces an RPC failure and leaves the flag off', async () => {
    fillSelfBuyerDraft();
    updateUser.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'P0001 self_buyer rejected' },
    });

    await expect(
      useOnboarding.getState().completeSelfBuyer(),
    ).rejects.toMatchObject({ message: expect.stringContaining('P0001') });

    const state = useOnboarding.getState();
    expect(state.selfBuyerOnboardingComplete).toBe(false);
    expect(state.familyId).toBeNull();
    expect(state.selfBuyer.displayName).toBe('Lawrence');
    expect(state.finalizeError).toMatch(/P0001/);
    expect(mmkv.contains(STORAGE_KEYS.selfBuyerOnboardingComplete)).toBe(false);
  });
});
