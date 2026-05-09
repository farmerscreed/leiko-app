// Deno tests for system-prompt — Sprint 12.
//
// The hash-lock test is the most consequential one in this file: it is
// the canary that fires when someone modifies the system prompt
// without going through the documented update flow (bump version, copy
// new hash, reference D14 section in the commit).

import { assertEquals, assertNotEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  BASE_SYSTEM_PROMPT,
  EXPECTED_BASE_PROMPT_HASH,
  SYSTEM_PROMPT_VERSION,
  buildSystemPrompt,
  computeBasePromptHash,
} from './system-prompt.ts';

Deno.test('BASE_SYSTEM_PROMPT hash matches the locked value', async () => {
  const actual = await computeBasePromptHash();
  // If this assertion fails: read the message above EXPECTED_BASE_PROMPT_HASH
  // in system-prompt.ts and follow the documented update flow.
  assertEquals(actual, EXPECTED_BASE_PROMPT_HASH);
});

Deno.test('SYSTEM_PROMPT_VERSION is semver-shaped', () => {
  // Sprint-12 launch version is 1.0.0; tested loosely so future minor
  // bumps don't fail this test — only obviously malformed versions do.
  const semver = /^\d+\.\d+\.\d+$/;
  if (!semver.test(SYSTEM_PROMPT_VERSION)) {
    throw new Error(`SYSTEM_PROMPT_VERSION not semver: ${SYSTEM_PROMPT_VERSION}`);
  }
});

Deno.test('BASE_SYSTEM_PROMPT contains the verbatim D14 §11.1 forbidden vocabulary set', () => {
  // Spot-check the most consequential rules. If any of these get
  // re-worded, the hash will fail anyway, but these explicit asserts
  // make the failure mode obvious.
  for (const phrase of [
    'You are Leiko\'s AI narration engine',
    'patient',
    'diagnose',
    'silent killer',
    'biohack',
    'level up',
    'smart insights',
    'will lower your BP',
    'DEFER:{trigger}',
    'Allowed cards: {allowed_card_ids}',
    'Answer in {user_language}',
    'return ONLY: "REFUSE"',
  ]) {
    assertStringIncludes(BASE_SYSTEM_PROMPT, phrase);
  }
});

Deno.test('buildSystemPrompt substitutes {allowed_card_ids} and {user_language}', () => {
  const out = buildSystemPrompt({
    allowedCardIds: 'bp-001,bp-002,sleep-003',
    userLanguage: 'en',
  });
  assertStringIncludes(out, 'Allowed cards: bp-001,bp-002,sleep-003');
  assertStringIncludes(out, 'Answer in en.');
  // The placeholder strings themselves must NOT survive substitution.
  assertEquals(out.includes('{allowed_card_ids}'), false);
  assertEquals(out.includes('{user_language}'), false);
});

Deno.test('buildSystemPrompt falls back to "(none)" when no card ids supplied', () => {
  const out = buildSystemPrompt({ allowedCardIds: '', userLanguage: 'en' });
  assertStringIncludes(out, 'Allowed cards: (none)');
});

Deno.test('buildSystemPrompt falls back to en when language empty', () => {
  const out = buildSystemPrompt({ allowedCardIds: 'bp-001', userLanguage: '' });
  assertStringIncludes(out, 'Answer in en.');
});

Deno.test('buildSystemPrompt does not accidentally mutate BASE_SYSTEM_PROMPT', async () => {
  const before = await computeBasePromptHash();
  buildSystemPrompt({ allowedCardIds: 'x', userLanguage: 'en' });
  buildSystemPrompt({ allowedCardIds: 'y', userLanguage: 'fr' });
  const after = await computeBasePromptHash();
  assertEquals(before, after);
  // Sanity: the produced prompt is NOT the base — substitution did happen.
  const built = buildSystemPrompt({ allowedCardIds: 'x', userLanguage: 'en' });
  assertNotEquals(built, BASE_SYSTEM_PROMPT);
});
