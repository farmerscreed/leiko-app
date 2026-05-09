// supabase/functions/ai-tier-b/helpers.ts — Sprint 12.
//
// Pure helpers extracted from index.ts so they can be exercised
// without spinning up the Edge Function runtime. Anything that
// touches Supabase / Anthropic / Postgres lives in index.ts.

import type { ScrubbedAiContext } from '../_shared/phi-scrub.ts';

// ── Date math ─────────────────────────────────────────────────────────

export function startOfMonthIso(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return d.toISOString();
}

export function startOfNextMonthIso(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return d.toISOString();
}

// ── DEFER detection ───────────────────────────────────────────────────

export const DEFER_TRIGGERS = new Set([
  'medication',
  'symptom',
  'pregnancy',
  'pediatric',
  'mental_health_crisis',
  'generic',
] as const);

export type DeferTrigger =
  | 'medication'
  | 'symptom'
  | 'pregnancy'
  | 'pediatric'
  | 'mental_health_crisis'
  | 'generic';

export type DeferDetectResult =
  | { isDefer: true; trigger: DeferTrigger }
  | { isDefer: false };

/**
 * Inspect a candidate LLM response for the DEFER / REFUSE control
 * strings the system prompt instructs the model to emit. The system
 * prompt mandates the literal form `DEFER:{trigger}` (D14 §11.1).
 *
 *   - "DEFER:medication"    → { isDefer: true, trigger: 'medication' }
 *   - "REFUSE"              → { isDefer: true, trigger: 'generic' }
 *   - "DEFER:wizardry"      → { isDefer: false } (unknown trigger; treat
 *     as a normal response and let the output guard adjudicate)
 *   - leading/trailing whitespace tolerated
 */
export function detectDefer(text: string): DeferDetectResult {
  const trimmed = text.trim();
  const m = trimmed.match(/^DEFER:([a-z_]+)/i);
  if (m) {
    const t = m[1].toLowerCase();
    if (DEFER_TRIGGERS.has(t as DeferTrigger)) {
      return { isDefer: true, trigger: t as DeferTrigger };
    }
  }
  if (trimmed === 'REFUSE') {
    return { isDefer: true, trigger: 'generic' };
  }
  return { isDefer: false };
}

// ── User-prompt construction ──────────────────────────────────────────

export interface BuildUserPromptOptions {
  question: string;
  context: ScrubbedAiContext;
  /** Optional retry-prompt suffix from layer1 / layer2 augment builders. */
  retryAugment?: string;
}

/**
 * Assemble the user-message body. Wraps the user's question in
 * `<user_query>` tags per D14 §11.2 anti-prompt-injection. Context
 * appears OUTSIDE the tags so the model treats it as factual context
 * about the user, not as an instruction.
 */
export function buildUserPrompt(opts: BuildUserPromptOptions): string {
  const ctxLines: string[] = [];
  ctxLines.push(`Parent label: ${opts.context.parentLabel}`);
  ctxLines.push(`Account type: ${opts.context.accountType}`);
  if (opts.context.yearOfBirth !== null) {
    ctxLines.push(`Year of birth: ${opts.context.yearOfBirth}`);
  }
  if (opts.context.residenceCity !== null) {
    ctxLines.push(`Residence city: ${opts.context.residenceCity}`);
  }
  if (opts.context.bp) {
    const bp = opts.context.bp;
    let line = `BP: ${bp.state} — latest ${bp.latestSystolic}/${bp.latestDiastolic}`;
    if (bp.weekAverageSystolic !== null) {
      line +=
        ` — week avg ${bp.weekAverageSystolic}/${bp.weekAverageDiastolic ?? '?'}`;
    }
    ctxLines.push(line);
  }
  if (opts.context.hr) {
    ctxLines.push(
      `HR: ${opts.context.hr.state} — resting today ` +
        `${opts.context.hr.restingToday ?? '?'} — baseline ` +
        `${opts.context.hr.baseline ?? '?'}`,
    );
  }
  if (opts.context.spo2) {
    ctxLines.push(
      `SpO2: ${opts.context.spo2.state} — latest ` +
        `${opts.context.spo2.latest ?? '?'} — overnight low ` +
        `${opts.context.spo2.overnightLow ?? '?'}`,
    );
  }
  if (opts.context.sleep) {
    ctxLines.push(
      `Sleep: ${opts.context.sleep.state} — last night ` +
        `${opts.context.sleep.lastNightTotalMinutes ?? '?'}min — score ` +
        `${opts.context.sleep.score ?? '?'}`,
    );
  }
  if (opts.context.activity) {
    ctxLines.push(
      `Activity: ${opts.context.activity.state} — today ` +
        `${opts.context.activity.todaySteps ?? '?'} of ` +
        `${opts.context.activity.targetSteps ?? '?'} steps`,
    );
  }

  const retry = opts.retryAugment ? `${opts.retryAugment}\n\n` : '';
  return (
    `${retry}Context:\n${ctxLines.join('\n')}\n\n` +
    `<user_query>\n${opts.question}\n</user_query>`
  );
}
