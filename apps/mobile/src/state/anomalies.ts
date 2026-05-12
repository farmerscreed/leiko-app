// Anomaly events store — Sprint 15.
//
// Holds the family's unacknowledged anomaly_events rows for the
// most-severe-wins banner selector. Server is the source of truth;
// the store hydrates on app launch and exposes mutation helpers that
// write to Supabase and patch the in-memory copy on success.
//
// Per docs/_reference/D13-multi-vitals-constellation-spec.md §11.2:
// the Home banner shows ONE state at a time — the most severe across
// every vital × every family member.

import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { logger } from '../services/analytics/logger';

export type AnomalyVital = 'bp' | 'hr' | 'spo2';
export type AnomalyTier = 'calm_concerned' | 'confirmed_urgent';

export interface AnomalyEvent {
  id: string;
  userId: string;
  familyId: string;
  vital: AnomalyVital;
  tier: AnomalyTier;
  reason: string;
  readingId: string | null;
  triggeredAtSec: number;
  acknowledgedAt: number | null;
  feedbackThumb: -1 | 0 | 1;
}

interface AnomaliesStore {
  events: AnomalyEvent[];
  hydrated: boolean;
  hydrate: (familyId: string) => Promise<void>;
  acknowledge: (eventId: string) => Promise<void>;
  thumb: (eventId: string, value: -1 | 1) => Promise<void>;
  /** Merge a new event into the store. Used by the realtime hook
   *  (when wired) so the banner appears as soon as the cron fires. */
  upsert: (event: AnomalyEvent) => void;
  __resetForTest: () => void;
}

interface AnomalyEventRow {
  id: string;
  user_id: string;
  family_id: string;
  vital_kind: AnomalyVital;
  tier: AnomalyTier;
  reason: string;
  reading_id: string | null;
  triggered_at: string;
  acknowledged_at: string | null;
  feedback_thumb: -1 | 0 | 1;
}

function mapRow(row: AnomalyEventRow): AnomalyEvent {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    vital: row.vital_kind,
    tier: row.tier,
    reason: row.reason,
    readingId: row.reading_id,
    triggeredAtSec: Math.floor(new Date(row.triggered_at).getTime() / 1000),
    acknowledgedAt: row.acknowledged_at
      ? new Date(row.acknowledged_at).getTime()
      : null,
    feedbackThumb: row.feedback_thumb,
  };
}

export const useAnomalies = create<AnomaliesStore>((set, get) => ({
  events: [],
  hydrated: false,

  hydrate: async (familyId) => {
    try {
      const { data, error } = await supabase
        .from('anomaly_events')
        .select(
          'id, user_id, family_id, vital_kind, tier, reason, reading_id, triggered_at, acknowledged_at, feedback_thumb',
        )
        .eq('family_id', familyId)
        .is('acknowledged_at', null)
        .order('triggered_at', { ascending: false })
        .limit(50);
      if (error || !data) {
        set({ hydrated: true });
        return;
      }
      const events = (data as AnomalyEventRow[]).map(mapRow);
      set({ events, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  acknowledge: async (eventId) => {
    const before = get().events;
    set({ events: before.filter((e) => e.id !== eventId) });
    try {
      const { error } = await supabase
        .from('anomaly_events')
        .update({
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', eventId);
      if (error) {
        // Roll back optimistic state on failure.
        set({ events: before });
        return;
      }
      const event = before.find((e) => e.id === eventId);
      if (event) {
        logger.track('anomaly_banner_dismissed', { vital: event.vital });
      }
    } catch {
      set({ events: before });
    }
  },

  thumb: async (eventId, value) => {
    const before = get().events;
    const event = before.find((e) => e.id === eventId);
    if (!event) return;
    set({
      events: before.map((e) =>
        e.id === eventId ? { ...e, feedbackThumb: value } : e,
      ),
    });
    try {
      const { error } = await supabase
        .from('anomaly_events')
        .update({
          feedback_thumb: value,
          feedback_at: new Date().toISOString(),
        })
        .eq('id', eventId);
      if (error) {
        set({ events: before });
        return;
      }
      logger.track('anomaly_feedback', {
        vital: event.vital,
        tier: event.tier,
        thumb: value,
      });

      // Nudge per-family sensitivity asymmetrically per
      // docs/10-anomaly-logic.md §3: −0.02 on thumb up (less sensitive),
      // +0.05 on thumb down (more sensitive). Clamp 0.80–1.50.
      try {
        const delta = value === 1 ? -0.02 : 0.05;
        const { data: famRow } = await supabase
          .from('families')
          .select('anomaly_sensitivity')
          .eq('id', event.familyId)
          .single();
        if (famRow) {
          const current = Number(
            (famRow as { anomaly_sensitivity: number | string }).anomaly_sensitivity,
          );
          const next = Math.max(0.8, Math.min(1.5, current + delta));
          await supabase
            .from('families')
            .update({ anomaly_sensitivity: next })
            .eq('id', event.familyId);
        }
      } catch {
        // Best-effort; sensitivity is convergent, a single missed nudge is fine.
      }
    } catch {
      set({ events: before });
    }
  },

  upsert: (event) => {
    const existing = get().events.find((e) => e.id === event.id);
    if (existing) {
      set({
        events: get().events.map((e) => (e.id === event.id ? event : e)),
      });
    } else {
      set({ events: [event, ...get().events] });
    }
  },

  __resetForTest: () => set({ events: [], hydrated: false }),
}));

// ─────────────────────────────────────────────────────────────────────
// Selectors.

const TIER_RANK: Record<AnomalyTier, number> = {
  calm_concerned: 1,
  confirmed_urgent: 2,
};

/**
 * Most-severe-unacknowledged event in the family. Returns null when
 * the store is empty. Used by Home + ReadingDetail to render the
 * banner.
 */
export function pickMostSevere(events: AnomalyEvent[]): AnomalyEvent | null {
  const unacked = events.filter((e) => e.acknowledgedAt === null);
  if (unacked.length === 0) return null;
  return unacked.reduce((best, e) => {
    if (!best) return e;
    if (TIER_RANK[e.tier] > TIER_RANK[best.tier]) return e;
    if (TIER_RANK[e.tier] < TIER_RANK[best.tier]) return best;
    return e.triggeredAtSec > best.triggeredAtSec ? e : best;
  }, null as AnomalyEvent | null);
}

/**
 * Per-vital most-severe (used by VitalDetail to show its own banner).
 */
export function pickMostSevereForVital(
  events: AnomalyEvent[],
  vital: AnomalyVital,
): AnomalyEvent | null {
  return pickMostSevere(events.filter((e) => e.vital === vital));
}

/**
 * Per-reading anomaly lookup (used by ReadingDetail).
 */
export function findEventForReading(
  events: AnomalyEvent[],
  readingServerId: string,
): AnomalyEvent | null {
  return events.find(
    (e) => e.acknowledgedAt === null && e.readingId === readingServerId,
  ) ?? null;
}
