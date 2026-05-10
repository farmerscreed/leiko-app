// hooks/useEnsureSelfBuyerFamily — Sprint 14.5 task 2.
//
// Backfill hook for legacy self-buyer accounts that predate Sprint 4
// onboarding. Mounted on Self-Buyer Home; on first paint it checks
// whether the signed-in user has a `family_members` row, and if not,
// calls `create_family` to provision one. Idempotent — no-ops once
// the membership exists.
//
// Why this lives client-side rather than in a server-side shim:
//   - The Edge Functions stay stateless and don't acquire side-
//     effects on first call.
//   - The `create_family` RPC runs as the caller via SECURITY DEFINER
//     + auth.uid(), so the JWT-bearing client is the natural site.
//   - One hook, one effect, idempotent. Easy to remove once all
//     legacy accounts are migrated and we can rely on onboarding
//     covering 100% of new users.

import { useEffect } from 'react';
import { useAuth } from '../state/auth';
import { supabase } from '../services/supabase';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { logger } from '../services/analytics/logger';

export function useEnsureSelfBuyerFamily(): void {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id;
  const accountType = profile?.account_type;
  const displayName = profile?.display_name;

  useEffect(() => {
    if (!userId || accountType !== 'self_buyer' || !displayName) return;

    let cancelled = false;
    void (async () => {
      // Cheap direct lookup — RLS lets the user read their own
      // membership without any join. Skips the heavier
      // useFamilyReadings query.
      const { data: existing, error: lookupError } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId)
        .is('removed_at', null)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (lookupError) {
        logger.track('family_auto_provision_failed', { reason: lookupError.message });
        return;
      }
      if (existing) return;

      logger.track('family_auto_provision_started');
      const { data, error: rpcError } = await supabase.rpc('create_family', {
        _parent_display_name: displayName,
        _parent_relationship: 'self',
        _caregiver_relationship: 'self',
      });
      if (cancelled) return;
      if (rpcError) {
        logger.track('family_auto_provision_failed', { reason: rpcError.message });
        return;
      }
      const familyId = Array.isArray(data) ? data[0]?.family_id : null;
      if (familyId) {
        mmkv.set(STORAGE_KEYS.currentFamilyId, familyId);
        logger.track('family_auto_provision_completed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, accountType, displayName]);
}
