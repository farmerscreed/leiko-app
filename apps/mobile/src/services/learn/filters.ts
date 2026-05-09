// Learn module — pure filter functions. Sprint 13 task 3.
//
// All filters operate on Article[] and return filtered Article[]. They
// are pure, deterministic, and dependency-free so they run identically
// in tests, in the Inline Explainer card-selection on device, and in
// the build script.
//
// Sourced from:
//   docs/08-learn-module.md §6 (reading-context overlap, tier mapping,
//     selection algorithm)
//   D8a §2.3 (mode_relevance — self vs caregiver vs hybrid)
//   docs/_reference/D14-ambient-ai-architecture.md §10 (clinical
//     review gating for production builds)

import type {
  Article,
  Audience,
  ModeRelevance,
  ReadingContext,
  BPTier,
} from './types';
import { bpTier } from './types';

// -----------------------------------------------------------------
// Audience + mode filters.
// -----------------------------------------------------------------

export function filterByAudience(
  articles: Article[],
  audience: Audience,
): Article[] {
  return articles.filter(a => a.frontmatter.audience.includes(audience));
}

export function filterByModeRelevance(
  articles: Article[],
  mode: ModeRelevance,
): Article[] {
  return articles.filter(a => a.frontmatter.mode_relevance.includes(mode));
}

// -----------------------------------------------------------------
// Clinical-review gate.
//
// In PRODUCTION, an article that says clinical_review_required: true
// is hidden until a reviewer fills in clinical_reviewed_at. In DEV
// builds, callers pass `dev: true` to see all articles (the screen
// surfaces a small [unreviewed] badge per Sprint 13 plan).
// -----------------------------------------------------------------

export interface ClinicalReviewOptions {
  /**
   * When true, unreviewed Cluster A articles are returned alongside
   * reviewed ones. Production callers pass false (or omit). Dev
   * builds + tooling pass true.
   */
  dev?: boolean;
}

export function filterByClinicalReviewGate(
  articles: Article[],
  options: ClinicalReviewOptions = {},
): Article[] {
  if (options.dev) return articles;
  return articles.filter(a => {
    const fm = a.frontmatter;
    if (!fm.clinical_review_required) return true;
    return typeof fm.clinical_reviewed_at === 'string';
  });
}

/**
 * Tag each article with a flag the UI can read to render the
 * "[unreviewed]" badge. Dev-only — the production gate strips these
 * articles entirely.
 */
export function isUnreviewedClusterA(article: Article): boolean {
  return (
    article.frontmatter.clinical_review_required &&
    article.frontmatter.clinical_reviewed_at === null
  );
}

// -----------------------------------------------------------------
// Reading-context overlap.
// -----------------------------------------------------------------

export interface BPReading {
  systolic: number;
  diastolic: number;
}

/**
 * Does this reading fall inside the article's reading-context window?
 * Used by the Inline Explainer when the user taps "What does this
 * mean?" on a specific reading.
 */
export function readingContextMatches(
  reading: BPReading,
  ctx: ReadingContext,
): boolean {
  return (
    reading.systolic >= ctx.systolic_min &&
    reading.systolic <= ctx.systolic_max &&
    reading.diastolic >= ctx.diastolic_min &&
    reading.diastolic <= ctx.diastolic_max
  );
}

export function filterByReadingContext(
  articles: Article[],
  reading: BPReading,
): Article[] {
  return articles.filter(a =>
    readingContextMatches(reading, a.frontmatter.reading_context),
  );
}

// -----------------------------------------------------------------
// Inline Explainer card selection — the deterministic algorithm
// per docs/08-learn-module.md §6, expanded for multi-vital scope.
//
// Input: a BP reading + the full article corpus.
// Output: up to 2 articles to surface in the bottom sheet.
//
// Strategy:
//   1. Filter to articles whose reading_context matches.
//   2. For crisis / stage2 readings, bias toward the urgency cards
//      (priority 1 in the higher-tier mapping).
//   3. For lower tiers, take one priority-1 card + one
//      tier-specific card.
// -----------------------------------------------------------------

export interface SelectInlineExplainerOptions {
  reading: BPReading;
  articles: Article[];
  /** Max 2 by default — matches the spec. */
  max?: number;
  /** Production gate. Defaults to false (hide unreviewed). */
  dev?: boolean;
}

export function selectInlineExplainerArticles(
  options: SelectInlineExplainerOptions,
): Article[] {
  const max = options.max ?? 2;
  const tier = bpTier(options.reading);

  // Apply gates first — clinical review, then reading-context.
  const reviewed = filterByClinicalReviewGate(options.articles, {
    dev: options.dev,
  });
  const inWindow = filterByReadingContext(reviewed, options.reading);

  const priority1 = inWindow.filter(
    a => a.frontmatter.inline_explainer_priority === 1,
  );
  const tierSpecific = inWindow.filter(a =>
    matchesTier(a, tier),
  );

  const picks: Article[] = [];
  // For higher-tier readings, lead with a tier-specific card; for
  // lower tiers, lead with the always-candidate priority-1 card.
  if (tier === 'crisis' || tier === 'stage2') {
    pushUnique(picks, tierSpecific, max);
    pushUnique(picks, priority1, max);
  } else {
    pushUnique(picks, priority1, max);
    pushUnique(picks, tierSpecific, max);
  }
  return picks.slice(0, max);
}

/**
 * Loose tier matcher — an article is "tier-specific" when its
 * reading-context window is narrower than 0..999 (i.e. it was
 * authored for a specific tier rather than as a global candidate).
 *
 * Future expansion: explicit tier metadata on the frontmatter, once
 * we have enough authored cards to need it.
 */
function matchesTier(article: Article, tier: BPTier): boolean {
  const ctx = article.frontmatter.reading_context;
  const isGlobal =
    ctx.systolic_min === 0 &&
    ctx.systolic_max === 999 &&
    ctx.diastolic_min === 0 &&
    ctx.diastolic_max === 999;
  if (isGlobal) return false;

  switch (tier) {
    case 'normal':
      return ctx.systolic_max < 120;
    case 'elevated':
      return ctx.systolic_min >= 120 && ctx.systolic_max < 130;
    case 'stage1':
      return (
        (ctx.systolic_min >= 130 && ctx.systolic_max < 140) ||
        (ctx.diastolic_min >= 80 && ctx.diastolic_max < 90)
      );
    case 'stage2':
      return ctx.systolic_min >= 140 || ctx.diastolic_min >= 90;
    case 'crisis':
      return ctx.systolic_min >= 180 || ctx.diastolic_min >= 120;
  }
}

function pushUnique(into: Article[], from: Article[], cap: number): void {
  for (const a of from) {
    if (into.length >= cap) return;
    if (into.some(x => x.frontmatter.id === a.frontmatter.id)) continue;
    into.push(a);
  }
}

// -----------------------------------------------------------------
// Locale fallback.
// -----------------------------------------------------------------

/**
 * Returns the locale to render this article in. Prefer the user's
 * locale if marked complete; otherwise fall back to English.
 *
 * The English fallback is required per docs/08-learn-module.md §10:
 * "Never auto-translate at runtime via machine translation. Fallback
 *  to English with a banner."
 */
export function resolveLocale(
  article: Article,
  preferred: keyof Article['frontmatter']['locale_status'],
): { locale: string; isFallback: boolean } {
  const status = article.frontmatter.locale_status[preferred];
  if (status === 'complete') {
    return { locale: preferred, isFallback: false };
  }
  return { locale: 'en', isFallback: preferred !== 'en' };
}
