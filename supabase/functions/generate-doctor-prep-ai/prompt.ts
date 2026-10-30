// Prompt helpers for generate-doctor-prep-ai (kept import-light so
// they can be unit-tested without the Supabase client).
import type { ScrubbedAiContext } from '../_shared/phi-scrub.ts';

/**
 * The BP line for both prompts. 2026-10-30 release audit: the cover
 * paragraph said "readings over the past month show systolic 133 … on
 * the latest reading" when that reading was 32 days old and the PDF's
 * own BP section said "No readings in this range". The latest reading
 * now carries its date, and one older than the range is marked so.
 */
export function bpPromptLine(context: ScrubbedAiContext, startDate: string): string {
  if (!context.bp) return 'BP — no readings in this date range.';
  const day = new Date(context.bp.latestMeasuredAtDayUtcSec * 1000).toISOString().slice(0, 10);
  if (day < startDate) {
    return `BP — no readings in this date range (the most recent, ${day}, is before it; do not describe it as part of this period).`;
  }
  return `BP — latest ${context.bp.latestSystolic}/${context.bp.latestDiastolic} on ${day}, week avg ${context.bp.weekAverageSystolic ?? '?'}/${context.bp.weekAverageDiastolic ?? '?'}, state ${context.bp.state}`;
}

