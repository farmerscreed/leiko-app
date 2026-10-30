// Story Trends copy — one definition site. Every sentence is an
// OBSERVATION about the person's own band: what moved, since when,
// alongside what. Never why, never a promise, never a clinical
// category. New strings in this file were introduced with the story
// page (founder-commissioned, 2026-08-19) and are voice-linted in the
// suite; flag any change to the founder.

import type { Subject } from './tierVocabulary';

export const storyCopy = {
  pageTitle: 'Your story',
  riverEyebrow: 'Your usual band, over time',
  riverCaption:
    'The ribbon is the range your readings usually land in, recomputed each week. Watch where it goes — that movement is the story.',
  chapters: {
    eyebrow: 'Chapters',
    shiftDown: (weekLabel: string, beforeLow: number, beforeHigh: number, afterLow: number, afterHigh: number): string =>
      `Around ${weekLabel}, the usual band moved from ${beforeLow}–${beforeHigh} down to ${afterLow}–${afterHigh}.`,
    shiftUp: (weekLabel: string, beforeLow: number, beforeHigh: number, afterLow: number, afterHigh: number): string =>
      `Around ${weekLabel}, the usual band moved from ${beforeLow}–${beforeHigh} up to ${afterLow}–${afterHigh}.`,
    medicationAnchor: (label: string, weekLabel: string): string =>
      `${label} joined the log around ${weekLabel}.`,
    movementAnchor: (weekLabel: string): string =>
      `Readings tagged after walking became regular around ${weekLabel}.`,
    alongside: 'What was happening alongside:',
    building:
      'Your story starts here. Once a few weeks of readings are in, this becomes the picture of where your usual range is heading.',
    noChapters:
      "No shifts so far — the usual band has held steady across this window. Steady is a finding too.",
  },
  drivers: {
    eyebrow: 'What moves together',
  },
  doctor: (possessive: string): string =>
    possessive === 'your'
      ? 'Bring this to your doctor'
      : `Bring this to ${possessive} doctor`,
  letterEyebrow: 'What Leiko sees',
} as const;

export function subjectAwareDoctorLine(subject: Subject): string {
  return storyCopy.doctor(subject.possessive);
}


// 2026-10-30 — while the AI summary step is off, the server caches a
// placeholder row (model 'placeholder'). Older rows carry developer text
// ("Tier-C is gated in this environment") that reached users on Trends.
// Show founder-approved copy instead of any placeholder body.
export const PENDING_LETTER_COPY = {
  weekly_summary: "Your weekly summary will appear here once it's ready.",
  monthly_baseline: "Your monthly summary will appear here once it's ready.",
} as const;

export function letterBodyForDisplay(row: {
  body: string;
  surface: string;
  model?: string | null;
}): string {
  const isPlaceholder = row.model === 'placeholder' || /tier-c/i.test(row.body);
  if (!isPlaceholder) return row.body;
  return row.surface === 'monthly_baseline'
    ? PENDING_LETTER_COPY.monthly_baseline
    : PENDING_LETTER_COPY.weekly_summary;
}
