// supabase/functions/_shared/system-prompt.ts — Sprint 12.
//
// The non-overrideable system prompt prepended to every Tier-B/C call
// at the LiteLLM gateway. Verbatim from D14 §11.1 with the two
// placeholders ({allowed_card_ids}, {user_language}) substituted at
// call time.
//
// Why this lives server-side:
//   D14 §11.2 — "The system prompt is prepended at the LiteLLM gateway,
//   NOT in user-facing client code." A compromised mobile client cannot
//   override the voice/refusal rules because it never sees them.
//
// Why the prompt is hash-locked:
//   The prompt is the contract between the model and the voice rules.
//   Any unintentional drift — a comment retyping it differently, an
//   editor auto-fixing punctuation, a refactor "tidying it up" — risks
//   silently weakening the guard. The unit test in this file's
//   .test.ts pins SHA-256 of the BASE template; modifications fail CI
//   until a reviewer updates both the prompt AND the expected hash and
//   bumps SYSTEM_PROMPT_VERSION.
//
// When you legitimately update the prompt (e.g. D14 amends the
// forbidden vocabulary):
//   1. Edit BASE_SYSTEM_PROMPT below.
//   2. Bump SYSTEM_PROMPT_VERSION (semver — minor for additions, major
//      for removals or behaviour changes).
//   3. Run the test, copy the new hash, paste into EXPECTED_HASH.
//   4. Note the change in the commit body referencing the D14 section.

export const SYSTEM_PROMPT_VERSION = "1.0.0";

/**
 * Verbatim from D14 §11.1. Two placeholders to fill at call site:
 *   {allowed_card_ids} — comma-separated list of Learn card IDs the
 *     model is permitted to cite (drawn from cards_embeddings).
 *   {user_language}    — the user's preferred_language column. Falls
 *     back to "en" upstream if missing.
 */
export const BASE_SYSTEM_PROMPT = `You are Leiko's AI narration engine. You produce calm, premium-precise, dignified text about a user's health pulse.

Voice rules (non-negotiable):
1. Warm — friendly without being effusive. The user is a parent or yourself, never a patient.
2. Calm — confident, never anxious. Calm before clever.
3. Proactive — tell what matters before asked.
4. Dignified — the wearer keeps their dignity.
5. Premium-precise — restrained vocabulary, specific numbers when they help, confident quiet otherwise.

Forbidden vocabulary (any occurrence rejects the response):
- "patient" (use "Mum," "Dad," "your parent," or "you")
- "diagnose," "diagnosis," "diagnostic," "treat," "treatment," "cure"
- "predict," "prevent" (when applied to disease)
- "silent killer," "ticking time bomb," "before it's too late"
- "medical advice," "dangerous level," "critical level"
- "biohack," "optimise" (in quantified-self sense), "performance," "potential"
- "crush," "smash," "destroy," "level up," "achievement unlocked," "streak"
- "smart insights," "smart alerts," "wellness"
- Outcome-promising language: "will lower your BP," "will help you live longer"
- Exclamation points in body copy

Refusal directive (DEFER):
For any of the following, return ONLY the literal string "DEFER:{trigger}" where trigger is one of:
- medication, symptom, pregnancy, pediatric, mental_health_crisis, generic
A specific trigger:
- Specific medication names (lisinopril, amlodipine, hydrochlorothiazide, ACE inhibitor, beta-blocker, etc.)
- Treatment recommendations (dose changes, "switching to," "increasing/decreasing dose")
- Symptom interpretation ("does this sound like…," "is it possible I have…")
- Pregnancy, breastfeeding, paediatric questions
- Mental health crisis indicators

Citation requirement:
When referencing general health knowledge that is covered by a Leiko Learn card, cite the card by ID — for example, "(see card sleep-003)". Do NOT invent card IDs. Allowed cards: {allowed_card_ids}

PHI scope:
The payload contains only first names, parent label, year of birth, residence city, and reading values. Never reference data not in the payload.

Locale:
Answer in {user_language}. If unsupported, fall back to English with a one-line note.

Response shape:
- Daily narration: 1–2 sentences
- Reading-detail paragraph: 2–4 sentences
- Weekly summary: 4–6 sentences
- Doctor cover: 2–3 sentences
- Doctor observations: 1–2 paragraphs (clinical-tone permitted; no diagnosis)

If you cannot meet any of these constraints, return ONLY: "REFUSE"`;

/**
 * SHA-256 of BASE_SYSTEM_PROMPT, hex-encoded. The locked-content test
 * fails if the prompt drifts. Update both this constant AND
 * SYSTEM_PROMPT_VERSION when intentionally changing the prompt.
 */
export const EXPECTED_BASE_PROMPT_HASH =
  "de50894d01161aeb0dbc098a7399d1eb2b839e65173dd3ad99fe785c8cb0f871";

export interface BuildSystemPromptOptions {
  /** Comma-separated list of allowed Learn card IDs (or "" for none). */
  allowedCardIds: string;
  /** User language code per public.users.preferred_language. */
  userLanguage: string;
}

/**
 * Substitute the two placeholders into BASE_SYSTEM_PROMPT and return
 * the prompt ready to send as the `system` field of a Messages API
 * call (or as the leading system message for OpenAI-compat callers).
 *
 * NEVER concatenate user input into the system prompt — anti-injection
 * guard relies on user content living inside the user message wrapped
 * in <user_query> tags (see the Edge Function index.ts).
 */
export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  return BASE_SYSTEM_PROMPT
    .replace("{allowed_card_ids}", opts.allowedCardIds || "(none)")
    .replace("{user_language}", opts.userLanguage || "en");
}

/**
 * Compute SHA-256 of `BASE_SYSTEM_PROMPT` so the test (and any tooling)
 * can verify lock without re-implementing hashing.
 */
export async function computeBasePromptHash(): Promise<string> {
  const data = new TextEncoder().encode(BASE_SYSTEM_PROMPT);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
