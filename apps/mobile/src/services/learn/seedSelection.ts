// Learn module — seeded home-card selection algorithm. Sprint 14 task 3.
//
// Pure deterministic function. Given:
//   - the article corpus
//   - the user's day-index since first reading
//   - current vital classifications
//   - any meaningful cross-vital correlations
//   - the dismiss / read hide map
//   - the user's region
//
// returns ONE article id to surface in the home-card slot, or null
// if nothing fits.
//
// Sourced from:
//   plans/sprint-14-learn-c.md (priority weighting open prompt — founder
//     approved the 1→4 order on 2026-05-09)
//   docs/_reference/D9-editorial.md §5.2 (Day 0/3/7/14 fixed sequence)
//   docs/08-learn-module.md §6 (reading-context tier mapping)
//
// Priority order (highest first):
//   1. Vital-state relevance — surface the article that matches the
//      most concerning vital state. Within multiple concerns, follow
//      the same ordering D14 §3.3 uses for narration: BP > HR > SpO2 > sleep.
//   2. Correlation freshness — surface the correlation card that
//      maps to the active correlation.
//   3. Day-index target — D9 §5.2 schedule.
//   4. Cluster rotation — first unread/un-dismissed candidate from a
//      cluster the user has not seen recently. Stable ordering by id.
//
// Each step skips articles that are currently inside a dismiss or
// read hide window (`isHidden`). The day-index target ALSO skips
// articles the user has already opened at any point — that handshake
// uses `hasEverBeenRead` so a Day-7 surfacing of numbers-002 doesn't
// re-fire after the 90-day window has lapsed.

import type { CompiledArticle } from './ast';
import { bpTier, type ArticleCategory, type BPTier } from './types';

/** A subset of D13 §6 — `in_pattern` is the calm baseline; the
 *  algorithm only acts on the two non-baseline tiers. */
export type LearnConcernState = 'calm_concerned' | 'confirmed_urgent';

export type CorrelationKind = 'sleep_bp' | 'activity_hr' | 'reading_patterns';

export interface SeedSelectionInput {
  articles: ReadonlyArray<CompiledArticle>;
  /** null when no first reading has happened yet — the slot stays empty. */
  dayIndex: number | null;
  /** Optional latest BP reading — used to pick the matching tier
   *  article when bp state is concerning. */
  bpReading?: { systolic: number; diastolic: number } | null;
  /** Vital classifications. Missing = treat as in_pattern. */
  vitalStates?: Partial<Record<'bp' | 'hr' | 'spo2' | 'sleep' | 'activity', LearnConcernState>>;
  /** Cross-vital correlations the engine has flagged as meaningful. */
  meaningfulCorrelations?: ReadonlyArray<CorrelationKind>;
  /** Returns true when the article is inside an active dismiss/read window. */
  isHidden: (articleId: string) => boolean;
  /** Returns true when the article was opened at any point. */
  hasEverBeenRead?: (articleId: string) => boolean;
  /** ISO country code. v1.0 ships region routing as a no-op. */
  region?: string | null;
}

