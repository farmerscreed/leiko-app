// services/ai/fallThrough — Sprint 16.
//
// The cascade that guarantees the user never sees an AI error:
//
//   Tier-B → Tier-A template → deterministic safe copy
//
// Per D14 §12 + Sprint 16 acceptance criterion "Failed AI generation:
// never shows error to user; falls through to template". The
// orchestrator emits `ai_degraded_fall_through` on every step-down,
// so a high Tier-B failure rate is observable in analytics even
// though it is silent to the user.
//
// Voice rules (D11 §3): the deterministic copy is calm, never
// prescriptive, never apologetic. It points to "Learn" or "your
// doctor" — the two safe terminuses for any unanswered question.

import { logger } from '../analytics/logger';
import type { TierBResult } from './tierB';

export type FallThroughSurface =
  | 'ask_leiko'
  | 'daily_narration'
  | 'reading_paragraph'
  | 'weekly_summary'
  | 'vital_insight';

export type CascadeSource = 'tier_b' | 'tier_a' | 'deterministic';

/**
 * Tier-B errors that are STRUCTURAL — the user can fix them and the
 * UI should keep surfacing them. These never trigger the silent
 * fall-through; the existing per-error copy stays.
 *
 * "Soft" errors (anything else — network, client_timeout, invoke_failed,
 * unknown server response) are the ones the cascade silences.
 */
const STRUCTURAL_TIER_B_ERRORS = new Set([
  'no_family',
  'no_session',
  'unauthorized',
  'question_too_long',
  'empty_question',
]);

export function isStructuralTierBError(error: string): boolean {
  return STRUCTURAL_TIER_B_ERRORS.has(error);
}

/**
 * Deterministic safe-copy per surface. Voice-clean by construction
 * and tested with voice-lint. These strings are the **last** line of
 * defence — if Tier-B and Tier-A both fail to produce something
 * useful, this is what the user reads.
 */
export const DETERMINISTIC_COPY: Record<FallThroughSurface, string> = {
  ask_leiko:
    "I'm not sure I can answer that one. You might find more in Learn, or talk to your doctor.",
  daily_narration: "Here's your day. Your readings are saved.",
  reading_paragraph:
    'This reading is saved. Trends become clearer over a few days.',
  weekly_summary:
    "Here's your week. The pattern becomes clearer after a few weeks of readings.",
  vital_insight:
    "Patterns appear after a few days of readings. Talk to your doctor for anything specific.",
};

// ── AskLeiko orchestrator ────────────────────────────────────────────

export type AskLeikoCascadeOutcome =
  | { source: 'tier_b'; status: 'ok'; body: string }
  | { source: 'tier_b'; status: 'defer'; trigger: string }
  | { source: 'tier_b'; status: 'quota_exceeded' }
  | { source: 'tier_b'; status: 'structural_error'; reason: string }
  | { source: 'deterministic'; body: string };

/**
 * Map a TierBResult into a cascade outcome for the AskLeiko surface.
 * Soft Tier-B errors degrade silently to a deterministic copy and
 * emit `ai_degraded_fall_through`; structural errors stay visible so
 * the existing per-error UI can render them.
 */
export function mapAskLeikoTierBResult(
  result: TierBResult,
): AskLeikoCascadeOutcome {
  switch (result.status) {
    case 'ok':
      return { source: 'tier_b', status: 'ok', body: result.body };
    case 'defer':
      return { source: 'tier_b', status: 'defer', trigger: result.trigger };
    case 'quota_exceeded':
      return { source: 'tier_b', status: 'quota_exceeded' };
    case 'error': {
      if (isStructuralTierBError(result.error)) {
        return {
          source: 'tier_b',
          status: 'structural_error',
          reason: result.error,
        };
      }
      // Soft error — silent fall-through to deterministic copy. The
      // AskLeiko surface has no Tier-A template (the user already
      // landed on the unclassified branch that called Tier-B), so
      // we skip Tier-A and land at deterministic in one hop.
      logger.track('ai_degraded_fall_through', {
        surface: 'ask_leiko',
        from: 'tier_b',
        to: 'deterministic',
        reason: result.error,
      });
      return {
        source: 'deterministic',
        body: DETERMINISTIC_COPY.ask_leiko,
      };
    }
  }
}

// ── Generic single-string cascade ─────────────────────────────────────

export interface SingleStringCascadeInput {
  surface: FallThroughSurface;
  /**
   * Call Tier-B. Resolves to a body when ok, or null when the caller
   * deliberately skipped Tier-B (e.g. free user, network unavailable
   * before the call was attempted, surface that doesn't use Tier-B).
   *
   * If the Tier-B path errors INSIDE the function, the caller is
   * responsible for catching and returning null. The cascade trusts
   * the return value.
   */
  tierB: () => Promise<string | null>;
  /**
   * Compute Tier-A. Return null when no template matches the input.
   */
  tierA: () => string | null;
  /**
   * Optional override of the deterministic copy. Defaults to
   * DETERMINISTIC_COPY[surface].
   */
  deterministic?: string;
}

export interface SingleStringCascadeResult {
  source: CascadeSource;
  body: string;
}

/**
 * Generic cascade for surfaces that consume a single rendered string
 * (daily narration, reading paragraph, weekly summary, contextual
 * paragraphs). Tier-B fails or returns null → fall to Tier-A. Tier-A
 * returns null → fall to deterministic.
 *
 * Emits `ai_degraded_fall_through` on every step-down with the reason
 * code. The body is never logged.
 */
export async function runSingleStringCascade(
  input: SingleStringCascadeInput,
): Promise<SingleStringCascadeResult> {
  const deterministic =
    input.deterministic ?? DETERMINISTIC_COPY[input.surface];

  // Tier-B.
  let tierBBody: string | null = null;
  let tierBReason = 'unavailable';
  try {
    tierBBody = await input.tierB();
    if (tierBBody === null) tierBReason = 'returned_null';
  } catch (e) {
    tierBBody = null;
    tierBReason = e instanceof Error ? e.message : 'unknown';
  }
  if (tierBBody !== null && tierBBody.length > 0) {
    return { source: 'tier_b', body: tierBBody };
  }

  // Tier-A.
  let tierAResult: string | null = null;
  try {
    tierAResult = input.tierA();
  } catch (e) {
    tierAResult = null;
    tierBReason = e instanceof Error ? `tier_a:${e.message}` : tierBReason;
  }
  if (tierAResult !== null && tierAResult.length > 0) {
    logger.track('ai_degraded_fall_through', {
      surface: input.surface,
      from: 'tier_b',
      to: 'tier_a',
      reason: tierBReason,
    });
    return { source: 'tier_a', body: tierAResult };
  }

  // Deterministic — last resort.
  logger.track('ai_degraded_fall_through', {
    surface: input.surface,
    from: 'tier_a',
    to: 'deterministic',
    reason: 'no_template',
  });
  return { source: 'deterministic', body: deterministic };
}
