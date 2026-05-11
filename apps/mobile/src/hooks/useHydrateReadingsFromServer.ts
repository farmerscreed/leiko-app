// hooks/useHydrateReadingsFromServer — Sprint 12.5 fix.
//
// Server → local recovery for the readings store. Runs once per
// app launch from Self-Buyer Home; if the local `recent` array
// is empty AND the user is signed in, fetches the last 30 visible
// BP rows from public.readings and seeds them into the store via
// useReadings.seedRecentFromServer (idempotent — dedupes by
// serverId).
//
// Why this exists: the local-first architecture (per CLAUDE.md
// "every reading is saved to MMKV before any sync attempt") has
// no automatic catch-up path. A reinstall, MMKV clear, or app-
// data wipe leaves the phone with an empty `recent` even though
// the server still has every reading the family ever synced.
// Before this hook, the only way to recover was to take a fresh
// reading via Take a Reading (which itself has BLE issues on some
// flows). Now Home self-heals.
//
// This DOES NOT replace the offline-first contract — pending
// rows are still written locally before /sync. This only seeds
// `recent` (the synced-and-acknowledged side) from the server
// when local is empty.

import { useEffect } from 'react';
import { useAuth } from '../state/auth';
import { useReadings, type LocalReading } from '../state/readings';
import { supabase } from '../services/supabase';
import { logger } from '../services/analytics/logger';
import { classifyReading } from '../utils/classification';

const FETCH_LIMIT = 30;

interface ServerReadingRow {
  id: string;
  family_id: string;
  device_id: string | null;
  source: string;
  measured_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  hidden: boolean;
}

function mapServerRowToLocal(row: ServerReadingRow): LocalReading {
  const classification = classifyReading(
    { systolic: row.systolic, diastolic: row.diastolic, pulse: row.pulse },
    null,
  );
  return {
    localId: `srv-${row.id}`,
    serverId: row.id,
    measuredAtSec: Math.floor(new Date(row.measured_at).getTime() / 1000),
    systolic: row.systolic,
    diastolic: row.diastolic,
    pulse: row.pulse,
    source: (row.source as LocalReading['source']) ?? 'watch',
    deviceBleId: null,
    classification,
    capturedAtMs: new Date(row.measured_at).getTime(),
  };
}

export function useHydrateReadingsFromServer(): void {
  const profile = useAuth((s) => s.profile);
  const userId = profile?.id ?? null;

  useEffect(() => {
    if (!userId) return;

    // Only fire when local is empty — pending rows count too (a user
    // with pending offline-writes shouldn't have those overwritten).
    const localCount = useReadings.getState().recent.length +
      useReadings.getState().pending.length;
    if (localCount > 0) return;

    let cancelled = false;
    void (async () => {
      try {
        // Find the user's family (single membership at v1.0).
        const { data: membership } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('user_id', userId)
          .is('removed_at', null)
          .limit(1)
          .maybeSingle();
        if (cancelled || !membership) return;
        const familyId = (membership as { family_id: string }).family_id;

        const { data: rows, error } = await supabase
          .from('readings')
          .select('id, family_id, device_id, source, measured_at, systolic, diastolic, pulse, hidden')
          .eq('family_id', familyId)
          .eq('hidden', false)
          .order('measured_at', { ascending: false })
          .limit(FETCH_LIMIT);
        if (cancelled || error || !rows || rows.length === 0) return;

        const mapped = (rows as ServerReadingRow[]).map(mapServerRowToLocal);
        const added = useReadings.getState().seedRecentFromServer(mapped);
        if (added > 0) {
          logger.track('readings_hydrated_from_server', { count: added });
        }
      } catch {
        // Network failure is non-fatal. Next app launch retries.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
