// filters.test.ts — Sprint 13 task 3.

import {
  filterByAudience,
  filterByModeRelevance,
  filterByClinicalReviewGate,
  filterByReadingContext,
  isUnreviewedClusterA,
  readingContextMatches,
  selectInlineExplainerArticles,
  resolveLocale,
} from '../filters';
import type { Article, ArticleFrontmatter, ArticleCategory } from '../types';
import { bpTier } from '../types';

function art(over: Partial<ArticleFrontmatter> & { id: string }): Article {
  const fm: ArticleFrontmatter = {
    id: over.id,
    title: over.title ?? `Title for ${over.id}`,
    category: over.category ?? ('NUMBERS' as ArticleCategory),
    audience: over.audience ?? ['self_buyer', 'caregiver'],
    mode_relevance: over.mode_relevance ?? ['self', 'caregiver', 'hybrid'],
    reading_context: over.reading_context ?? {
      systolic_min: 0,
      systolic_max: 999,
      diastolic_min: 0,
      diastolic_max: 999,
    },
    inline_explainer_priority: over.inline_explainer_priority ?? 1,
    related_cards: over.related_cards ?? [],
    sources: over.sources ?? ['AHA/ACC 2017'],
    last_reviewed: over.last_reviewed ?? '2026-05-09',
    reviewed_by: over.reviewed_by ?? null,
    clinical_review_required: over.clinical_review_required ?? false,
    clinical_reviewed_at: over.clinical_reviewed_at ?? null,
    locale_status: over.locale_status ?? { en: 'complete' },
  };
  return { frontmatter: fm, body: 'body' };
}

describe('filterByAudience', () => {
  it('returns articles whose audience includes the given role', () => {
    const corpus = [
      art({ id: 'a', audience: ['self_buyer'] }),
      art({ id: 'b', audience: ['caregiver'] }),
      art({ id: 'c', audience: ['self_buyer', 'caregiver'] }),
    ];
    expect(filterByAudience(corpus, 'self_buyer').map(a => a.frontmatter.id)).toEqual(['a', 'c']);
    expect(filterByAudience(corpus, 'caregiver').map(a => a.frontmatter.id)).toEqual(['b', 'c']);
  });
});

describe('filterByModeRelevance', () => {
  it('filters by mode tag', () => {
    const corpus = [
      art({ id: 'self-only', mode_relevance: ['self'] }),
      art({ id: 'all', mode_relevance: ['self', 'caregiver', 'hybrid'] }),
      art({ id: 'caregiver-only', mode_relevance: ['caregiver'] }),
    ];
    expect(
      filterByModeRelevance(corpus, 'hybrid').map(a => a.frontmatter.id),
    ).toEqual(['all']);
  });
});

describe('filterByClinicalReviewGate', () => {
  const corpus = [
    art({ id: 'open', clinical_review_required: false }),
    art({
      id: 'unreviewed',
      clinical_review_required: true,
      clinical_reviewed_at: null,
    }),
    art({
      id: 'reviewed',
      clinical_review_required: true,
      clinical_reviewed_at: '2026-05-15T00:00:00Z',
    }),
  ];

  it('default (production) hides unreviewed Cluster A', () => {
    const visible = filterByClinicalReviewGate(corpus).map(a => a.frontmatter.id);
    expect(visible).toEqual(['open', 'reviewed']);
  });

  it('dev mode shows everything', () => {
    const visible = filterByClinicalReviewGate(corpus, { dev: true }).map(
      a => a.frontmatter.id,
    );
    expect(visible).toEqual(['open', 'unreviewed', 'reviewed']);
  });

  it('isUnreviewedClusterA picks the right rows', () => {
    expect(isUnreviewedClusterA(corpus[0])).toBe(false);
    expect(isUnreviewedClusterA(corpus[1])).toBe(true);
    expect(isUnreviewedClusterA(corpus[2])).toBe(false);
  });
});

describe('readingContextMatches', () => {
  const ctx = {
    systolic_min: 130,
    systolic_max: 139,
    diastolic_min: 80,
    diastolic_max: 89,
  };

  it('inside the window matches', () => {
    expect(readingContextMatches({ systolic: 135, diastolic: 85 }, ctx)).toBe(true);
  });

  it('on the boundary matches (inclusive)', () => {
    expect(readingContextMatches({ systolic: 130, diastolic: 80 }, ctx)).toBe(true);
    expect(readingContextMatches({ systolic: 139, diastolic: 89 }, ctx)).toBe(true);
  });

  it('outside the window does not match', () => {
    expect(readingContextMatches({ systolic: 120, diastolic: 75 }, ctx)).toBe(false);
    expect(readingContextMatches({ systolic: 145, diastolic: 95 }, ctx)).toBe(false);
  });
});

