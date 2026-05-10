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

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../state/auth';
import { useDailyPulseData } from '../state/dailyPulse';
import { mmkv } from '../services/storage';
import { supabase } from '../services/supabase';
import { logger } from '../services/analytics/logger';
import { usePlusEntitlement } from './usePlusEntitlement';
import {
  generateDailyNarrationTierA,
  type DailyNarrationResult,
} from '../services/ai/dailyNarration';

const FOUR_HOURS_SEC = 4 * 60 * 60;

interface CachedNarration {
  text: string;
  templateId: string;
  tier: 'A' | 'B';
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
 * Returns a narration string + the tier that produced it.
 *
 * Self-buyer flow:
 *   1. Read MMKV cache (any tier). Hit + ≤4h → return.
 *   2. Render Tier-A locally for instant first paint (returns
 *      synchronously).
 *   3. If isPlus → fire-and-forget call to ai-daily-narration EF.
 *      The EF either confirms Tier-A (no-novel-pattern) or returns
 *      a Tier-B body. On Tier-B: rewrite the cache with the new
 *      body so the next paint shows the upgraded narration.
 *
 * Architectural note: Tier-A is rendered synchronously so the
 * Home first-paint never has to wait on a network round-trip
 * (D14 §3.5 — "the first impression of 'Leiko knows me'"). The
 * Tier-B upgrade happens asynchronously and the narration card
 * re-renders when the cache write triggers a new value.
 */
export function useDailyNarration(
  options: UseDailyNarrationOptions = {},
): DailyNarrationResult {
  const profile = useAuth((s) => s.profile);
  const data = useDailyPulseData(options.nowSec);
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const { isPlus } = usePlusEntitlement();

  // Synchronous first-paint: the synchronous result the hook
  // returns. Tier-B refinement (when applicable) flows through the
  // tierBOverride state below.
  const synchronous = useMemo<DailyNarrationResult>(() => {
    if (!profile) {
      return { text: 'Your daily pulse is here.', templateId: 'pre-auth', tier: 'A' };
    }
    const userId = profile.id;
    const date = data.todayDateLocal;
    const key = cacheKey(userId, date);

    const cached = readCache(key, nowSec);
    if (cached) {
      return {
        text: cached.text,
        templateId: cached.templateId,
        tier: cached.tier as 'A',
      };
    }

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

  // Async Tier-B path. Lives in state so the hook re-renders when
  // the EF call returns a richer narration. Only fires for Plus
  // users; free users render Tier-A and we never make the round-
  // trip (saves the EF cold-start cost on every Home paint).
  const [tierBOverride, setTierBOverride] = useState<DailyNarrationResult | null>(null);

  useEffect(() => {
    if (!profile || !isPlus) {
      setTierBOverride(null);
      return;
    }
    const userId = profile.id;
    const date = data.todayDateLocal;
    const key = cacheKey(userId, date);

    // If MMKV already has a Tier-B cached row for today, no need to
    // call the EF again — its server-side cache would just echo it.
    const cached = readCache(key, nowSec);
    if (cached?.tier === 'B') {
      setTierBOverride({
        text: cached.text,
        templateId: cached.templateId,
        tier: 'B' as never,
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { data: efData, error } = await supabase.functions.invoke<{
          status: 'ok' | 'tier_a_recommended' | 'error';
          body?: string;
          tier?: string;
          messageId?: string;
        }>('ai-daily-narration', { body: { scopeKey: date } });
        if (cancelled || error || !efData) return;
        if (efData.status === 'ok' && typeof efData.body === 'string') {
          // Upgrade the cache to Tier-B so subsequent paints show it
          // immediately without re-calling the EF.
          writeCache(key, {
            text: efData.body,
            templateId: 'tier-b-haiku-4-5',
            tier: 'B',
            generatedAtSec: nowSec,
          });
          setTierBOverride({
            text: efData.body,
            templateId: 'tier-b-haiku-4-5',
            tier: 'B' as never,
          });
          logger.track('daily_narration_generated', {
            tier: 'B',
            template_id: 'tier-b-haiku-4-5',
          });
        }
        // status === 'tier_a_recommended' → keep the local Tier-A
        // narration. No state change needed.
      } catch {
        // Network failure / timeout — keep the local Tier-A narration.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, isPlus, data.todayDateLocal, nowSec]);

  return tierBOverride ?? synchronous;
}
