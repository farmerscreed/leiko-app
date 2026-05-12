// Deno tests for voice-lint-push — Sprint 15.

import { assertEquals, assert } from 'jsr:@std/assert@1';
import { lintPushText } from './voice-lint-push.ts';

Deno.test('voice-lint-push — calm-concerned copy passes', () => {
  const result = lintPushText("Mum's reading just now was higher than usual: 158/96. We've added it to her log.");
  assertEquals(result.passes, true);
  assertEquals(result.hardHits.length, 0);
});

Deno.test('voice-lint-push — confirmed-urgent copy passes', () => {
  const result = lintPushText('Three high readings in the last hour. We recommend reaching out to Dad now.');
  assertEquals(result.passes, true);
});

Deno.test('voice-lint-push — flags "patient"', () => {
  const result = lintPushText('Your patient had a high reading.');
  assertEquals(result.passes, false);
  assert(result.hardHits.some((h) => h.match.toLowerCase() === 'patient'));
});

Deno.test('voice-lint-push — flags "alert"', () => {
  const result = lintPushText('Health alert: please check Mum.');
  assertEquals(result.passes, false);
});

Deno.test('voice-lint-push — flags "critical"', () => {
  const result = lintPushText('Critical reading recorded.');
  assertEquals(result.passes, false);
});

Deno.test('voice-lint-push — flags fear language', () => {
  const result = lintPushText("Don't let it become a silent killer.");
  assertEquals(result.passes, false);
});

Deno.test('voice-lint-push — flags shouting', () => {
  const result = lintPushText('Check Mum now!!');
  assertEquals(result.passes, false);
});

Deno.test('voice-lint-push — flags "diagnose"', () => {
  const result = lintPushText('We can help diagnose your hypertension.');
  assertEquals(result.passes, false);
});

Deno.test('voice-lint-push — flags "optimize" (D11 §3.3)', () => {
  const result = lintPushText('Optimize your morning numbers.');
  assertEquals(result.passes, false);
});

Deno.test('voice-lint-push — flags "loved ones"', () => {
  const result = lintPushText('Keep your loved ones safe.');
  assertEquals(result.passes, false);
});
