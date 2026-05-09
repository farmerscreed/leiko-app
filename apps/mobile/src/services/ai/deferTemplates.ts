// AI module — DEFER trigger templates. Sprint 11 task 5.
//
// Six DEFER categories per docs/_reference/D14-ambient-ai-architecture.md
// §11 + docs/07-ai-assistant.md §4. The local intent router shortcuts
// known-pattern questions (specific medication, symptom interpretation,
// pregnancy, paediatric, mental-health-crisis) directly to these
// templates without a network call.
//
// Voice rules: every string passes services/voice/voiceLint
// (HARD-clean). The articles voice-lint integration test scans this
// file at PR time.

import type { DeferTrigger } from './types';

/**
 * Map from DEFER trigger to the user-facing template string.
 *
 * Sourced from docs/07-ai-assistant.md §4 (DEFER template strings)
 * with the IFU-prescribed wording preserved verbatim.
 */
export const DEFER_TEMPLATES: Readonly<Record<DeferTrigger, string>> = {
  medication:
    "Decisions about medication are best made with your doctor or pharmacist — they know what else you're taking and what's right for you.",
  symptom:
    "Symptoms can mean different things in different people. Worth a chat with your doctor about what you're feeling.",
  pregnancy:
    "Leiko isn't designed for pregnancy or for younger users — those situations need a clinician who can use the right monitor and the right thresholds.",
  paediatric:
    "Leiko isn't designed for younger users — those situations need a clinician who can use the right monitor and the right thresholds for a child.",
  mental_health_crisis:
    "This sounds heavy. If you're struggling, please reach out to a friend, family member, or local crisis line. You're not alone in this.",
  generic:
    "That's outside what I can help with. Your doctor is the right person for this one.",
};

export function deferTemplateFor(trigger: DeferTrigger): string {
  return DEFER_TEMPLATES[trigger];
}
