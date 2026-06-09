// services/sync/requestRemoteRefresh — remote-refresh (Phase 3, client).
//
// A family member (typically a remote caregiver) asks the watch-owner's
// phone to sync NOW. Calls the authenticated `request-sync` Edge Function,
// which verifies family membership, resolves the owner, and sends a silent
// push. The freshly-synced readings flow back to this device via the
// existing Realtime subscription on `readings` / `vitals_other` — so the
// caller doesn't await the sync itself, only the request.
//
// Per CLAUDE.md: no PHI crosses this call — it carries only the familyId.

import { supabase } from '../supabase';
import { logger } from '../analytics/logger';

export type RemoteRefreshOutcome =
  | 'requested'
  | 'no_owner'
  | 'not_a_member'
  | 'suppressed_rate_limit'
  | 'suppressed_no_token'
  | 'failed';

/**
 * Ask the watch-owner's phone (for this family) to sync. Best-effort and
 * fire-and-forget friendly — always resolves, never throws.
 */
export async function requestRemoteRefresh(
  familyId: string,
): Promise<RemoteRefreshOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke<{ outcome?: string }>(
      'request-sync',
      { body: { familyId } },
    );
    if (error || !data) {
      logger.track('remote_refresh_requested', { outcome: 'failed' });
      return 'failed';
    }
    const outcome = (data.outcome ?? 'failed') as RemoteRefreshOutcome;
    logger.track('remote_refresh_requested', { outcome });
    return outcome;
  } catch {
    logger.track('remote_refresh_requested', { outcome: 'failed' });
    return 'failed';
  }
}
