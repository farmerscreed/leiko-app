// useCaregiverFamily — Sprint 7.7a (caregiver Family Constellation).
//
// Thin wrapper around useFamilyReadings that derives the per-person
// shape the bird's-eye view consumes (CaregiverPerson[]). Keeps the
// existing useFamilyReadings + ParentSummary contract intact so the
// legacy CaregiverHome.legacy.tsx + ReadingCard render paths continue
// to work without surgery.
//
// The mapping itself is a pure function in utils/caregiverPerson.ts,
// memoised here against the parents reference. `now` is evaluated on
// every render — the staleness check needs the current wall clock —
// but the React-Query-cached parents reference is stable until the
// next refetch, so memoisation is on the parents object identity.

import { useMemo } from 'react';
import {
  useFamilyReadings,
  type UseFamilyReadingsResult,
} from './useFamilyReadings';
import {
  caregiverPeopleFromParents,
  type CaregiverPerson,
} from '../utils/caregiverPerson';

export interface UseCaregiverFamilyResult
  extends Omit<UseFamilyReadingsResult, 'parents'> {
  /** Same shape that ConstellationField + ConstellationLegend consume. */
  people: CaregiverPerson[];
  /** Underlying parent-summary list, preserved for callers that still
   *  need the legacy shape (drill-in routing, ReadingCard fallback). */
  parents: UseFamilyReadingsResult['parents'];
}

export function useCaregiverFamily(): UseCaregiverFamilyResult {
  const { parents, isLoading, isRefreshing, error, refresh } = useFamilyReadings();

  const people = useMemo(
    // Date.now() evaluates per render — parents identity is the cache key.
    () => caregiverPeopleFromParents(parents, Date.now()),
    [parents],
  );

  return { parents, people, isLoading, isRefreshing, error, refresh };
}
