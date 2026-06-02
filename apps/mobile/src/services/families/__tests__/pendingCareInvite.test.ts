import {
  stashPendingCareInvite,
  getPendingCareInvite,
  clearPendingCareInvite,
  tryResolvePendingCareInvite,
} from '../pendingCareInvite';
import { mmkv, STORAGE_KEYS } from '../../storage';

const mockResolve = jest.fn();
jest.mock('../manageInvites', () => ({
  resolveCareInvite: (...args: unknown[]) => mockResolve(...args),
}));

beforeEach(() => {
  mockResolve.mockReset();
  mmkv.remove(STORAGE_KEYS.pendingCareInviteCode);
});

describe('pendingCareInvite stash', () => {
  it('stashes and reads a valid 6-digit code', () => {
    stashPendingCareInvite('123456');
    expect(getPendingCareInvite()).toBe('123456');
  });

  it('ignores a non-6-digit code', () => {
    stashPendingCareInvite('abc');
    expect(getPendingCareInvite()).toBeNull();
  });

  it('clears the stash', () => {
    stashPendingCareInvite('123456');
    clearPendingCareInvite();
    expect(getPendingCareInvite()).toBeNull();
  });
});

describe('tryResolvePendingCareInvite', () => {
  it('no-ops when nothing is stashed', async () => {
    expect(await tryResolvePendingCareInvite()).toBeNull();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('resolves and clears on success', async () => {
    stashPendingCareInvite('246810');
    mockResolve.mockResolvedValue({ familyId: 'fam-9' });
    expect(await tryResolvePendingCareInvite()).toBe('fam-9');
    expect(mockResolve).toHaveBeenCalledWith({ code: '246810' });
    expect(getPendingCareInvite()).toBeNull();
  });

  it('KEEPS the stash on no_circle_yet (retry after pairing)', async () => {
    stashPendingCareInvite('246810');
    mockResolve.mockRejectedValue(new Error('no_circle_yet'));
    expect(await tryResolvePendingCareInvite()).toBeNull();
    expect(getPendingCareInvite()).toBe('246810');
  });

  it('clears the stash on a terminal error (expired etc.)', async () => {
    stashPendingCareInvite('246810');
    mockResolve.mockRejectedValue(new Error('invitation_expired'));
    expect(await tryResolvePendingCareInvite()).toBeNull();
    expect(getPendingCareInvite()).toBeNull();
  });
});
