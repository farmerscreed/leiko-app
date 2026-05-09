// cardMatcher.test.ts — Sprint 11 task 7.

import { matchCardByKeyword } from '../cardMatcher';
import { ARTICLES } from '../../../learn/articleIndex.gen';

describe('matchCardByKeyword — direct title hits', () => {
  it('matches "what is blood pressure" → numbers-001', () => {
    const result = matchCardByKeyword('what is blood pressure', ARTICLES);
    expect(result?.cardId).toBe('numbers-001');
  });

  it('matches "what is resting heart rate" → hr-001', () => {
    const result = matchCardByKeyword('what is resting heart rate', ARTICLES);
    expect(result?.cardId).toBe('hr-001');
  });

  it('matches "blood oxygen" → spo2-001', () => {
    const result = matchCardByKeyword('what is blood oxygen', ARTICLES);
    expect(result?.cardId).toBe('spo2-001');
  });

  it('matches "sleep stages" → sleep-001', () => {
    const result = matchCardByKeyword('explain sleep stages', ARTICLES);
    expect(result?.cardId).toBe('sleep-001');
  });

  it('matches "morning blood pressure" → changes-001', () => {
    const result = matchCardByKeyword('why is morning blood pressure higher', ARTICLES);
    // Either changes-001 (by title) or numbers-001 (by token overlap).
    // The score-tie should prefer the lexically smaller id —
    // changes-001 < numbers-001 alphabetically.
    expect(result?.cardId).toBe('changes-001');
  });
});

describe('matchCardByKeyword — no overlap', () => {
  it('returns null for unrelated questions', () => {
    expect(matchCardByKeyword('what color is the sky', ARTICLES)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(matchCardByKeyword('', ARTICLES)).toBeNull();
  });

  it('returns null when only stop words match', () => {
    expect(matchCardByKeyword('the and is of', ARTICLES)).toBeNull();
  });
});

describe('matchCardByKeyword — score shape', () => {
  it('returns a score in (0, 1]', () => {
    const result = matchCardByKeyword('what is blood pressure', ARTICLES);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(1);
  });

  it('reports the matched keywords', () => {
    const result = matchCardByKeyword('what is sleep score', ARTICLES);
    expect(result).not.toBeNull();
    expect(result!.matchedKeywords).toEqual(
      expect.arrayContaining(['sleep']),
    );
  });
});

describe('matchCardByKeyword — category fallback', () => {
  it('matches "sleep" → a SLEEP article', () => {
    const result = matchCardByKeyword('sleep', ARTICLES);
    expect(result).not.toBeNull();
    const article = ARTICLES.find(a => a.frontmatter.id === result!.cardId);
    expect(article?.frontmatter.category).toBe('SLEEP');
  });

  it('matches "activity" → an ACTIVITY article', () => {
    const result = matchCardByKeyword('activity question', ARTICLES);
    expect(result).not.toBeNull();
    const article = ARTICLES.find(a => a.frontmatter.id === result!.cardId);
    expect(article?.frontmatter.category).toBe('ACTIVITY');
  });
});

describe('matchCardByKeyword — determinism', () => {
  it('same input returns same output', () => {
    const a = matchCardByKeyword('blood pressure stages', ARTICLES);
    const b = matchCardByKeyword('blood pressure stages', ARTICLES);
    expect(a?.cardId).toBe(b?.cardId);
  });
});
