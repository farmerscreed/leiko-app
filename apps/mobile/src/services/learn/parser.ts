// Learn module — MDX parser. Sprint 13 task 3.
//
// Splits an MDX article into { frontmatter, body }. Frontmatter is
// validated against ArticleFrontmatter; missing or malformed fields
// throw with a descriptive error so the build script (Sprint 13 task
// 12) fails loudly on a bad article rather than emitting garbage.
//
// This module is pure — it operates on string input only and is
// dev-tool / build-time code. The runtime never sees raw YAML; the
// build-articles script (task 12) writes a typed Article[] to the
// bundle and the runtime imports that.

import yaml from 'js-yaml';
import type {
  Article,
  ArticleFrontmatter,
  ArticleCategory,
  Audience,
  InlineExplainerPriority,
  ModeRelevance,
  ReadingContext,
  Locale,
  LocaleStatus,
} from './types';
import {
  ARTICLE_CATEGORIES,
  AUDIENCES,
  LOCALES,
  MODE_RELEVANCES,
} from './types';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export class ArticleParseError extends Error {
  constructor(message: string, public readonly sourcePath?: string) {
    super(sourcePath ? `${sourcePath}: ${message}` : message);
    this.name = 'ArticleParseError';
  }
}

/**
 * Parse an MDX article string into a typed Article. Throws
 * ArticleParseError on any schema violation.
 *
 * sourcePath is optional and is woven into error messages — pass it
 * when invoking from the build script so the user can see which file
 * failed.
 */
export function parseArticle(mdx: string, sourcePath?: string): Article {
  const m = mdx.match(FRONTMATTER_RE);
  if (!m) {
    throw new ArticleParseError(
      'no YAML frontmatter found (expected --- ... --- at start)',
      sourcePath,
    );
  }
  const yamlText = m[1];
  const body = mdx.slice(m[0].length).replace(/^\s+/, '');

  let raw: unknown;
  try {
    raw = yaml.load(yamlText);
  } catch (err) {
    throw new ArticleParseError(
      `frontmatter YAML parse failed: ${(err as Error).message}`,
      sourcePath,
    );
  }
  if (!raw || typeof raw !== 'object') {
    throw new ArticleParseError(
      'frontmatter must be a YAML mapping (got ' + typeof raw + ')',
      sourcePath,
    );
  }

  const frontmatter = validateFrontmatter(raw as Record<string, unknown>, sourcePath);
  return { frontmatter, body, sourcePath };
}

// -----------------------------------------------------------------
// Frontmatter validation — every field gets a typed extractor.
// -----------------------------------------------------------------

function validateFrontmatter(
  fm: Record<string, unknown>,
  sourcePath?: string,
): ArticleFrontmatter {
  const id = requireString(fm, 'id', sourcePath);
  const title = requireString(fm, 'title', sourcePath);
  const category = requireCategory(fm, 'category', sourcePath);
  const audience = requireAudienceList(fm, 'audience', sourcePath);
  const mode_relevance = requireModeList(fm, 'mode_relevance', sourcePath);
  const reading_context = requireReadingContext(fm, 'reading_context', sourcePath);
  const inline_explainer_priority = requirePriority(
    fm,
    'inline_explainer_priority',
    sourcePath,
  );
  const related_cards = requireStringArray(fm, 'related_cards', sourcePath);
  const sources = requireStringArray(fm, 'sources', sourcePath);
  // last_reviewed comes back from js-yaml as a Date for `2026-05-09`
  // bare strings — coerce to the ISO date string we want to keep.
  const last_reviewed = coerceISODate(fm, 'last_reviewed', sourcePath);
  const reviewed_by = optionalString(fm, 'reviewed_by');
  const clinical_review_required = requireBoolean(
    fm,
    'clinical_review_required',
    sourcePath,
  );
  const clinical_reviewed_at = optionalString(fm, 'clinical_reviewed_at');
  const locale_status = requireLocaleStatus(fm, 'locale_status', sourcePath);

  return {
    id,
    title,
    category,
    audience,
    mode_relevance,
    reading_context,
    inline_explainer_priority,
    related_cards,
    sources,
    last_reviewed,
    reviewed_by,
    clinical_review_required,
    clinical_reviewed_at,
    locale_status,
  };
}

// --- typed extractors ------------------------------------------------

function fail(field: string, why: string, sourcePath?: string): never {
  throw new ArticleParseError(
    `frontmatter field "${field}": ${why}`,
    sourcePath,
  );
}

function requireString(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): string {
  const v = fm[field];
  if (typeof v !== 'string' || v.length === 0) {
    fail(field, `expected non-empty string, got ${describe(v)}`, sourcePath);
  }
  return v as string;
}

function optionalString(
  fm: Record<string, unknown>,
  field: string,
): string | null {
  const v = fm[field];
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.length > 0) return v;
  // Coerce dates back to ISO strings — js-yaml turns YYYY-MM-DD into Date.
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

