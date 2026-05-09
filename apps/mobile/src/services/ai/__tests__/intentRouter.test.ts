// intentRouter.test.ts — Sprint 11 task 4.
//
// Validates >95% classification accuracy across the full fixture
// corpus per the Sprint 11 acceptance criteria.

import { classifyIntent, classifyIntentId } from '../intentRouter';
import { INTENT_FIXTURES, intentsMissingFixtures } from '../__fixtures__/intents';
import { INTENTS, INTENT_IDS } from '../intents';

describe('classifyIntent — empty input', () => {
  it('returns TIER_B_PLACEHOLDER for empty string', () => {
    expect(classifyIntent('').responseMode).toBe('TIER_B_PLACEHOLDER');
  });

  it('returns TIER_B_PLACEHOLDER for whitespace', () => {
    expect(classifyIntent('   \n\t   ').responseMode).toBe('TIER_B_PLACEHOLDER');
  });
});

describe('classifyIntent — fixture coverage', () => {
  it('every intent in the registry has fixtures', () => {
    expect(intentsMissingFixtures()).toEqual([]);
  });

  it('every intent has at least 5 fixtures', () => {
    for (const fixture of INTENT_FIXTURES) {
      expect(fixture.examples.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('classifyIntent — accuracy across the full fixture corpus', () => {
  type Failure = { example: string; expected: string; actual: string | null };
  const failures: Failure[] = [];
  let total = 0;

  for (const fixture of INTENT_FIXTURES) {
    for (const example of fixture.examples) {
      total++;
      const actual = classifyIntentId(example);
      if (actual !== fixture.intentId) {
        failures.push({ example, expected: fixture.intentId, actual });
      }
    }
  }

  it(`> 95% of fixture examples classify correctly (${total} total)`, () => {
    const accuracy = (total - failures.length) / total;
    if (accuracy < 0.95) {
      throw new Error(
        `Accuracy ${(accuracy * 100).toFixed(1)}% — failures:\n` +
          failures
            .map(
              f =>
                `  "${f.example}" — expected ${f.expected}, got ${f.actual ?? '<no match>'}`,
            )
            .join('\n'),
      );
    }
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
  });
});

describe('classifyIntent — ordering / shortcut behaviour', () => {
  it('OOS pregnancy shortcuts before any FAQ pattern', () => {
    expect(classifyIntentId("I'm pregnant — is this normal")).toBe(
      'oos.pregnancy',
    );
  });

  it('DEFER medication-bp shortcuts before pattern.bp-going-up', () => {
    expect(classifyIntentId('should I take more lisinopril if my bp is going up')).toBe(
      'defer.medication-bp',
    );
  });

  it('cardiac symptom defers, even with reading-context phrasing', () => {
    expect(classifyIntentId('My resting heart rate is 95 — could this be afib?')).toBe(
      'defer.symptom-cardiac',
    );
  });

  it('respiratory defer fires for sleep-apnea probe even with night-context phrasing', () => {
    expect(classifyIntentId("Mum's overnight oxygen dropped to 86 — does she have apnea?")).toBe(
      'defer.symptom-respiratory',
    );
  });
});

describe('classifyIntent — Tier-B fallthrough', () => {
  it('completely unknown question falls through', () => {
    expect(classifyIntent('what color is the moon?').responseMode).toBe(
      'TIER_B_PLACEHOLDER',
    );
  });

  it('off-topic philosophy falls through', () => {
    expect(classifyIntent('does free will exist?').responseMode).toBe(
      'TIER_B_PLACEHOLDER',
    );
  });
});

describe('classifyIntent — match shape', () => {
  it('returns the matched pattern source on hit', () => {
    const match = classifyIntent('what is blood pressure');
    expect(match.intent?.id).toBe('faq.what-is-bp');
    expect(match.matchedPattern).toBeDefined();
  });

  it('returns null intent + null pattern on miss', () => {
    const match = classifyIntent('xyz qrs nonsense');
    expect(match.intent).toBeNull();
    expect(match.matchedPattern).toBeNull();
    expect(match.responseMode).toBe('TIER_B_PLACEHOLDER');
  });
});

describe('INTENTS registry — sanity', () => {
  it('every intent id is unique', () => {
    const ids = new Set<string>();
    for (const i of INTENTS) {
      expect(ids.has(i.id)).toBe(false);
      ids.add(i.id);
    }
  });

  it('EDUCATE intents reference known card ids', () => {
    // Card ids exist in articleIndex.gen.ts; quickly walk the
    // EDUCATE-mode subset.
    const referenced = new Set<string>();
    for (const i of INTENTS) {
      if (i.responseMode === 'EDUCATE' && i.cardId) {
        referenced.add(i.cardId);
      }
    }
    // Spot-check the canonical IDs Sprint 13 ships.
    // Cards shipped in Sprint 13 — keep in sync with
    // src/learn/articleIndex.gen.ts.
    const KNOWN = [
      'numbers-001',
      'numbers-002',
      'numbers-003',
      'numbers-004',
      'numbers-005',
      'numbers-006',
      'numbers-007',
      'numbers-008',
      'changes-001',
      'changes-002',
      'changes-003',
      'changes-004',
      'changes-005',
      'changes-006',
      'hr-001',
      'hr-002',
      'hr-003',
      'spo2-001',
      'spo2-002',
      'spo2-003',
      'sleep-001',
      'sleep-002',
      'sleep-003',
      'activity-001',
      'activity-002',
      'corr-001',
      'corr-002',
      'corr-003',
      'doctor-001',
      'doctor-002',
      'doctor-003',
    ];
    expect(KNOWN.length).toBeGreaterThan(0);
    for (const ref of referenced) {
      expect(KNOWN).toContain(ref);
    }
  });

  it('DEFER intents declare a deferTrigger', () => {
    for (const i of INTENTS) {
      if (i.responseMode === 'DEFER') {
        expect(i.deferTrigger).toBeDefined();
      }
    }
  });

  it('total intent count is at the v1.0 floor (~50)', () => {
    expect(INTENT_IDS.length).toBeGreaterThanOrEqual(50);
  });
});