describe('filterByReadingContext', () => {
  it('keeps only articles whose window includes the reading', () => {
    const stage1 = art({
      id: 'stage1',
      reading_context: {
        systolic_min: 130,
        systolic_max: 139,
        diastolic_min: 80,
        diastolic_max: 89,
      },
    });
    const universal = art({ id: 'universal' }); // 0..999
    const filtered = filterByReadingContext(
      [stage1, universal],
      { systolic: 135, diastolic: 85 },
    );
    expect(filtered.map(a => a.frontmatter.id)).toEqual(['stage1', 'universal']);
  });
});

describe('bpTier', () => {
  it('maps the AHA/ACC tiers correctly', () => {
    expect(bpTier({ systolic: 110, diastolic: 70 })).toBe('normal');
    expect(bpTier({ systolic: 122, diastolic: 70 })).toBe('elevated');
    expect(bpTier({ systolic: 131, diastolic: 79 })).toBe('stage1');
    expect(bpTier({ systolic: 145, diastolic: 92 })).toBe('stage2');
    expect(bpTier({ systolic: 185, diastolic: 110 })).toBe('crisis');
    // Either number high promotes the whole reading.
    expect(bpTier({ systolic: 110, diastolic: 95 })).toBe('stage2');
  });
});

describe('selectInlineExplainerArticles', () => {
  const universal = art({
    id: 'numbers-001',
    inline_explainer_priority: 1,
  });
  const stage1Specific = art({
    id: 'numbers-003',
    inline_explainer_priority: 2,
    reading_context: {
      systolic_min: 130,
      systolic_max: 139,
      diastolic_min: 80,
      diastolic_max: 89,
    },
  });
  const stage2Specific = art({
    id: 'numbers-004',
    inline_explainer_priority: 2,
    reading_context: {
      systolic_min: 140,
      systolic_max: 179,
      diastolic_min: 90,
      diastolic_max: 119,
    },
  });
  const crisisSpecific = art({
    id: 'numbers-007',
    inline_explainer_priority: 1,
    reading_context: {
      systolic_min: 180,
      systolic_max: 999,
      diastolic_min: 120,
      diastolic_max: 999,
    },
  });
  const unreviewed = art({
    id: 'spo2-001',
    clinical_review_required: true,
    clinical_reviewed_at: null,
  });

  const corpus = [universal, stage1Specific, stage2Specific, crisisSpecific, unreviewed];

  it('normal reading surfaces priority-1 universal article', () => {
    const picks = selectInlineExplainerArticles({
      reading: { systolic: 110, diastolic: 70 },
      articles: corpus,
    });
    expect(picks.map(a => a.frontmatter.id)).toContain('numbers-001');
  });

  it('stage1 reading surfaces stage1-specific + universal', () => {
    const picks = selectInlineExplainerArticles({
      reading: { systolic: 135, diastolic: 85 },
      articles: corpus,
    });
    const ids = picks.map(a => a.frontmatter.id);
    expect(ids).toContain('numbers-001');
    expect(ids).toContain('numbers-003');
    expect(picks.length).toBeLessThanOrEqual(2);
  });

  it('stage2 reading leads with the stage2-specific article', () => {
    const picks = selectInlineExplainerArticles({
      reading: { systolic: 145, diastolic: 92 },
      articles: corpus,
    });
    expect(picks[0]?.frontmatter.id).toBe('numbers-004');
  });

  it('crisis reading leads with the crisis-specific article', () => {
    const picks = selectInlineExplainerArticles({
      reading: { systolic: 185, diastolic: 125 },
      articles: corpus,
    });
    expect(picks[0]?.frontmatter.id).toBe('numbers-007');
  });

  it('production-gate hides unreviewed Cluster A', () => {
    const picks = selectInlineExplainerArticles({
      reading: { systolic: 110, diastolic: 70 },
      articles: corpus,
    });
    expect(picks.some(a => a.frontmatter.id === 'spo2-001')).toBe(false);
  });

  it('dev flag exposes unreviewed Cluster A', () => {
    const picks = selectInlineExplainerArticles({
      reading: { systolic: 110, diastolic: 70 },
      articles: corpus,
      dev: true,
      max: 5,
    });
    expect(picks.some(a => a.frontmatter.id === 'spo2-001')).toBe(true);
  });

  it('respects the max=N cap', () => {
    const picks = selectInlineExplainerArticles({
      reading: { systolic: 135, diastolic: 85 },
      articles: corpus,
      max: 1,
    });
    expect(picks.length).toBe(1);
  });
});

describe('resolveLocale', () => {
  const a = art({
    id: 'x',
    locale_status: { en: 'complete', yo: 'pending', ig: 'complete' },
  });

  it('returns user locale when complete', () => {
    expect(resolveLocale(a, 'ig')).toEqual({ locale: 'ig', isFallback: false });
  });

  it('falls back to English when user locale is pending', () => {
    expect(resolveLocale(a, 'yo')).toEqual({ locale: 'en', isFallback: true });
  });

  it('returns English without flagging fallback when preferred is en', () => {
    expect(resolveLocale(a, 'en')).toEqual({ locale: 'en', isFallback: false });
  });
});