function requireBoolean(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): boolean {
  const v = fm[field];
  if (typeof v !== 'boolean') {
    fail(field, `expected boolean, got ${describe(v)}`, sourcePath);
  }
  return v as boolean;
}

function requireCategory(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): ArticleCategory {
  const v = fm[field];
  if (typeof v !== 'string' || !ARTICLE_CATEGORIES.includes(v as ArticleCategory)) {
    fail(
      field,
      `expected one of ${ARTICLE_CATEGORIES.join(', ')}, got ${describe(v)}`,
      sourcePath,
    );
  }
  return v as ArticleCategory;
}

function requireAudienceList(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): Audience[] {
  const v = fm[field];
  if (!Array.isArray(v) || v.length === 0) {
    fail(field, `expected non-empty array, got ${describe(v)}`, sourcePath);
  }
  for (const item of v as unknown[]) {
    if (typeof item !== 'string' || !AUDIENCES.includes(item as Audience)) {
      fail(
        field,
        `array items must be one of ${AUDIENCES.join(', ')}, got ${describe(item)}`,
        sourcePath,
      );
    }
  }
  return v as Audience[];
}

function requireModeList(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): ModeRelevance[] {
  const v = fm[field];
  if (!Array.isArray(v) || v.length === 0) {
    fail(field, `expected non-empty array, got ${describe(v)}`, sourcePath);
  }
  for (const item of v as unknown[]) {
    if (
      typeof item !== 'string' ||
      !MODE_RELEVANCES.includes(item as ModeRelevance)
    ) {
      fail(
        field,
        `array items must be one of ${MODE_RELEVANCES.join(', ')}, got ${describe(item)}`,
        sourcePath,
      );
    }
  }
  return v as ModeRelevance[];
}

function requireReadingContext(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): ReadingContext {
  const v = fm[field];
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    fail(field, `expected object, got ${describe(v)}`, sourcePath);
  }
  const ctx = v as Record<string, unknown>;
  return {
    systolic_min: requireNumber(ctx, 'systolic_min', sourcePath, field),
    systolic_max: requireNumber(ctx, 'systolic_max', sourcePath, field),
    diastolic_min: requireNumber(ctx, 'diastolic_min', sourcePath, field),
    diastolic_max: requireNumber(ctx, 'diastolic_max', sourcePath, field),
  };
}

function requireNumber(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
  parentField?: string,
): number {
  const v = fm[field];
  if (typeof v !== 'number' || Number.isNaN(v)) {
    const labelled = parentField ? `${parentField}.${field}` : field;
    fail(labelled, `expected number, got ${describe(v)}`, sourcePath);
  }
  return v as number;
}

function requirePriority(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): InlineExplainerPriority {
  const v = fm[field];
  if (typeof v !== 'number' || ![1, 2, 3, 4, 5].includes(v)) {
    fail(field, `expected 1..5, got ${describe(v)}`, sourcePath);
  }
  return v as InlineExplainerPriority;
}

function requireStringArray(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): string[] {
  const v = fm[field];
  if (!Array.isArray(v)) {
    fail(field, `expected array, got ${describe(v)}`, sourcePath);
  }
  for (const item of v as unknown[]) {
    if (typeof item !== 'string') {
      fail(field, `array items must be strings, got ${describe(item)}`, sourcePath);
    }
  }
  return v as string[];
}

function coerceISODate(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): string {
  const v = fm[field];
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) {
      fail(field, 'invalid Date', sourcePath);
    }
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }
  fail(field, `expected ISO date string YYYY-MM-DD, got ${describe(v)}`, sourcePath);
}

function requireLocaleStatus(
  fm: Record<string, unknown>,
  field: string,
  sourcePath?: string,
): Partial<Record<Locale, LocaleStatus>> {
  const v = fm[field];
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    fail(field, `expected object, got ${describe(v)}`, sourcePath);
  }
  const out: Partial<Record<Locale, LocaleStatus>> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!LOCALES.includes(k as Locale)) {
      fail(`${field}.${k}`, `unknown locale; allowed: ${LOCALES.join(', ')}`, sourcePath);
    }
    if (
      typeof raw !== 'string' ||
      !['complete', 'pending', 'machine-translated'].includes(raw)
    ) {
      fail(
        `${field}.${k}`,
        `expected one of complete | pending | machine-translated, got ${describe(raw)}`,
        sourcePath,
      );
    }
    out[k as Locale] = raw as LocaleStatus;
  }
  if (out.en !== 'complete' && out.en !== 'pending') {
    fail(
      `${field}.en`,
      `English locale must be present and either "complete" or "pending"`,
      sourcePath,
    );
  }
  return out;
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return `array(${v.length})`;
  if (v instanceof Date) return `Date(${v.toISOString()})`;
  return typeof v;
}
