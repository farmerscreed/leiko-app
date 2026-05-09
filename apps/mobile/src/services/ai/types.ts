// AI module — shared types. Sprint 11 task 1.
//
// The Tier-A intent router (Sprint 11), Tier-B integration (Sprint 12),
// and the ambient-AI surfaces (Sprint 12.5) all share this taxonomy:
//
//   IntentCategory: which broad bucket a question falls into
//   ResponseMode:   what the assistant DOES with the question (per D9 §7.1)
//   DeferTrigger:   which DEFER template fires when the answer is "talk
//                   to your doctor" (per D14 §11 + docs/07-ai-assistant.md §4)
//
// Sourced from:
//   docs/_reference/D14-ambient-ai-architecture.md §9 (intent router scope)
//   docs/_reference/D14-ambient-ai-architecture.md §11 (DEFER refusal directive)
//   docs/_reference/D9-editorial.md §7 (ANSWER / EDUCATE / DEFER modes)
//   docs/07-ai-assistant.md §3 (intent classes baseline)

/**
 * Coarse bucket for an intent class. Used for analytics rollups and
 * for routing decisions ("any oos. → DEFER without further work").
 */
export type IntentCategory =
  | 'faq' // factual definition questions ("what is SpO2")
  | 'reading' // single-reading interpretation ("is this normal")
  | 'pattern' // multi-reading / cross-vital observations
  | 'troubleshoot' // device or sync questions
  | 'how-to' // app-feature questions ("how do I share with my doctor")
  | 'defer' // user is asking for medication / symptom / dose advice
  | 'oos'; // pregnancy / paediatric / mental-health-crisis / etc.

/**
 * What the assistant DOES with the question, per docs/_reference/D9-editorial.md §7.1.
 *
 *   ANSWER  — direct in-band reply
 *   EDUCATE — short answer + link to a Learn card
 *   DEFER   — refuse with a calm "talk to your doctor" template
 */
export type ResponseMode = 'ANSWER' | 'EDUCATE' | 'DEFER';

/**
 * The six DEFER trigger categories per D14 §11 + docs/07-ai-assistant.md §4.
 * The system prompt itself returns "DEFER:{trigger}"; the local intent
 * router shortcuts that for known patterns and surfaces the same
 * template directly without a network call.
 */
export type DeferTrigger =
  | 'medication'
  | 'symptom'
  | 'pregnancy'
  | 'paediatric'
  | 'mental_health_crisis'
  | 'generic';

/**
 * A single intent class — the unit the router matches against.
 *
 * Patterns are evaluated in order; the first to match wins. Within a
 * single intent, multiple patterns may coexist for synonyms or
 * phrasing variations.
 */
export interface Intent {
  id: string;
  category: IntentCategory;
  /**
   * Human-readable description for the router doc + analytics dashboards.
   * Not surfaced to the user.
   */
  description: string;
  patterns: RegExp[];
  responseMode: ResponseMode;
  /**
   * For ANSWER intents — the templated reply. May contain
   * `{vital_value}` / `{parent_label}` placeholders that the future
   * Sprint 12.5 generator will substitute. Absent for EDUCATE
   * (the linked card carries the answer) and DEFER (the trigger
   * resolves to a template).
   */
  answerTemplate?: string;
  /**
   * For EDUCATE intents — the canonical Learn card id to cite.
   * Must match a frontmatter id in src/learn/articles.
   */
  cardId?: string;
  /**
   * For EDUCATE — short lead-in shown before the card link
   * ("Here's a quick read on this — see card numbers-001"). When
   * absent, the renderer uses a default lead-in.
   */
  educateLeadIn?: string;
  /**
   * For DEFER intents — which DEFER template fires.
   */
  deferTrigger?: DeferTrigger;
}

export interface IntentMatch {
  /** The matched intent — null when nothing in INTENTS matched. */
  intent: Intent | null;
  /** The pattern source string that matched (debugging). */
  matchedPattern: string | null;
  /**
   * The response mode the caller should render. When `intent` is
   * null, this is `'TIER_B_PLACEHOLDER'` — the caller surfaces the
   * "I'm not sure how to answer that yet — try rephrasing" copy.
   */
  responseMode: ResponseMode | 'TIER_B_PLACEHOLDER';
}

/**
 * Narration template — the building blocks of the Daily Pulse line
 * per D14 §3.3. Sprint 11 ships the LIBRARY; Sprint 12.5 builds the
 * generator that picks + substitutes.
 *
 * `selector` is the predicate that decides if this template applies
 * to a given vital-state tuple. Multiple templates may match; the
 * generator picks the highest-priority. Selectors are pure
 * functions over a `NarrationContext` (defined in
 * services/ai/narrationTemplates.ts to avoid a circular type
 * import here).
 */
export interface NarrationTemplate {
  /** Stable id for analytics + tests. */
  id: string;
  /** Human-readable description (what the template is FOR). */
  description: string;
  /** Free-form template text with `{slot}` placeholders. */
  text: string;
  /** Higher = preferred when multiple templates match the same context. */
  priority: number;
}

/** Output of the keyword card-matcher's first stage. */
export interface CardMatchResult {
  cardId: string;
  /** 0..1 — how strongly the question matched (1.0 = direct keyword hit). */
  score: number;
  /** Which keyword(s) matched, useful for debugging. */
  matchedKeywords: string[];
}
