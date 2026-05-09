// Jailbreak red-team fixture tests — Sprint 12 task 9.
//
// This file asserts the fixture STRUCTURE (count, categories, ids,
// trigger validity). The live deflection run — actually posting each
// prompt to the Edge Function and asserting the response is a DEFER
// — lives in a separate runner script (see Sprint 12 close-out
// memory). The fixtures are the engineering-side asset; the live run
// is ops-side and depends on a running supabase functions serve plus
// a real ANTHROPIC_API_KEY, which Jest unit tests should not require.
//
// If the live runner finds a fixture that fails to deflect, the
// fixture is NOT removed — instead the system prompt or output guard
// is updated until 100% deflection is restored. The fixtures are
// canonical assertions about what the gateway must DEFER.

import { JAILBREAK_FIXTURES } from '../__fixtures__/jailbreak';

const VALID_TRIGGERS = new Set([
  'medication',
  'symptom',
  'pregnancy',
  'paediatric',
  'mental_health_crisis',
  'generic',
]);

describe('jailbreak fixtures (D14 §17)', () => {
  it('contains 80 fixtures', () => {
    expect(JAILBREAK_FIXTURES.length).toBe(80);
  });

  it('covers 10 categories with 8 prompts each', () => {
    const counts: Record<string, number> = {};
    for (const f of JAILBREAK_FIXTURES) {
      counts[f.category] = (counts[f.category] ?? 0) + 1;
    }
    const categories = Object.keys(counts);
    expect(categories.length).toBe(10);
    for (const c of categories) {
      expect(counts[c]).toBe(8);
    }
  });

  it('has unique stable ids', () => {
    const ids = JAILBREAK_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every fixture has a non-empty prompt', () => {
    for (const f of JAILBREAK_FIXTURES) {
      expect(f.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it('every acceptableTriggers entry is a valid TierBDeferTrigger', () => {
    for (const f of JAILBREAK_FIXTURES) {
      expect(f.acceptableTriggers.length).toBeGreaterThan(0);
      for (const t of f.acceptableTriggers) {
        expect(VALID_TRIGGERS.has(t)).toBe(true);
      }
    }
  });

  it('covers every D14 §17 category at least once', () => {
    // The category names below mirror D14 §17 and the comment headers
    // in __fixtures__/jailbreak.ts. If a category is renamed, BOTH
    // places update — this test fails when they drift.
    const expected = [
      'medication',
      'symptom',
      'cardiac',
      'authority',
      'pregnancy',
      'diagnostic',
      'outcome',
      'multi-vital',
      'mental-health',
      'cross-vital',
    ];
    const actual = new Set(JAILBREAK_FIXTURES.map((f) => f.category));
    for (const c of expected) {
      expect(actual.has(c)).toBe(true);
    }
  });
});
