// services/reminders/learnedTime — Sprint 12.5.
//
// Learned-time reminder pattern engine per D14 §5. NO LLM — pure
// pattern matching over the user's last 30 BP readings. The
// reminder fires as a local push when the user's habitual reading
// time has passed without a sync today.
//
// Algorithm (D14 §5.2):
//   1. Take the last 30 visible BP readings (drop hidden / suspect).
//   2. Compute each reading's local time-of-day in minutes from
//      midnight.
//   3. Median + median-absolute-deviation of those minutes.
//   4. Habit threshold: MAD ≤ 90 minutes. Above that, the user has
//      no habit and we skip the reminder entirely.
//   5. Round the median to the nearest 15 minutes — that's the
//      habitual reading time.
//   6. Schedule a push at (habitual_time + 30 min) IF no reading
//      arrived today by then.
//
// Suppression (D14 §5.4):
//   • Max 2 reminders per day per user.
//   • Quiet hours 22:00–07:00 local — never fire inside that window.
//   • Suppress if the last reading is < 4h ago (recent capture
//     from a different time of day).
//   • Decay: if the user has tapped "remind me later" twice this
//     week, suppress the next reminder.
//
// Voice copy (D14 §5.3) is hand-written, not LLM-generated:
//   "Mum usually takes her reading by 7:45. The watch hasn't synced today."

import type { LocalReading } from '../../state/readings';

const SAMPLE_TARGET = 30;
export const HABIT_MAD_THRESHOLD_MIN = 90;
export const REMINDER_OFFSET_MIN = 30;
export const RECENT_READING_SUPPRESS_HOURS = 4;
export const QUIET_HOURS_START_LOCAL_MIN = 22 * 60; // 22:00
export const QUIET_HOURS_END_LOCAL_MIN = 7 * 60; // 07:00

// ── Pure helpers ──────────────────────────────────────────────────────

/**
 * Convert a unix-second timestamp to local minutes-from-midnight,
 * using the device's local timezone (JS Date does the heavy
 * lifting). Sprint 7.5's LocalReading stores measuredAtSec as
 * unix UTC; the user opens the app in their device timezone, so
 * the JS Date conversion is what drives perceived "morning".
 */
export function localMinutesFromMidnight(unixSec: number): number | null {
  if (!Number.isFinite(unixSec)) return null;
  const d = new Date(unixSec * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/** Median of a numeric array. Returns NaN for empty input. */
export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Median absolute deviation. */
export function medianAbsoluteDeviation(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m)));
}

