// Learn module — schema types. Sprint 13 task 3.
//
// Sourced from:
//   docs/08-learn-module.md §5 (frontmatter schema)
//   docs/_reference/D9-editorial.md §3.1 (six MVP categories)
//   docs/_reference/D14-ambient-ai-architecture.md §10.1 (multi-vital
//     clusters added: HR, SPO2, SLEEP, ACTIVITY, CORRELATIONS)
//
// The full v1.0 category enum unifies D9's six MVP categories with
// D14's five multi-vital additions — eleven categories total. Articles
// pre-D14 use the original six; post-D14 articles use the new five.
//
// Frontmatter is YAML; the runtime never sees raw YAML — the parser
// converts it to these types, the build-articles script (Sprint 13
// task 12) emits a typed Article[] to the bundle, and the runtime
// imports the typed array.

export type ArticleCategory =
  // D9 §3.1 — original six
  | 'NUMBERS'
  | 'CHANGES'
  | 'OTHER'
  | 'DAILY'
  | 'CULTURAL'
  | 'DOCTOR'
  // D14 §10.1 — multi-vital additions
  | 'HR'
  | 'SPO2'
  | 'SLEEP'
  | 'ACTIVITY'
  | 'CORRELATIONS';

export const ARTICLE_CATEGORIES: readonly ArticleCategory[] = [
  'NUMBERS',
  'CHANGES',
  'OTHER',
  'DAILY',
  'CULTURAL',
  'DOCTOR',
  'HR',
  'SPO2',
  'SLEEP',
  'ACTIVITY',
  'CORRELATIONS',
] as const;

/** Who an article is shown to. */
export type Audience = 'self_buyer' | 'caregiver';

export const AUDIENCES: readonly Audience[] = ['self_buyer', 'caregiver'] as const;

/**
 * Mode relevance — does this card apply when the family is in
 * self-only mode, caregiver-only mode, or hybrid mode? Per D8a §2.3
 * the three modes can each surface a different subset.
 */
export type ModeRelevance = 'self' | 'caregiver' | 'hybrid';

export const MODE_RELEVANCES: readonly ModeRelevance[] = [
  'self',
  'caregiver',
  'hybrid',
] as const;

/**
 * Reading-context window — Inline Explainer surfaces an article only
 * when the user's current reading falls inside this window. A 0–999
 * range means "always candidate" (per docs/08-learn-module.md §6).
 */
export interface ReadingContext {
  systolic_min: number;
  systolic_max: number;
  diastolic_min: number;
  diastolic_max: number;
}

/** Per-locale completion state, controls fallback to English. */
export type LocaleStatus = 'complete' | 'pending' | 'machine-translated';

export type Locale = 'en' | 'yo' | 'ig' | 'ha' | 'fr' | 'sw';

export const LOCALES: readonly Locale[] = [
  'en',
  'yo',
  'ig',
  'ha',
  'fr',
  'sw',
] as const;

/**
 * Inline-explainer priority. 1 = always candidate. Higher numbers are
 * supplementary cards that surface only when there is no Tier-1 match
 * for the current reading. Per docs/08-learn-module.md §6.
 */
export type InlineExplainerPriority = 1 | 2 | 3 | 4 | 5;

/** Parsed YAML frontmatter — every field required by §5 of the spec. */
export interface ArticleFrontmatter {
  id: string;
  title: string;
  category: ArticleCategory;
  audience: Audience[];
  mode_relevance: ModeRelevance[];
  reading_context: ReadingContext;
  inline_explainer_priority: InlineExplainerPriority;
  related_cards: string[];
  sources: string[];
  /**
   * ISO date (YYYY-MM-DD). When the editorial / clinical review last
   * passed. Surfaced in the article footer.
   */
  last_reviewed: string;
  /** Reviewer attribution, or null when pending review. */
  reviewed_by: string | null;
  /**
   * True for Cluster A (clinical-tone) cards. Production builds hide
   * `clinical_review_required: true` cards until `clinical_reviewed_at`
   * is set. Dev builds show them with an [unreviewed] badge per
   * Sprint 13 plan task 4.
   */
  clinical_review_required: boolean;
  /** ISO timestamp when clinical advisor signed off. */
  clinical_reviewed_at: string | null;
  /** Per-locale availability. English is the only required locale at v1.0. */
  locale_status: Partial<Record<Locale, LocaleStatus>>;
}

/** Article = parsed frontmatter + raw MDX body, kept separate so the
 *  renderer (Sprint 13 task 4) consumes only the body string. */
export interface Article {
  frontmatter: ArticleFrontmatter;
  /** Raw MDX body. The renderer turns this into RN nodes. */
  body: string;
  /** Optional source-of-record path for debugging — e.g. articles/numbers-001.mdx. */
  sourcePath?: string;
}

// -----------------------------------------------------------------
// BP tier mapping — used by the Inline Explainer to pick which
// articles to surface for a given reading per docs/08 §6.
// -----------------------------------------------------------------

export type BPTier = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';

/**
 * Classifier matching docs/08-learn-module.md §6 (AHA/ACC 2017
 * thresholds). Returns the tier for a (sys, dia) pair. Either number
 * being in a higher tier promotes the whole reading to that tier.
 */
export function bpTier(reading: { systolic: number; diastolic: number }): BPTier {
  const { systolic: s, diastolic: d } = reading;
  if (s >= 180 || d >= 120) return 'crisis';
  if (s >= 140 || d >= 90) return 'stage2';
  if (s >= 130 || d >= 80) return 'stage1';
  if (s >= 120) return 'elevated';
  return 'normal';
}
