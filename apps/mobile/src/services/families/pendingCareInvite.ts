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
import { resolveCareInvite } from './manageInvites';
import { logger } from '../analytics/logger';

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
 * Resolve a stashed care invite, if any. Returns the resolved familyId on
 * success, or null when there was nothing to do / it couldn't resolve yet.
 * Clears the stash on success. On 'no_circle_yet' the stash is KEPT so a
 * later call (after pairing) can complete it.
 */
export async function tryResolvePendingCareInvite(): Promise<string | null> {
  const code = getPendingCareInvite();
  if (!code) return null;
  try {
    const { familyId } = await resolveCareInvite({ code });
    clearPendingCareInvite();
    return familyId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    // Keep the stash for a retry only while the wearer has no circle yet.
    // Any terminal error (expired/cancelled/already-accepted/not-found)
    // clears it so we don't retry forever.
    if (!/no_circle_yet/i.test(msg)) {
      clearPendingCareInvite();
    }
    logger.track('care_invite_resolve_failed', { reason: msg || 'unknown' });
    return null;
  }
}