export function selectSeededCard(
  input: SeedSelectionInput,
): CompiledArticle | null {
  if (input.dayIndex === null) return null;

  const byId: Record<string, CompiledArticle> = {};
  for (const a of input.articles) byId[a.frontmatter.id] = a;

  const tryPick = (id: string): CompiledArticle | null => {
    const a = byId[id];
    if (!a) return null;
    if (input.isHidden(id)) return null;
    return a;
  };

  // ---------------------------------------------------------------
  // Priority 1 — vital-state relevance.
  //
  // Highest-weighted concerning vital wins. The cardinal ordering
  // mirrors D14 §3.3 (BP first, then HR, SpO2, sleep, activity).
  // ---------------------------------------------------------------
  const states = input.vitalStates ?? {};
  if (states.bp === 'calm_concerned' || states.bp === 'confirmed_urgent') {
    const id = pickBpArticleForState(input.bpReading);
    const picked = tryPick(id);
    if (picked) return picked;
  }
  if (states.hr === 'calm_concerned' || states.hr === 'confirmed_urgent') {
    const picked = tryPick('hr-002');
    if (picked) return picked;
  }
  if (states.spo2 === 'calm_concerned' || states.spo2 === 'confirmed_urgent') {
    const picked = tryPick('spo2-002');
    if (picked) return picked;
  }
  if (states.sleep === 'calm_concerned' || states.sleep === 'confirmed_urgent') {
    const picked = tryPick('sleep-002');
    if (picked) return picked;
  }
  if (states.activity === 'calm_concerned' || states.activity === 'confirmed_urgent') {
    const picked = tryPick('activity-001');
    if (picked) return picked;
  }

  // ---------------------------------------------------------------
  // Priority 2 — correlation freshness.
  // ---------------------------------------------------------------
  const correlations = input.meaningfulCorrelations ?? [];
  if (correlations.includes('sleep_bp')) {
    const picked = tryPick('corr-001');
    if (picked) return picked;
  }
  if (correlations.includes('activity_hr')) {
    const picked = tryPick('corr-002');
    if (picked) return picked;
  }
  if (correlations.includes('reading_patterns')) {
    const picked = tryPick('corr-003');
    if (picked) return picked;
  }

  // ---------------------------------------------------------------
  // Priority 3 — day-index fixed sequence (D9 §5.2 + Sprint 14
  // approved option A).
  //
  // Day 0–2: numbers-001 ("What is blood pressure?")
  // Day 3:   changes-001 ("Why morning BP is higher")
  // Day 7:   numbers-002 ("What 'elevated' means")
  // Day 14:  doctor-001  ("What to bring to your doctor visit")
  //
  // Days 4–6 and 8–13 fall through to priority 4. The day-index
  // target is skipped if the user has already read it (the spec
  // says the seed should not re-surface the same intro card).
  // ---------------------------------------------------------------
  const everRead = input.hasEverBeenRead ?? (() => false);
  const dayTarget = dayIndexTarget(input.dayIndex);
  if (dayTarget && !everRead(dayTarget)) {
    const picked = tryPick(dayTarget);
    if (picked) return picked;
  }

  // ---------------------------------------------------------------
  // Priority 4 — cluster rotation fallback.
  //
  // Pick the first article (by stable id) that is not hidden and
  // not yet read, biased toward clusters with priority-1
  // intro cards. Skips region-gated articles per simple country
  // routing (no-op at v1.0; CULTURAL becomes the NG bias once
  // those articles arrive).
  // ---------------------------------------------------------------
  const ranked = [...input.articles]
    .filter(a => !input.isHidden(a.frontmatter.id))
    .filter(a => !everRead(a.frontmatter.id))
    .filter(a => isRegionAllowed(a.frontmatter.category, input.region))
    .sort((a, b) => {
      const ap = a.frontmatter.inline_explainer_priority;
      const bp = b.frontmatter.inline_explainer_priority;
      if (ap !== bp) return ap - bp;
      return a.frontmatter.id.localeCompare(b.frontmatter.id);
    });
  return ranked[0] ?? null;
}

// -----------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------

function pickBpArticleForState(
  reading: SeedSelectionInput['bpReading'],
): string {
  if (!reading) return 'numbers-002';
  const tier: BPTier = bpTier(reading);
  switch (tier) {
    case 'crisis':
      return 'numbers-007';
    case 'stage2':
      return 'numbers-004';
    case 'stage1':
      return 'numbers-003';
    case 'elevated':
      return 'numbers-002';
    case 'normal':
      return 'numbers-001';
  }
}

function dayIndexTarget(dayIndex: number): string | null {
  if (dayIndex >= 0 && dayIndex <= 2) return 'numbers-001';
  if (dayIndex === 3) return 'changes-001';
  if (dayIndex === 7) return 'numbers-002';
  if (dayIndex === 14) return 'doctor-001';
  return null;
}

/**
 * Region routing — v1.0 ships as a no-op. Every article is allowed
 * for every region. The hook is in place so when CULTURAL articles
 * land for Nigerian readers the routing can prefer them without a
 * downstream refactor.
 */
function isRegionAllowed(
  _category: ArticleCategory,
  _region: string | null | undefined,
): boolean {
  return true;
}