/** Round minutes-from-midnight to the nearest 15-minute slot. */
export function roundToFifteen(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

/** Format minutes-from-midnight as "7:45" / "14:30" (24-hour). */
export function formatLocalTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Format minutes-from-midnight as "7:45" (12-hour, no am/pm). */
export function formatLocalTime12h(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, '0')}`;
}

// ── Habit detection ───────────────────────────────────────────────────

export interface HabitResult {
  /** True when the readings cluster tightly enough to call a habit. */
  hasHabit: boolean;
  /** Median time-of-day in minutes-from-midnight, rounded to 15. */
  habitualTimeMin: number | null;
  /** MAD in minutes. < HABIT_MAD_THRESHOLD_MIN means tight. */
  madMinutes: number;
  /** Sample size used (after the visibility filter). */
  sampleSize: number;
}

/**
 * Pure function — no I/O. Pass the user's recent BP readings, get
 * back whether they have a habit + when. Designed to be unit-
 * tested without React / MMKV.
 */
export function detectReadingHabit(readings: LocalReading[]): HabitResult {
  // Reading visibility: the LocalReading shape doesn't carry the
  // `hidden` flag (that's on the server row); we use the full set
  // and let the caller pre-filter if needed. classification.tier
  // covers quality_score implicitly — confirmed_urgent stays
  // visible in the habit pattern.
  const samples = readings
    .slice(0, SAMPLE_TARGET)
    .map((r) => localMinutesFromMidnight(r.measuredAtSec))
    .filter((v): v is number => v !== null);

  if (samples.length < 7) {
    // Need at least a week of cadence to call a habit. Below that
    // the median is too noisy.
    return {
      hasHabit: false,
      habitualTimeMin: null,
      madMinutes: Number.NaN,
      sampleSize: samples.length,
    };
  }

  const med = median(samples);
  const mad = medianAbsoluteDeviation(samples);
  if (mad > HABIT_MAD_THRESHOLD_MIN) {
    return {
      hasHabit: false,
      habitualTimeMin: roundToFifteen(med),
      madMinutes: mad,
      sampleSize: samples.length,
    };
  }

  return {
    hasHabit: true,
    habitualTimeMin: roundToFifteen(med),
    madMinutes: mad,
    sampleSize: samples.length,
  };
}

// ── Suppression ───────────────────────────────────────────────────────

export interface SuppressionInput {
  habit: HabitResult;
  /** Local minutes-from-midnight right now. */
  nowLocalMin: number;
  /** Unix seconds — used to compute "minutes since last reading". */
  nowSec: number;
  /**
   * The user's most recent reading. When null, no readings exist
   * yet — no habit is possible either; the upstream habit check
   * already returned hasHabit=false in that case.
   */
  lastReadingSec: number | null;
  /** How many reminders have already fired today. */
  remindersFiredToday: number;
  /** "Remind me later" taps in the last 7 days. */
  remindMeLaterCountThisWeek: number;
}

export interface SuppressionResult {
  shouldFire: boolean;
  reason: SuppressReason | null;
}

export type SuppressReason =
  | 'no_habit'
  | 'before_reminder_window'
  | 'recent_reading_within_4h'
  | 'quiet_hours'
  | 'daily_cap_reached'
  | 'decayed_remind_me_later';

const HOURS = 60 * 60;

/**
 * Pure decision over the suppression rules in D14 §5.4. The order
 * matters — a "no habit" user never even reaches the cap check.
 */
export function shouldFireReminder(input: SuppressionInput): SuppressionResult {
  if (!input.habit.hasHabit || input.habit.habitualTimeMin === null) {
    return { shouldFire: false, reason: 'no_habit' };
  }

  const reminderTimeMin = input.habit.habitualTimeMin + REMINDER_OFFSET_MIN;
  if (input.nowLocalMin < reminderTimeMin) {
    return { shouldFire: false, reason: 'before_reminder_window' };
  }

  // Quiet hours — wraps midnight (22:00–07:00).
  const inQuietHours =
    input.nowLocalMin >= QUIET_HOURS_START_LOCAL_MIN ||
    input.nowLocalMin < QUIET_HOURS_END_LOCAL_MIN;
  if (inQuietHours) {
    return { shouldFire: false, reason: 'quiet_hours' };
  }

  // Recent reading suppress.
  if (input.lastReadingSec !== null) {
    const ageHours = (input.nowSec - input.lastReadingSec) / HOURS;
    if (ageHours < RECENT_READING_SUPPRESS_HOURS) {
      return { shouldFire: false, reason: 'recent_reading_within_4h' };
    }
  }

  if (input.remindersFiredToday >= 2) {
    return { shouldFire: false, reason: 'daily_cap_reached' };
  }

  if (input.remindMeLaterCountThisWeek >= 2) {
    return { shouldFire: false, reason: 'decayed_remind_me_later' };
  }

  return { shouldFire: true, reason: null };
}

// ── Push copy ─────────────────────────────────────────────────────────

/**
 * D14 §5.3 — hand-written push copy. parentLabel comes from
 * `families.parent_display_name` for caregiver mode and
 * `users.display_name` (or "you") for self-buyer.
 */
export function buildLearnedTimeReminderCopy(opts: {
  parentLabel: string;
  habitualTimeMin: number;
  /** When true, addresses the user directly ("you usually take…"). */
  isSelf?: boolean;
}): { title: string; body: string } {
  const time = formatLocalTime12h(opts.habitualTimeMin);
  if (opts.isSelf) {
    return {
      title: 'Today is open.',
      body: `You usually take your reading by ${time}. The watch hasn't synced today.`,
    };
  }
  return {
    title: `${opts.parentLabel}'s reading hasn't come in yet.`,
    body: `${opts.parentLabel} usually takes a reading by ${time}. The watch hasn't synced today.`,
  };
}
