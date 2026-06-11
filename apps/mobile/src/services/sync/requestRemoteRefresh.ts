// services/sync/requestRemoteRefresh — remote-refresh (Phase 3, client).
//
// A family member (typically a remote caregiver) asks the watch-owner's
// phone to sync NOW. Calls the authenticated `request-sync` Edge Function,
// which verifies family membership, resolves the owner, and sends a push.
// The freshly-synced readings flow back to this device via the existing
// Realtime subscription on `readings` / `vitals_other` — so the caller
// doesn't await the sync itself, only the request.
//
// SILENT-FIRST: the default call sends the silent 'sync_refresh' (invisible
// to the wearer). Only when `escalate: true` — the silent attempt produced
// no fresh data and the caregiver chose "send a reminder" — does the owner
// get a VISIBLE, tappable nudge (Android drops silent pushes in Doze).
//
// Per CLAUDE.md: no PHI crosses this call — it carries only the familyId.

import { supabase } from '../supabase';
import { logger } from '../analytics/logger';

export type RemoteRefreshOutcome =
  | 'requested'
  | 'no_owner'
  | 'not_a_member'
  | 'suppressed_opt_out'
  | 'suppressed_quiet_hours'
  | 'suppressed_rate_limit'
  | 'suppressed_no_token'
  | 'failed';

export interface RequestRemoteRefreshOptions {
  /** Send the VISIBLE 'sync_nudge' fallback instead of the silent push.
   *  Set only after a silent attempt didn't surface fresh data. */
  escalate?: boolean;
}

/**
 * Ask the watch-owner's phone (for this family) to sync. Best-effort and
 * fire-and-forget friendly — always resolves, never throws.
 */
export async function requestRemoteRefresh(
  familyId: string,
  options: RequestRemoteRefreshOptions = {},
): Promise<RemoteRefreshOutcome> {
  const escalate = options.escalate === true;
  try {
    const { data, error } = await supabase.functions.invoke<{ outcome?: string }>(
      'request-sync',
      { body: { familyId, escalate } },
    );
    if (error || !data) {
      logger.track('remote_refresh_requested', { outcome: 'failed', escalated: escalate });
      return 'failed';
    }
    const outcome = (data.outcome ?? 'failed') as RemoteRefreshOutcome;
    logger.track('remote_refresh_requested', { outcome, escalated: escalate });
    return outcome;
  } catch {
    logger.track('remote_refresh_requested', { outcome: 'failed', escalated: escalate });
    return 'failed';
  }
}
