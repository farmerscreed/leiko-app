// seedSelection.test.ts — Sprint 14 task 3.

import { selectSeededCard, type SeedSelectionInput } from '../seedSelection';
import { ARTICLES } from '../../../learn/articleIndex.gen';
import type { CompiledArticle } from '../ast';

const ALL_ARTICLES: ReadonlyArray<CompiledArticle> = ARTICLES;

function noneHidden(): (id: string) => boolean {
  return () => false;
}

function makeInput(over: Partial<SeedSelectionInput> = {}): SeedSelectionInput {
  return {
    articles: ALL_ARTICLES,
    dayIndex: 0,
    isHidden: noneHidden(),
    ...over,
  };
}

describe('selectSeededCard — null gating', () => {
  it('returns null when dayIndex is null (no first reading yet)', () => {
    const result = selectSeededCard(makeInput({ dayIndex: null }));
    expect(result).toBeNull();
  });
});

describe('selectSeededCard — priority 1: vital state', () => {
  it('BP calm-concerned at stage1 surfaces numbers-003', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { bp: 'calm_concerned' },
        bpReading: { systolic: 134, diastolic: 84 },
      }),
    );
    expect(result?.frontmatter.id).toBe('numbers-003');
  });

  it('BP calm-concerned at stage2 surfaces numbers-004', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { bp: 'calm_concerned' },
        bpReading: { systolic: 145, diastolic: 92 },
      }),
    );
    expect(result?.frontmatter.id).toBe('numbers-004');
  });

  it('BP confirmed-urgent at crisis surfaces numbers-007', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { bp: 'confirmed_urgent' },
        bpReading: { systolic: 185, diastolic: 125 },
      }),
    );
    expect(result?.frontmatter.id).toBe('numbers-007');
  });

  it('HR calm-concerned surfaces hr-002', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { hr: 'calm_concerned' },
      }),
    );
    expect(result?.frontmatter.id).toBe('hr-002');
  });

  it('SpO2 calm-concerned surfaces spo2-002', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { spo2: 'calm_concerned' },
      }),
    );
    expect(result?.frontmatter.id).toBe('spo2-002');
  });

  it('Sleep calm-concerned surfaces sleep-002', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { sleep: 'calm_concerned' },
      }),
    );
    expect(result?.frontmatter.id).toBe('sleep-002');
  });

  it('multiple concerns — BP wins over HR over SpO2', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: {
          bp: 'calm_concerned',
          hr: 'calm_concerned',
          spo2: 'calm_concerned',
        },
        bpReading: { systolic: 134, diastolic: 84 },
      }),
    );
    expect(result?.frontmatter.id).toBe('numbers-003');
  });

  it('skips the matching tier card when it is hidden, falls through', () => {
    const hidden = (id: string) => id === 'numbers-003';
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { bp: 'calm_concerned' },
        bpReading: { systolic: 134, diastolic: 84 },
        isHidden: hidden,
      }),
    );
    // Falls through to priority 2/3/4 — at day 5 the day-index target
    // is a gap, so priority 4 (cluster rotation) returns the lowest-id
    // priority-1 article that's not hidden.
    expect(result?.frontmatter.id).not.toBe('numbers-003');
  });
});

describe('selectSeededCard — priority 2: correlations', () => {
  it('sleep×BP correlation surfaces corr-001', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        meaningfulCorrelations: ['sleep_bp'],
      }),
    );
    expect(result?.frontmatter.id).toBe('corr-001');
  });

  it('activity×HR correlation surfaces corr-002', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        meaningfulCorrelations: ['activity_hr'],
      }),
    );
    expect(result?.frontmatter.id).toBe('corr-002');
  });

  it('vital state outranks correlation', () => {
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        vitalStates: { hr: 'calm_concerned' },
        meaningfulCorrelations: ['sleep_bp'],
      }),
    );
    expect(result?.frontmatter.id).toBe('hr-002');
  });
});

describe('selectSeededCard — priority 3: day-index fixed sequence', () => {
  it('Day 0 surfaces numbers-001', () => {
    expect(
      selectSeededCard(makeInput({ dayIndex: 0 }))?.frontmatter.id,
    ).toBe('numbers-001');
  });

  it('Day 1 surfaces numbers-001', () => {
    expect(
      selectSeededCard(makeInput({ dayIndex: 1 }))?.frontmatter.id,
    ).toBe('numbers-001');
  });

  it('Day 2 surfaces numbers-001', () => {
    expect(
      selectSeededCard(makeInput({ dayIndex: 2 }))?.frontmatter.id,
    ).toBe('numbers-001');
  });

  it('Day 3 surfaces changes-001', () => {
    expect(
      selectSeededCard(makeInput({ dayIndex: 3 }))?.frontmatter.id,
    ).toBe('changes-001');
  });

  it('Day 7 surfaces numbers-002', () => {
    expect(
      selectSeededCard(makeInput({ dayIndex: 7 }))?.frontmatter.id,
    ).toBe('numbers-002');
  });

  it('Day 14 surfaces doctor-001', () => {
    expect(
      selectSeededCard(makeInput({ dayIndex: 14 }))?.frontmatter.id,
    ).toBe('doctor-001');
  });

  it('Day 7 skips numbers-002 if already read, falls through', () => {
    const everRead = (id: string) => id === 'numbers-002';
    const result = selectSeededCard(
      makeInput({ dayIndex: 7, hasEverBeenRead: everRead }),
    );
    expect(result?.frontmatter.id).not.toBe('numbers-002');
  });
});

describe('selectSeededCard — priority 4: cluster rotation fallback', () => {
  it('Day 5 (gap day) returns a priority-1 article that is not hidden', () => {
    const result = selectSeededCard(makeInput({ dayIndex: 5 }));
    expect(result).not.toBeNull();
    expect(result?.frontmatter.inline_explainer_priority).toBe(1);
  });

  it('Day 5 with all priority-1 articles read drops to priority-2 candidates', () => {
    const everRead = (id: string) => {
      const article = ALL_ARTICLES.find(a => a.frontmatter.id === id);
      return article?.frontmatter.inline_explainer_priority === 1;
    };
    const result = selectSeededCard(
      makeInput({ dayIndex: 5, hasEverBeenRead: everRead }),
    );
    expect(result).not.toBeNull();
    expect(result?.frontmatter.inline_explainer_priority).not.toBe(1);
  });

  it('returns null when every article is hidden + read', () => {
    const everHidden = () => true;
    const result = selectSeededCard(
      makeInput({
        dayIndex: 5,
        isHidden: everHidden,
        hasEverBeenRead: () => true,
      }),
    );
    expect(result).toBeNull();
  });
});

describe('selectSeededCard — region routing (no-op at v1.0)', () => {
  it('NG region does not affect selection', () => {
    const us = selectSeededCard(makeInput({ dayIndex: 0, region: 'US' }));
    const ng = selectSeededCard(makeInput({ dayIndex: 0, region: 'NG' }));
    expect(us?.frontmatter.id).toBe(ng?.frontmatter.id);
  });

  it('null region does not error', () => {
    expect(() =>
      selectSeededCard(makeInput({ dayIndex: 0, region: null })),
    ).not.toThrow();
  });
});

describe('selectSeededCard — determinism', () => {
  it('same input yields same output across repeated calls', () => {
    const input = makeInput({ dayIndex: 5 });
    const a = selectSeededCard(input);
    const b = selectSeededCard(input);
    const c = selectSeededCard(input);
    expect(a?.frontmatter.id).toBe(b?.frontmatter.id);
    expect(b?.frontmatter.id).toBe(c?.frontmatter.id);
  });
});
