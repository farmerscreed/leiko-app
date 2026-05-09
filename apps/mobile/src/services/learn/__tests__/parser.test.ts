// parser.test.ts — Sprint 13 task 3.

import * as fs from 'fs';
import * as path from 'path';
import { parseArticle, ArticleParseError } from '../parser';
import type { ArticleFrontmatter } from '../types';

const ARTICLES_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'learn',
  'articles',
);

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(ARTICLES_DIR, name), 'utf8');
}

function frontmatter(extras: Partial<ArticleFrontmatter> = {}): string {
  const base = {
    id: 'test-001',
    title: 'Test article',
    category: 'NUMBERS',
    audience: ['self_buyer', 'caregiver'],
    mode_relevance: ['self', 'caregiver', 'hybrid'],
    reading_context: {
      systolic_min: 0,
      systolic_max: 999,
      diastolic_min: 0,
      diastolic_max: 999,
    },
    inline_explainer_priority: 1,
    related_cards: [],
    sources: ['AHA/ACC 2017'],
    last_reviewed: '2026-05-09',
    reviewed_by: null,
    clinical_review_required: false,
    clinical_reviewed_at: null,
    locale_status: { en: 'complete' },
    ...extras,
  };
  return makeMdx(base);
}

function makeMdx(fm: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    // Skip undefined entries entirely so test fixtures can opt-out of
    // a field by setting `{ id: undefined }`. js-yaml treats `id: undefined`
    // (literal text) as the string "undefined" — which would defeat
    // "missing-field" tests.
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
      }
    } else if (typeof v === 'object' && v !== null) {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        lines.push(`  ${k2}: ${JSON.stringify(v2)}`);
      }
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push('---', '', 'Body content here.');
  return lines.join('\n');
}

describe('parseArticle — happy path', () => {
  it('parses every shipped reference article', () => {
    const files = fs
      .readdirSync(ARTICLES_DIR)
      .filter(f => f.endsWith('.mdx'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const article = parseArticle(loadFixture(f), f);
      expect(article.frontmatter.id).toBeTruthy();
      expect(article.frontmatter.title).toBeTruthy();
      expect(article.body.length).toBeGreaterThan(50);
    }
  });

  it('parses a synthetic minimal article', () => {
    const article = parseArticle(frontmatter());
    expect(article.frontmatter.id).toBe('test-001');
    expect(article.frontmatter.category).toBe('NUMBERS');
    expect(article.frontmatter.locale_status.en).toBe('complete');
    expect(article.body).toContain('Body content');
  });

  it('separates body from frontmatter, trimming leading whitespace', () => {
    const article = parseArticle(frontmatter());
    expect(article.body.startsWith('Body')).toBe(true);
  });

  it('coerces YAML Date back to ISO date string', () => {
    // Bare `2026-05-09` parses as a Date; we want it as an ISO string.
    const mdx =
      '---\n' +
      'id: test-001\n' +
      'title: Date coerce test\n' +
      'category: NUMBERS\n' +
      'audience: [self_buyer, caregiver]\n' +
      'mode_relevance: [self, caregiver, hybrid]\n' +
      'reading_context: { systolic_min: 0, systolic_max: 999, diastolic_min: 0, diastolic_max: 999 }\n' +
      'inline_explainer_priority: 1\n' +
      'related_cards: []\n' +
      'sources: ["AHA/ACC 2017"]\n' +
      'last_reviewed: 2026-05-09\n' +
      'reviewed_by: null\n' +
      'clinical_review_required: false\n' +
      'clinical_reviewed_at: null\n' +
      'locale_status: { en: complete }\n' +
      '---\n\nbody';
    const article = parseArticle(mdx);
    expect(article.frontmatter.last_reviewed).toBe('2026-05-09');
  });
});

describe('parseArticle — schema violations', () => {
  it('throws on missing frontmatter delimiters', () => {
    expect(() => parseArticle('No frontmatter here.\nJust body.')).toThrow(
      ArticleParseError,
    );
  });

  it('throws when required field is missing', () => {
    const broken = frontmatter({ id: undefined as unknown as string });
    expect(() => parseArticle(broken)).toThrow(/id/);
  });

  it('throws on unknown category', () => {
    const broken = frontmatter({
      category: 'INVALID_CATEGORY' as never,
    });
    expect(() => parseArticle(broken)).toThrow(/category/);
  });

  it('throws on empty audience list', () => {
    const broken = frontmatter({ audience: [] });
    expect(() => parseArticle(broken)).toThrow(/audience/);
  });

  it('throws on unknown audience value', () => {
    const broken = frontmatter({
      audience: ['rando' as never],
    });
    expect(() => parseArticle(broken)).toThrow(/audience/);
  });

  it('throws on missing reading_context field', () => {
    const broken = frontmatter({
      reading_context: { systolic_min: 0 } as never,
    });
    expect(() => parseArticle(broken)).toThrow(/reading_context\.(systolic_max|diastolic_min|diastolic_max)/);
  });

  it('throws on out-of-range priority', () => {
    const broken = frontmatter({
      inline_explainer_priority: 7 as never,
    });
    expect(() => parseArticle(broken)).toThrow(/inline_explainer_priority/);
  });

  it('throws on missing English locale_status', () => {
    const broken = frontmatter({
      locale_status: { yo: 'pending' as never },
    });
    expect(() => parseArticle(broken)).toThrow(/locale_status\.en/);
  });

  it('throws on bogus locale code', () => {
    const broken = frontmatter({
      locale_status: { en: 'complete', xx: 'pending' } as never,
    });
    expect(() => parseArticle(broken)).toThrow(/locale_status\.xx/);
  });

  it('embeds the source path in error messages when supplied', () => {
    expect(() =>
      parseArticle('not even frontmatter', 'articles/numbers-001.mdx'),
    ).toThrow(/numbers-001\.mdx/);
  });
});
