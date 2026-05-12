// services/ai/trendsNarration — Trends v2.
//
// Produces a voice-clean Tier-A narrative paragraph for the Trends
// screen. Plugs through the Sprint 16 fall-through cascade so the
// surface never shows an "AI failed" error — Tier-B (when wired) →
// Tier-A template → deterministic copy.
//
// Narrative shape: a plain string with a tiny markup syntax for
// italic emphasis. `_text_` wraps an emphasized clause (rendered in
// italic editorial type). The renderer in TrendsLetterHero splits on
// these markers and styles the spans inline. This is forward-
// compatible with the structured-spans contract the design brief
// flags as an open question — once the Tier-B path emits structured
// spans, we replace the string + regex with a typed array; the
// renderer signature stays the same.
//
// Voice rules (D11 §3 / docs/05-voice-and-claims.md): every authored
// string here passes voiceLint. Tested in trendsNarration.test.ts.

import {
  runSingleStringCascade,
  type SingleStringCascadeResult,
} from './fallThrough';
import type { TrendsData, TrendsRange } from '../../utils/trends-aggregate';
import type { CorrelationRow, AccountType } from '../../types/database';

export interface BuildTrendsNarrativeInput {
  data: TrendsData | undefined;
  correlations: CorrelationRow[];
  range: TrendsRange;
  accountType: AccountType;
  /** "Mum" / "Dad" / user's chosen label. */
  parentLabel?: string;
}

const RANGE_LABEL: Record<TrendsRange, string> = {
  '7d': 'week',
  '30d': 'month',
  '90d': 'quarter',
  '1y': 'year',
  all_time: 'time',
};

/**
 * Format a clause that names the average BP value in the user's
 * tracked window. Returns empty string when there's no BP data, so
 * the caller can skip the sentence entirely.
 */
function bpAverageClause(data: TrendsData | undefined): string {
  if (!data) return '';
  const { avgSys, avgDia } = data.summary.bp;
  if (avgSys === null || avgDia === null) return '';
  return `${Math.round(avgSys)}/${Math.round(avgDia)}`;
}

/**
 * Map a correlation row to one short clause that the narrative can
 * cite. Voice-clean, descriptive (never prescriptive).
 */
function correlationClause(row: CorrelationRow): string {
  switch (row.correlation_type) {
    case 'sleep_x_morning_bp':
      return 'after the shorter nights, mornings ran a little higher';
    case 'activity_x_resting_hr':
      return 'on the walking days, your heart wakes calmer';
    case 'spo2_dip_x_sleep_score':
      return 'the nights your oxygen dipped were the lighter nights';
    default:
      return '';
  }
}

/**
 * Caregiver variant — same shape, parent-aware pronouns. Returns the
 * caregiver-flavoured clause from a correlation row.
 */
function correlationClauseCaregiver(
  row: CorrelationRow,
  parentLabel: string,
): string {
  switch (row.correlation_type) {
    case 'sleep_x_morning_bp':
      return `after ${parentLabel}'s shorter nights, mornings ran a little higher`;
    case 'activity_x_resting_hr':
      return `on the walking days, ${parentLabel}'s heart wakes calmer`;
    case 'spo2_dip_x_sleep_score':
      return `the nights ${parentLabel}'s oxygen dipped were the lighter nights`;
    default:
      return '';
  }
}

/**
 * The Tier-A template. Composes a short letter-like paragraph from
 * the trends summary + the strongest correlation, if one exists.
 * Falls back to a softer phrasing when only a subset of data is
 * available.
 *
 * Returns `null` when there isn't enough data to author a meaningful
 * paragraph — the cascade will then fall through to deterministic.
 */
export function buildTierATrendsNarrative(
  input: BuildTrendsNarrativeInput,
): string | null {
  const { data, correlations, range, accountType, parentLabel } = input;
  if (!data) return null;

  const bpCount = data.summary.bp.count;
  // Need at least a few BP readings before authoring a "you are in
  // pattern" sentence — be honest about thinness.
  if (bpCount < 3) return null;

  const isCaregiver = accountType === 'caregiver';
  const subject = isCaregiver ? (parentLabel ?? 'Mum') : 'You';
  const verb = isCaregiver ? 'is' : 'are';
  const possessive = isCaregiver ? `${parentLabel ?? 'Mum'}'s` : 'your';
  const windowLabel = RANGE_LABEL[range];
  const avg = bpAverageClause(data);

  const pieces: string[] = [];

  // Lead clause — pattern + emphasis.
  if (avg) {
    pieces.push(
      `${subject} ${verb} _in pattern_ this ${windowLabel}. ${capitalize(
        possessive,
      )} mornings averaged ${avg}.`,
    );
  } else {
    pieces.push(`${subject} ${verb} _in pattern_ this ${windowLabel}.`);
  }

  // Correlation clause — append the strongest meaningful one.
  const top = correlations[0];
  if (top) {
    const clause = isCaregiver
      ? correlationClauseCaregiver(top, parentLabel ?? 'Mum')
      : correlationClause(top);
    if (clause) pieces.push(`And ${clause}.`);
  }

  return pieces.join(' ');
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Cascade integration ──────────────────────────────────────────────

/**
 * Generate the trends narrative through the Sprint 16 fall-through
 * cascade. Tier-B is not yet wired for this surface; the cascade
 * skips straight to Tier-A. When Tier-B lands later, swap the first
 * argument for an Edge Function call.
 */
export async function generateTrendsNarrative(
  input: BuildTrendsNarrativeInput,
): Promise<SingleStringCascadeResult> {
  return runSingleStringCascade({
    surface: 'trends_narrative',
    // Tier-B not wired yet for Trends — omit the tierB callback so the
    // cascade skips straight to Tier-A without logging a fake
    // degradation event. When the Edge Function path lands, pass the
    // async call here.
    tierA: () => buildTierATrendsNarrative(input),
    // Deterministic default lives in fallThrough.DETERMINISTIC_COPY
    // under `trends_narrative`. The cascade resolves it.
  });
}

// ── Span renderer helpers ────────────────────────────────────────────

export interface NarrativeSpan {
  text: string;
  em?: boolean;
}

/**
 * Parse a narrative string with `_text_` italic markers into a list
 * of spans the renderer can apply per-span styling to. The markers
 * are stripped; their content gets `em: true`.
 *
 * Forward-compatible: when Tier-B starts emitting structured spans
 * directly, this function disappears in favour of a typed pass-
 * through. Test coverage exercises mixed plain + emphasized content.
 */
export function parseNarrativeSpans(body: string): NarrativeSpan[] {
  if (!body) return [];
  const spans: NarrativeSpan[] = [];
  // Match `_text_` non-greedily. Underscores inside words remain as-is
  // (the next-character check is enforced by the surrounding word
  // boundary — `_pattern_` matches; `snake_case` does not).
  const re = /_([^_]+?)_/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: body.slice(lastIndex, match.index) });
    }
    spans.push({ text: match[1], em: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    spans.push({ text: body.slice(lastIndex) });
  }
  return spans.length === 0 ? [{ text: body }] : spans;
}
