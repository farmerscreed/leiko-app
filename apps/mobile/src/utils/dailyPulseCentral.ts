// Adaptive central value for DailyPulseHero — pure function implementing
// docs/_reference/D13-multi-vitals-constellation-spec.md §7.2.
//
// Priority ladder (first match wins):
//   1. Fresh BP (≤ 8h old)         → "128/82"   label "morning BP" or "latest BP"
//   2. HR sample today (≤ 12h old) → "62"       label "resting HR"
//   3. Last night's sleep recorded → "7h 24m"   label "last night"
//   4. Nothing                     → "—"        label "no readings yet today"
//
// The fallback in case 4 is the only authored user-visible string from
// this helper. It passes voice rules — calm, plain, no fear language.
//
// "Morning BP" vs "latest BP" — if the BP was taken before
// `morningCutoffHour` (local) of the *current* day, label as "morning BP";
// otherwise "latest BP". Default cutoff is 11:00 (matches D13 §7.2 example
// "morning BP" usage). The hero passes `nowLocalHour` separately so this
// helper doesn't need timezone awareness.

const FRESH_BP_WINDOW_MS = 8 * 60 * 60 * 1000;
const FRESH_HR_WINDOW_MS = 12 * 60 * 60 * 1000;
const NO_VALUE_DASH = '—';
const NO_READING_LABEL = 'no readings yet today';

export type DailyPulseCentralSource = 'bp' | 'hr' | 'sleep' | 'none';

export interface DailyPulseCentralInput {
  bp?: { systolic: number; diastolic: number; takenAtEpochMs: number } | null;
  hr?: { restingBpm: number; sampledAtEpochMs: number } | null;
  sleep?: { totalMinutes: number; sessionEndEpochMs: number } | null;
  /** Current epoch ms. */
  nowEpochMs: number;
  /** Hour of day 0..23 in the user's local timezone. Used only to label BP. */
  nowLocalHour: number;
  /** Cutoff hour for "morning BP" label. Defaults to 11. */
  morningCutoffHour?: number;
}

export interface DailyPulseCentral {
  value: string;
  label: string;
  source: DailyPulseCentralSource;
}

function formatBp(systolic: number, diastolic: number): string {
  return `${Math.round(systolic)}/${Math.round(diastolic)}`;
}

function formatHr(bpm: number): string {
  return `${Math.round(bpm)}`;
}

function formatSleep(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function computeDailyPulseCentral(
  input: DailyPulseCentralInput,
): DailyPulseCentral {
  const { bp, hr, sleep, nowEpochMs, nowLocalHour } = input;
  const morningCutoffHour = input.morningCutoffHour ?? 11;

  if (bp && nowEpochMs - bp.takenAtEpochMs <= FRESH_BP_WINDOW_MS) {
    const isMorning = nowLocalHour < morningCutoffHour;
    return {
      value: formatBp(bp.systolic, bp.diastolic),
      label: isMorning ? 'morning BP' : 'latest BP',
      source: 'bp',
    };
  }

  if (hr && nowEpochMs - hr.sampledAtEpochMs <= FRESH_HR_WINDOW_MS) {
    return {
      value: formatHr(hr.restingBpm),
      label: 'resting HR',
      source: 'hr',
    };
  }

  if (sleep && sleep.totalMinutes > 0) {
    return {
      value: formatSleep(sleep.totalMinutes),
      label: 'last night',
      source: 'sleep',
    };
  }

  return {
    value: NO_VALUE_DASH,
    label: NO_READING_LABEL,
    source: 'none',
  };
}
