// Sprint 7 — caregiver-home data fetch.
//
// "One ReadingCard per parent" per docs/04-screens/caregiver-home.md.
// In data terms: one ParentSummary per family the signed-in user is
// an active member of. Each summary carries the parent's display
// name + relationship (the families row) and the most recent few
// readings (powering the latest-numeric + 7-day sparkline).
//
// Pure async function — takes a SupabaseClient so it's mockable in
// tests. The React hook in hooks/useFamilyReadings.ts wraps this in
// TanStack Query + a Realtime subscription.
//
// Per docs/01-data-model.md the readings table is family-scoped, not
// user-scoped (parent's reading row joins to family_id, never
// user_id). Membership decides who can read it via RLS; the query
// itself doesn't need to filter by user_id.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const PER_PARENT_READING_LIMIT = 14; // ~2 weeks of once-daily; powers 7-day sparkline + buffer

export interface ReadingSummary {
  id: string;
  measuredAt: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  qualityScore: 'good' | 'fair' | 'suspect' | null;
}

export interface ParentSummary {
  familyId: string;
  parentDisplayName: string;
  parentRelationship: string;
  parentYearOfBirth: number | null;
  /** Most recent reading; null if none yet. */
  latestReading: ReadingSummary | null;
  /** Newest-first; up to PER_PARENT_READING_LIMIT entries. Drives the sparkline. */
  recentReadings: ReadingSummary[];
}

export async function fetchParentSummaries(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<ParentSummary[]> {
  // family_members is the membership join. We fetch the user's active
  // memberships, then for each family pull the parent profile from
  // families and the most-recent N readings. Two round trips total
  // (one for memberships+families, one for readings); a single nested
  // select is also possible but the readings ordering + limit applied
  // per-family is more reliably expressed with two queries.
  const { data: memberships, error: memberErr } = await client
    .from('family_members')
    .select(
      `family_id,
       families!inner(id, parent_display_name, parent_relationship, parent_year_of_birth)`,
    )
    .eq('user_id', userId)
    .is('removed_at', null);

  if (memberErr) throw memberErr;
  if (!memberships || memberships.length === 0) return [];

  const familyIds = memberships.map((m) => m.family_id);

  const { data: readingRows, error: readingsErr } = await client
    .from('readings')
    .select('id, family_id, measured_at, systolic, diastolic, pulse, quality_score')
    .in('family_id', familyIds)
    .eq('hidden', false)
    .order('measured_at', { ascending: false });

  if (readingsErr) throw readingsErr;

  const readingsByFamily = new Map<string, ReadingSummary[]>();
  for (const r of readingRows ?? []) {
    const list = readingsByFamily.get(r.family_id) ?? [];
    if (list.length < PER_PARENT_READING_LIMIT) {
      list.push({
        id: r.id,
        measuredAt: r.measured_at,
        systolic: r.systolic,
        diastolic: r.diastolic,
        pulse: r.pulse,
        qualityScore: r.quality_score,
      });
      readingsByFamily.set(r.family_id, list);
    }
  }

  const summaries: ParentSummary[] = memberships.map((m) => {
    // Supabase types `families` as a single object via the !inner join,
    // but the runtime can return an array shape if the inferred shape
    // chooses array. Normalise.
    const fam = Array.isArray(m.families) ? m.families[0] : m.families;
    const recent = readingsByFamily.get(m.family_id) ?? [];
    return {
      familyId: m.family_id,
      parentDisplayName: fam?.parent_display_name ?? '',
      parentRelationship: fam?.parent_relationship ?? '',
      parentYearOfBirth: fam?.parent_year_of_birth ?? null,
      latestReading: recent[0] ?? null,
      recentReadings: recent,
    };
  });

  // Most-active parents first (latest reading at top); parents without
  // any readings sink to the bottom so the empty-readings card doesn't
  // dominate above an active one.
  summaries.sort((a, b) => {
    const aMs = a.latestReading ? Date.parse(a.latestReading.measuredAt) : 0;
    const bMs = b.latestReading ? Date.parse(b.latestReading.measuredAt) : 0;
    return bMs - aMs;
  });

  return summaries;
}
