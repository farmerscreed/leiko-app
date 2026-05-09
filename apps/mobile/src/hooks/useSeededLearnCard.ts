// useSeededLearnCard — Sprint 14 task 5 / 6.
//
// One hook that reads the data side (first BP reading, vital states,
// timezone) and the persistence side (dismiss/read tracking) and
// returns the article to surface in the home-card slot — or null
// when the slot should stay empty.
//
// Caller mounts <HomeLearnCard /> with the returned article and
// passes the returned `onArticleOpen` / `onDismiss` callbacks.

import { useCallback, useMemo } from 'react';
import { useReadings } from '../state/readings';
import { useAuth } from '../state/auth';
import { useDailyPulseData } from '../state/dailyPulse';
import { useLearnSeed } from '../state/learnSeed';
import { ARTICLES } from '../learn/articleIndex.gen';
import { getDayIndex } from '../services/learn/dayIndex';
import {
  selectSeededCard,
  type LearnConcernState,
  type SeedSelectionInput,
} from '../services/learn/seedSelection';
import type { CompiledArticle } from '../services/learn/ast';
import type { ClassificationTier } from '../utils/classification';

export interface UseSeededLearnCardResult {
  article: CompiledArticle | null;
  onArticleOpen: (articleId: string) => void;
  onDismiss: (articleId: string) => void;
}

export function useSeededLearnCard(): UseSeededLearnCardResult {
  const tracking = useLearnSeed(s => s.tracking);
  const markRead = useLearnSeed(s => s.markRead);
  const markDismissed = useLearnSeed(s => s.markDismissed);

  const profile = useAuth(s => s.profile);
  const data = useDailyPulseData();

  const allReadings = useReadings(s => [...s.recent, ...s.pending]);
  const firstReadingMs = useMemo(() => {
    if (allReadings.length === 0) return null;
    let oldest = allReadings[0].measuredAtSec;
    for (const r of allReadings) {
      if (r.measuredAtSec < oldest) oldest = r.measuredAtSec;
    }
    return oldest * 1000;
  }, [allReadings]);

  const article = useMemo<CompiledArticle | null>(() => {
    if (firstReadingMs === null) return null;
    const dayIndex = getDayIndex(
      Math.floor(firstReadingMs / 1000),
      Date.now(),
      profile?.timezone ?? null,
    );
    if (dayIndex === null) return null;

    const input: SeedSelectionInput = {
      articles: ARTICLES,
      dayIndex,
      bpReading: data.bp.latest
        ? { systolic: data.bp.latest.systolic, diastolic: data.bp.latest.diastolic }
        : null,
      vitalStates: {
        bp: tierToConcern(data.bp.classification?.tier ?? null),
        hr: tierToConcern(data.hr.classification?.tier ?? null),
        spo2: tierToConcern(data.spo2.classification?.tier ?? null),
        sleep: undefined,
        activity: undefined,
      },
      meaningfulCorrelations: [],
      isHidden: (id) => isHiddenInTracking(tracking, id),
      hasEverBeenRead: (id) => Boolean(tracking[id]?.readAt),
      // No country field on the profile at v1.0; region routing is a
      // no-op anyway. The hook is in place for when locale/region land.
      region: null,
    };
    return selectSeededCard(input);
  }, [
    firstReadingMs,
    profile?.timezone,
    data.bp.latest,
    data.bp.classification,
    data.hr.classification,
    data.spo2.classification,
    tracking,
  ]);

  const onArticleOpen = useCallback(
    (id: string) => {
      markRead(id);
    },
    [markRead],
  );

  const onDismiss = useCallback(
    (id: string) => {
      markDismissed(id);
    },
    [markDismissed],
  );

  return { article, onArticleOpen, onDismiss };
}

// -----------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------

function tierToConcern(
  tier: ClassificationTier | null | undefined,
): LearnConcernState | undefined {
  if (tier === 'calm_concerned' || tier === 'confirmed_urgent') return tier;
  return undefined;
}

function isHiddenInTracking(
  tracking: ReturnType<typeof useLearnSeed.getState>['tracking'],
  id: string,
): boolean {
  const entry = tracking[id];
  if (!entry) return false;
  const now = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  if (entry.dismissedAt !== null && now - entry.dismissedAt < 30 * MS_PER_DAY) {
    return true;
  }
  if (entry.readAt !== null && now - entry.readAt < 90 * MS_PER_DAY) {
    return true;
  }
  return false;
}
