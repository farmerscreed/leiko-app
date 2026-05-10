// Deno tests for ai-daily-narration prompt builder — Sprint 12.5.

import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { buildDailyNarrationUserPrompt } from './index.ts';
import { scrubAiContext } from '../_shared/phi-scrub.ts';

const NOW = 1_777_036_401;

function ctx(overrides: Record<string, unknown> = {}) {
  return scrubAiContext({
    parentLabel: 'Mum',
    yearOfBirth: 1958,
    residenceCity: 'Lagos',
    accountType: 'caregiver',
    bp: {
      latestSystolic: 124,
      latestDiastolic: 79,
      latestPulse: 64,
      latestMeasuredAtSec: NOW,
      weekAverageSystolic: 122,
      weekAverageDiastolic: 78,
      state: 'in_pattern',
    },
    hr: { restingToday: 64, baseline: 66, state: 'in_pattern' },
    spo2: { latest: 96, overnightLow: 91, state: 'in_pattern' },
    sleep: { lastNightTotalMinutes: 412, score: 78, state: 'in_pattern' },
    activity: { todaySteps: 4112, targetSteps: 8000, state: 'in_pattern' },
    correlations: [
      { leftVital: 'sleep', rightVital: 'bp', coefficient: -0.412, meaningful: true },
    ],
    ...overrides,
  });
}

Deno.test('builds a prompt that includes the parent label, account type, and date', () => {
  const out = buildDailyNarrationUserPrompt(ctx(), ['baseline_anomaly'], '2026-05-10');
  assertStringIncludes(out, 'Account type: caregiver');
  assertStringIncludes(out, 'Parent label: Mum');
  assertStringIncludes(out, 'Year of birth: 1958');
  assertStringIncludes(out, 'Residence city: Lagos');
  assertStringIncludes(out, "Today's date (local): 2026-05-10");
});

Deno.test('formats the BP line with latest + week avg', () => {
  const out = buildDailyNarrationUserPrompt(ctx(), [], '2026-05-10');
  assertStringIncludes(out, 'BP: in_pattern — latest 124/79 — week avg 122/78');
});

Deno.test('formats every per-vital line per D14 §3.4', () => {
  const out = buildDailyNarrationUserPrompt(ctx(), [], '2026-05-10');
  assertStringIncludes(out, 'HR: in_pattern — resting today 64 — baseline 66');
  assertStringIncludes(out, 'SpO2: in_pattern — latest 96 — overnight low 91');
  assertStringIncludes(out, 'Sleep: in_pattern — last night 412min — score 78');
  assertStringIncludes(out, 'Activity: in_pattern — today 4112 of 8000 steps');
});

Deno.test('correlations are listed with rounded coefficients', () => {
  const out = buildDailyNarrationUserPrompt(ctx(), [], '2026-05-10');
  // Correlation gets rounded to 2 decimals by phi-scrub already;
  // here we just assert the formatted line shape.
  assertStringIncludes(out, 'sleep ↔ bp: r=-0.41');
  assertStringIncludes(out, '(meaningful)');
});

Deno.test('trigger reasons are surfaced in the prompt', () => {
  const out = buildDailyNarrationUserPrompt(
    ctx(),
    ['multi_vital_calm_concerned', 'baseline_anomaly'],
    '2026-05-10',
  );
  assertStringIncludes(out, 'Trigger reasons: multi_vital_calm_concerned, baseline_anomaly');
});

Deno.test('empty trigger reasons say "none"', () => {
  const out = buildDailyNarrationUserPrompt(ctx(), [], '2026-05-10');
  assertStringIncludes(out, 'Trigger reasons: none');
});

Deno.test('omits null demographic fields cleanly', () => {
  const c = scrubAiContext({
    parentLabel: 'You',
    yearOfBirth: null,
    residenceCity: null,
    accountType: 'self_buyer',
  });
  const out = buildDailyNarrationUserPrompt(c, [], '2026-05-10');
  assertEquals(out.includes('Year of birth'), false);
  assertEquals(out.includes('Residence city'), false);
  assertStringIncludes(out, 'Parent label: You');
});

Deno.test('wraps the request in <user_query> tags per D14 §11.2', () => {
  const out = buildDailyNarrationUserPrompt(ctx(), [], '2026-05-10');
  assertStringIncludes(out, '<user_query>');
  assertStringIncludes(out, '</user_query>');
});

Deno.test('prepends retryAugment when supplied (placed BEFORE user_query block)', () => {
  const out = buildDailyNarrationUserPrompt(
    ctx(),
    [],
    '2026-05-10',
    'GUARD: regenerate without forbidden vocabulary.',
  );
  const augIdx = out.indexOf('GUARD:');
  const tagIdx = out.indexOf('<user_query>');
  if (augIdx < 0 || tagIdx < 0 || augIdx >= tagIdx) {
    throw new Error('retryAugment must precede the <user_query> block');
  }
});

Deno.test('prompt includes the voice constraints', () => {
  const out = buildDailyNarrationUserPrompt(ctx(), [], '2026-05-10');
  assertStringIncludes(out, 'Maximum 2 sentences');
  assertStringIncludes(out, 'Sentence-case');
  assertStringIncludes(out, 'No exclamation points');
  assertStringIncludes(out, 'never "patient"');
  assertStringIncludes(out, 'never diagnose');
});
