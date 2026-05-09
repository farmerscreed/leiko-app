// Deno tests for output-guard Layer 1 — Sprint 12.
//
// Coverage:
//   - Each forbidden vocabulary rule fires on a synthetic positive
//   - Word-boundary edge cases (patient vs patience, etc.)
//   - Real voice-compliant copy passes
//   - Retry-augment includes the rule ids that fired

import { assertEquals } from 'jsr:@std/assert@1';
import {
  scanLayer1,
  buildLayer1RetryAugment,
  _RULES_FOR_TEST,
} from './layer1-regex.ts';

// Voice-compliant baseline drawn from D11 §3.6 / D14 §3.3 examples.
// These must pass — they're the canonical "what the model should
// produce" copy. If they fire Layer 1, the rule set is too aggressive.
const VOICE_COMPLIANT_SAMPLES: string[] = [
  'Mum is in pattern. 124 over 79 this morning, six below her week.',
  "Dad's resting heart rate has been higher than usual this week.",
  'You hit your step goal four days last week. Your resting heart rate is two below your week.',
  'This reading is six above Mum\'s week. She slept five hours last night — these often go together.',
  'This week, Dad was in pattern. His morning numbers averaged 124 over 79.',
  '',
  '   ',
];

// ── Compliant copy ────────────────────────────────────────────────────

Deno.test('Layer 1 passes voice-compliant copy', () => {
  for (const sample of VOICE_COMPLIANT_SAMPLES) {
    const result = scanLayer1(sample);
    if (!result.passes) {
      throw new Error(
        `Voice-compliant sample tripped Layer 1: "${sample}" — hits: ${JSON.stringify(result.hits)}`,
      );
    }
  }
});

// ── Forbidden vocabulary positives ────────────────────────────────────

Deno.test('Layer 1 catches "patient" but NOT "patience"', () => {
  assertEquals(scanLayer1('Mum is a patient.').passes, false);
  assertEquals(scanLayer1('Patients should rest.').passes, false);
  assertEquals(scanLayer1("the patient's BP").passes, false);
  // Critical false-positive guard: "patience" must not match.
  assertEquals(scanLayer1('Have patience with the new routine.').passes, true);
  // "patiently" is a different word; word-boundary regex permits it.
  assertEquals(scanLayer1('She waited patiently.').passes, true);
});

Deno.test('Layer 1 catches diagnose / diagnosis / treatment / cure', () => {
  assertEquals(scanLayer1('We can diagnose this.').passes, false);
  assertEquals(scanLayer1('The diagnosis is hypertension.').passes, false);
  assertEquals(scanLayer1('Diagnostic criteria suggest…').passes, false);
  assertEquals(scanLayer1('The treatment plan is…').passes, false);
  assertEquals(scanLayer1('She was treated last year.').passes, false);
  assertEquals(scanLayer1('There is no cure for this.').passes, false);
});

Deno.test('Layer 1 catches medical-advice / dangerous-level / critical-level', () => {
  assertEquals(scanLayer1('This is medical advice.').passes, false);
  assertEquals(scanLayer1('Her BP is at a dangerous level.').passes, false);
  assertEquals(scanLayer1('Critical level reached.').passes, false);
});

Deno.test('Layer 1 catches fear-monger phrases', () => {
  assertEquals(scanLayer1('The silent killer is at it again.').passes, false);
  assertEquals(scanLayer1('A ticking time bomb.').passes, false);
  assertEquals(scanLayer1('Act before it\'s too late.').passes, false);
  assertEquals(scanLayer1('Act before its too late.').passes, false);
});

Deno.test('Layer 1 catches outcome-promising language', () => {
  assertEquals(scanLayer1('This will lower your BP.').passes, false);
  assertEquals(scanLayer1('This will reduce her risk.').passes, false);
  assertEquals(scanLayer1('We guarantee improvement.').passes, false);
  assertEquals(scanLayer1('Following this guarantees results.').passes, false);
  assertEquals(scanLayer1('This will help you live longer.').passes, false);
});

