// hooks/useDailyNarration — Sprint 12.5 session 1.
//
// Returns the daily AI narration string for Home screens. Replaces
// the PLACEHOLDER_AI_NARRATION constant Sprint 8 + Sprint 7.7
// shipped as the home-screen first-line. Tier-A ALWAYS runs through
// here; the Tier-B novel-pattern path lands in session 2 via the
// ai-daily-narration Edge Function.
//
// Cache contract:
//   key   = `leiko.ai.dailyNarration.<userId>.<YYYY-MM-DD>`
//   value = JSON { text, templateId, tier, generatedAtSec }
//   TTL   = 4h (D14 Q-D14-4); after that the hook regenerates.
//
// Cache invalidation is TTL-only per the architecture answer to the
// Sprint 12.5 card's open prompt: new readings mid-day do NOT
// invalidate. Pull-to-refresh on Home re-renders the screen which
// re-evaluates the hook; if the cache is still fresh that returns
// the same body — pull-to-refresh forces a regenerate by clearing
// the cache via `clearDailyNarrationCache` (exposed for the screen
// to call from its onRefresh handler).

import { useMemo } from 'react';
import { useAuth } from '../state/auth';
import { useDailyPulseData } from '../state/dailyPulse';
import { mmkv } from '../services/storage';
import { logger } from '../services/analytics/logger';
import {
  generateDailyNarrationTierA,
  type DailyNarrationResult,
} from '../services/ai/dailyNarration';

const FOUR_HOURS_SEC = 4 * 60 * 60;

interface CachedNarration {
  text: string;
  templateId: string;
  tier: 'A';
  generatedAtSec: number;
}

function cacheKey(userId: string, date: string): string {
  return `leiko.ai.dailyNarration.${userId}.${date}`;
}

function readCache(key: string, nowSec: number): CachedNarration | null {
  const raw = mmkv.getString(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedNarration;
    if (typeof parsed.text !== 'string' || typeof parsed.generatedAtSec !== 'number') {
      return null;
    }
    if (nowSec - parsed.generatedAtSec > FOUR_HOURS_SEC) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: CachedNarration): void {
  try {
    mmkv.set(key, JSON.stringify(value));
  } catch {
    // MMKV write failure is non-fatal — the worst case is we
    // regenerate next paint, which costs ~0ms (Tier-A is local).
  }
}

/** Test-only escape hatch — clears today's cache so the next call regenerates. */
export function clearDailyNarrationCacheForTest(userId: string, date: string): void {
  mmkv.remove(cacheKey(userId, date));
}

/** Production: clear today's cache from a pull-to-refresh handler. */
export function clearDailyNarrationCache(userId: string, date: string): void {
  mmkv.remove(cacheKey(userId, date));
}

export interface UseDailyNarrationOptions {
  /** Inject "now" for tests (unix sec). */
  nowSec?: number;
}

/**
 * Returns a narration string + the tier that produced it. Falls
 * back to a PLACEHOLDER string only when the user has no signed-in
 * profile yet (the first paint after auth flips); production code
 * should rarely see that branch.
 */
export function useDailyNarration(
  options: UseDailyNarrationOptions = {},
): DailyNarrationResult {
  const profile = useAuth((s) => s.profile);
  const data = useDailyPulseData(options.nowSec);
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);

  return useMemo(() => {
    if (!profile) {
      return { text: 'Your daily pulse is here.', templateId: 'pre-auth', tier: 'A' };
    }

    const userId = profile.id;
    const date = data.todayDateLocal;
    const key = cacheKey(userId, date);

    const cached = readCache(key, nowSec);
    if (cached) {
      return { text: cached.text, templateId: cached.templateId, tier: cached.tier };
    }

    // Pick the parent label per account_type — caregiver mode uses
    // the parent's display name from `families` but that's not in
    // `useAuth`. For Sprint 12.5 session 1 we use the user's own
    // display_name as a placeholder; session 2's caregiver-aware
    // path will load `families.parent_display_name` and pass it
    // explicitly. Self-buyer always wants the user's own name.
    const parentLabel = profile.display_name || 'You';

    const result = generateDailyNarrationTierA({
      data,
      parentLabel,
      accountType: profile.account_type,
    });

    writeCache(key, {
      text: result.text,
      templateId: result.templateId,
      tier: result.tier,
      generatedAtSec: nowSec,
    });
    logger.track('daily_narration_generated', {
      tier: result.tier,
      template_id: result.templateId,
    });

    return result;
  }, [profile, data, nowSec]);
}
