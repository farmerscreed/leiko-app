// pendingCareInvite — ADR-0006 helper to close the caregiver-initiated
// pending-invite loop.
//
// When a wearer taps a join link before they've set up, the deep-link
// handler stashes the code (stashPendingCareInvite). After the wearer
// pairs their watch — which creates their circle — tryResolvePendingCareInvite
// attaches the original inviter as a follower (resolve-care-invite) and
// clears the stash. Safe to call repeatedly; a no-op when nothing is
// stashed, and it keeps the code stashed (for a later retry) if the wearer
// somehow has no circle yet.

import { mmkv, STORAGE_KEYS } from '../storage';

export function stashPendingCareInvite(code: string): void {
  if (/^\d{6}$/.test(code)) {
    mmkv.set(STORAGE_KEYS.pendingCareInviteCode, code);
  }
}

export function getPendingCareInvite(): string | null {
  return mmkv.getString(STORAGE_KEYS.pendingCareInviteCode) ?? null;
}

export function clearPendingCareInvite(): void {
  mmkv.remove(STORAGE_KEYS.pendingCareInviteCode);
}

/**
 * ADR-0007: a stashed code can no longer be silently auto-resolved, because
 * connect-accept requires the accepter's email (the match guard) and a
 * deep link doesn't carry it reliably. So this is now a no-op placeholder:
 * the person finishes by entering the code (with their email) in the
 * "Enter a code" sheet, where connect-accept resolves direction. Kept as a
 * stable entry point in case a future flow stashes an email alongside.
 */
export async function tryResolvePendingCareInvite(): Promise<string | null> {
  // No stashed-code auto-resolve under unified connect — see note above.
  return null;
}
