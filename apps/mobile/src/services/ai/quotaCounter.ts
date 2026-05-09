// AI Tier-B quota counter — Sprint 10b.2.
//
// Per docs/_reference/D14-ambient-ai-architecture.md §14.1:
//
//   Tier B (user-asked)     : Free 5/month, Plus 100/month
//
// AI Tier-B itself doesn't ship until Sprint 11. This module lays the
// counter infrastructure so the Settings → AI surface has live data
// when it lands. Until then, the counter reads zero.
//
// Source of truth: public.audit_log entries with action='ai.user_question'
// and actor_user_id = signed-in user, occurred_at >= start of the
// caller's calendar month. RLS already permits "self reads own audit".
//
// Cache strategy: MMKV-backed per-user-per-month counter. UI reads
// the cache for instant render; reconcileFromAuditLog refreshes from
// Supabase on app foreground. The cache is monotonically non-decreasing
// within a month — a network blip can't down-count a real value the
// user already saw.

import type { SupabaseClient } from '@supabase/supabase-js';
import { mmkv, STORAGE_KEYS } from '../storage';
import { supabase as defaultSupabase } from '../supabase';
import type { Database, SubscriptionStatus } from '../../types/database';

export const FREE_TIER_QUOTA = 5;
export const PLUS_TIER_QUOTA = 100;

export interface QuotaSnapshot {
  /** Number of Tier-B AI questions consumed this calendar month. */
  count: number;
  /** Quota ceiling for the active subscription tier. */
  limit: number;
  /** YYYY-MM (the calendar-month key the count belongs to). */
  monthKey: string;
  /** unix-ms of the last successful audit_log reconcile, or null when
   *  the counter has never reconciled. */
  lastReconcileMs: number | null;
}

interface CachedQuota {
  monthKey: string;
  count: number;
  lastReconcileMs: number;
}

function currentMonthKey(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function startOfMonthIso(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function cacheKey(userId: string): string {
  return `${STORAGE_KEYS.aiQuotaCounter}.${userId}`;
}

function readCache(userId: string): CachedQuota | null {
  const raw = mmkv.getString(cacheKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedQuota>;
    if (
      typeof parsed.monthKey === 'string' &&
      typeof parsed.count === 'number' &&
      typeof parsed.lastReconcileMs === 'number'
    ) {
      return {
        monthKey: parsed.monthKey,
        count: parsed.count,
        lastReconcileMs: parsed.lastReconcileMs,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, value: CachedQuota): void {
  mmkv.set(cacheKey(userId), JSON.stringify(value));
}

export function quotaForTier(tier: SubscriptionStatus): number {
  return tier === 'plus' || tier === 'plus_trial' || tier === 'plus_grace'
    ? PLUS_TIER_QUOTA
    : FREE_TIER_QUOTA;
}

/**
 * Returns the current snapshot for the user. Pure cache read — does
 * NOT hit the network. Returns 0/0 if the cache is empty for this
 * month.
 */
export function getQuotaSnapshot(
  userId: string,
  tier: SubscriptionStatus,
): QuotaSnapshot {
  const month = currentMonthKey();
  const cached = readCache(userId);
  const count = cached && cached.monthKey === month ? cached.count : 0;
  return {
    count,
    limit: quotaForTier(tier),
    monthKey: month,
    lastReconcileMs: cached?.lastReconcileMs ?? null,
  };
}

/**
 * Refresh the counter from Supabase audit_log. Idempotent + safe to
 * call on every app foreground. The supabase client argument exists
 * for tests; production callers use the singleton.
 */
export async function reconcileFromAuditLog(
  userId: string,
  client: SupabaseClient<Database> = defaultSupabase,
): Promise<number> {
  const month = currentMonthKey();
  const since = startOfMonthIso();
  const { count, error } = await client
    .from('audit_log')
    // Ask for an exact head-only count — we don't need the rows, just the cardinality.
    .select('id', { count: 'exact', head: true })
    .eq('actor_user_id', userId)
    .eq('action', 'ai.user_question')
    .gte('occurred_at', since);
  if (error) throw error;
  const fresh = count ?? 0;
  // Monotone within a month — never overwrite a higher cached count
  // with a smaller refetch (handles brief audit-log lag where a row
  // exists locally before its UTC offset crosses into "this month").
  const existing = readCache(userId);
  const persistedCount =
    existing && existing.monthKey === month
      ? Math.max(existing.count, fresh)
      : fresh;
  writeCache(userId, {
    monthKey: month,
    count: persistedCount,
    lastReconcileMs: Date.now(),
  });
  return persistedCount;
}

/**
 * Increment the local counter. Called by the AI surface immediately
 * after a Tier-B query completes — gives the UI an instant update,
 * without waiting for the next reconcile. The audit-log row written
 * server-side is the eventual source of truth.
 */
export function incrementLocal(userId: string): void {
  const month = currentMonthKey();
  const existing = readCache(userId);
  const nextCount =
    existing && existing.monthKey === month ? existing.count + 1 : 1;
  writeCache(userId, {
    monthKey: month,
    count: nextCount,
    lastReconcileMs: existing?.lastReconcileMs ?? Date.now(),
  });
}

// Test surface ---------------------------------------------------------
export const _internals = { currentMonthKey, cacheKey, readCache };