Deno.test('Layer 1 catches D11 §3.3 premium-precise additions', () => {
  assertEquals(scanLayer1('Biohack your sleep.').passes, false);
  assertEquals(scanLayer1('Optimise your morning routine.').passes, false);
  assertEquals(scanLayer1('Optimize your morning routine.').passes, false);
  assertEquals(scanLayer1('Crush your goals.').passes, false);
  assertEquals(scanLayer1('Smash this week.').passes, false);
  assertEquals(scanLayer1('Destroy your old patterns.').passes, false);
  assertEquals(scanLayer1('Level up your habits.').passes, false);
  assertEquals(scanLayer1('Level-up your habits.').passes, false);
  assertEquals(scanLayer1('Achievement unlocked: 30 days.').passes, false);
  assertEquals(scanLayer1('Your streak continues.').passes, false);
  assertEquals(scanLayer1('Wellness journey.').passes, false);
  assertEquals(scanLayer1('Smart insights for you.').passes, false);
  assertEquals(scanLayer1('Smart alerts enabled.').passes, false);
});

Deno.test('Layer 1 catches exclamation points in body copy', () => {
  const result = scanLayer1('Mum is in pattern!');
  assertEquals(result.passes, false);
  assertEquals(result.hits[0].ruleId, 'exclamation');
});

// ── Multi-hit + telemetry ─────────────────────────────────────────────

Deno.test('Layer 1 reports every hit, not just the first', () => {
  const result = scanLayer1('Patient diagnosis: optimise the treatment!');
  // Expect: patient, diagnose, optimise, treat, exclamation = 5
  assertEquals(result.passes, false);
  const ruleIds = result.hits.map((h) => h.ruleId);
  assertEquals(ruleIds.includes('patient'), true);
  assertEquals(ruleIds.includes('diagnose'), true);
  assertEquals(ruleIds.includes('optimise'), true);
  assertEquals(ruleIds.includes('treat'), true);
  assertEquals(ruleIds.includes('exclamation'), true);
});

Deno.test('Layer 1 hit indices point to the actual match', () => {
  const text = 'Mum is a patient and the patient is calm.';
  const result = scanLayer1(text);
  assertEquals(result.passes, false);
  // Two patient hits; both indices should land on a "patient" substring.
  for (const h of result.hits) {
    assertEquals(text.slice(h.index, h.index + 7).toLowerCase(), 'patient');
  }
});

// ── Retry augment ─────────────────────────────────────────────────────

Deno.test('buildLayer1RetryAugment lists triggered rule ids', () => {
  const hits = [
    { ruleId: 'patient',     match: 'patient',     index: 0 },
    { ruleId: 'diagnose',    match: 'diagnosis',   index: 10 },
    // Duplicate id should appear once.
    { ruleId: 'patient',     match: 'patient',     index: 30 },
  ];
  const augment = buildLayer1RetryAugment(hits);
  assertEquals(augment.includes('patient, diagnose'), true);
  assertEquals(augment.includes('Regenerate using ONLY'), true);
});

Deno.test('buildLayer1RetryAugment omits empty rule list gracefully', () => {
  const augment = buildLayer1RetryAugment([]);
  assertEquals(augment.includes('Regenerate using ONLY'), true);
  // No empty parentheses.
  assertEquals(augment.includes('()'), false);
});

// ── Rule set sanity ───────────────────────────────────────────────────

Deno.test('Every rule has a unique id', () => {
  const ids = _RULES_FOR_TEST.map((r) => r.id);
  const unique = new Set(ids);
  assertEquals(unique.size, ids.length);
});

Deno.test('Every rule has the global flag (otherwise we miss multi-hits)', () => {
  for (const r of _RULES_FOR_TEST) {
    if (!r.pattern.global) {
      throw new Error(`rule ${r.id} missing /g flag`);
    }
  }
});
