import {
  stashPendingCareInvite,
  getPendingCareInvite,
  clearPendingCareInvite,
  tryResolvePendingCareInvite,
} from '../pendingCareInvite';
import { mmkv, STORAGE_KEYS } from '../../storage';

beforeEach(() => {
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
  // ADR-0007: auto-resolve is a no-op now (connect-accept needs the
  // accepter's email, which a stashed deep-link code doesn't carry). The
  // person completes via the "Enter a code" sheet. Kept as a stable
  // no-op entry point.
  it('is a no-op and returns null', async () => {
    stashPendingCareInvite('246810');
    expect(await tryResolvePendingCareInvite()).toBeNull();
  });
});
