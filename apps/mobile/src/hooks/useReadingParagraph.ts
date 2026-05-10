// hooks/useReadingParagraph — Sprint 12.5 session 2.
//
// Provides the contextual paragraph for a single reading-detail
// screen. Tier-A only at v1.0; Tier-B novel-pattern path lands in
// a later session through an Edge Function.
//
// Cache: per-reading_id forever (D14 §4.3). MMKV-keyed; same as
// daily narration cache architecturally but no TTL — once a
// reading paragraph is generated, the data behind it never
// changes (the reading is immutable per D8a §7).

import { useMemo } from 'react';
import { useAuth } from '../state/auth';
import { useReadings, type LocalReading } from '../state/readings';
import { useSleep } from '../state/sleep';
import { mmkv } from '../services/storage';
import { logger } from '../services/analytics/logger';
import {
  generateReadingParagraphTierA,
  type ReadingParagraphResult,
} from '../services/ai/readingParagraph';

const SECONDS_PER_DAY = 24 * 60 * 60;

interface CachedParagraph {
  text: string;
  templateId: string;
  tier: 'A';
}

function cacheKey(readingId: string): string {
  return `leiko.ai.readingParagraph.${readingId}`;
}

function readCache(readingId: string): CachedParagraph | null {
  const raw = mmkv.getString(cacheKey(readingId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedParagraph;
    if (typeof parsed.text === 'string' && typeof parsed.templateId === 'string') {
      return parsed;
    }
  } catch {
    // fall-through
  }
  return null;
}

function writeCache(readingId: string, value: CachedParagraph): void {
  try {
    mmkv.set(cacheKey(readingId), JSON.stringify(value));
  } catch {
    // MMKV write failure is non-fatal — regenerate next paint.
  }
}

/**
 * Compute a 7-day mean systolic from the recent-reading buffer.
 * Returns null when there are fewer than 3 visible readings in the
 * window — too small a baseline produces noisy delta words.
 */
function computeWeekAverageSystolic(
  recent: LocalReading[],
  excludeId: string,
  nowSec: number,
): number | null {
  const cutoff = nowSec - 7 * SECONDS_PER_DAY;
  const sample = recent.filter(
    (r) =>
      r.localId !== excludeId &&
      r.measuredAtSec >= cutoff &&
      // hidden readings shouldn't influence the baseline.
      !(r as { hidden?: boolean }).hidden,
  );
  if (sample.length < 3) return null;
  const sum = sample.reduce((a, r) => a + r.systolic, 0);
  return Math.round(sum / sample.length);
}

export function useReadingParagraph(
  reading: LocalReading | null | undefined,
): ReadingParagraphResult | null {
  const profile = useAuth((s) => s.profile);
  const recent = useReadings((s) => s.recent);
  const sleepLastNight = useSleep((s) =>
    reading ? s.lastNightSession(reading.measuredAtSec) : null,
  );

  return useMemo(() => {
    if (!reading || !profile) return null;

    const cached = readCache(reading.localId);
    if (cached) return cached;

    const weekAvg = computeWeekAverageSystolic(recent, reading.localId, reading.measuredAtSec);
    const sleepTotal = sleepLastNight?.totalMinutes ?? null;
    // Sleep is "concerning" for the correlation template when the
    // last-night total is < 6h.
    const sleepConcerning = sleepTotal !== null && sleepTotal < 360;

    const parentLabel = profile.display_name || 'You';

    const result = generateReadingParagraphTierA({
      reading,
      classification: reading.classification,
      parentLabel,
      weekAverageSystolic: weekAvg,
      sleepTotalMinutes: sleepTotal,
      sleepConcerning,
    });

    writeCache(reading.localId, {
      text: result.text,
      templateId: result.templateId,
      tier: result.tier,
    });
    logger.track('reading_paragraph_generated', {
      tier: result.tier,
      template_id: result.templateId,
    });

    return result;
  }, [reading, profile, recent, sleepLastNight]);
}
