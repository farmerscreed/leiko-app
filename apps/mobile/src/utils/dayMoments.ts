// Day Moments — Sprint 8 (Self-Buyer Home).
//
// Pure helpers for the "Through your day" section on the Self-Buyer Home
// (DaySpine component). Two exports:
//
//   pickCentralValue(data, nowSec)
//     D13 §7.2 adaptive central-value selector: BP fresh ≤8h →
//     resting HR ≤12h → last night's sleep → "—". Returns the
//     pre-formatted display string + the eyebrow label below it.
//
//   deriveDayMoments(data, nowSec)
//     Turns DailyPulseData (the composed selector output from
//     state/dailyPulse.ts) into a sorted Moment[] suitable for the
//     DaySpine renderer. No AI prose — calm factual moment titles
//     sourced from real readings + sleep boundaries (Sprint 8 ships
//     option-b per the founder's pick: real moments, no AI).
//
// Voice rules (docs/05-voice-and-claims.md): every string returned
// from this file is user-visible. No "patient" / "diagnose" / "predict"
// / "dangerous" / "critical". Reassuring tone by default; calm-concerned
// tone only when the underlying classification calls for it. The
// copy-lint scanner picks up these strings via the import graph.
//
// All time math uses unix seconds for consistency with the rest of the
// vital stores. The "today" boundary is computed from `nowSec` so tests
// can pin time without freezing the system clock.
//
// SpO2 dip detection (D13 §6.6 staleness aside): the spec doesn't define
// a "dip moment" — that's a Sprint 12.5 ambient-AI surface. We render an
// SpO2 moment only when the latest sample is calm-concerned (overnight
// low ≤ 92%, per classifySpO2). This keeps the spine grounded in real
// data without inventing AI-narrative moments early.

import type { DailyPulseData } from '../state/dailyPulse';

const FRESH_BP_WINDOW_SEC = 8 * 60 * 60;
const HR_FRESH_WINDOW_SEC = 12 * 60 * 60;
const TODAY_LOOKBACK_SEC = 24 * 60 * 60;
const SPO2_DIP_THRESHOLD_PERCENT = 92;
const NOON_HOUR_LOCAL = 12;

export type CentralPriority = 'bp' | 'hr' | 'sleep' | 'none';

export interface CentralValue {
  /** Pre-formatted display string for the hero centre. */
  value: string;
  /** Eyebrow label rendered under the value ("morning BP", "resting HR", etc.). */
  label: string;
  /** Which priority level resolved — used for analytics + tests. */
  priority: CentralPriority;
}

/**
 * D13 §7.2 — adaptive central value selector. Pure; pinnable via nowSec.
 *
 * `nowSec` defaults to the system clock. Tests pass an explicit value to
 * exercise the four priority states deterministically.
 */
export function pickCentralValue(
  data: DailyPulseData,
  nowSec: number = Math.floor(Date.now() / 1000),
): CentralValue {
  // 1. Fresh BP ≤ 8h. The "morning BP" vs "latest BP" label keys off
  // the BP sample's own local hour, not the current clock — so a 6:42am
  // reading still reads as "morning BP" if you open the app at 11am.
  const bp = data.bp.latest;
  if (bp && data.bp.latestSampleSec !== null) {
    const ageSec = nowSec - data.bp.latestSampleSec;
    if (ageSec >= 0 && ageSec <= FRESH_BP_WINDOW_SEC) {
      const isMorning = isMorningLocal(data.bp.latestSampleSec);
      return {
        value: `${bp.systolic}/${bp.diastolic}`,
        label: isMorning ? 'morning BP' : 'latest BP',
        priority: 'bp',
      };
    }
  }

  // 2. Resting HR today.
  if (data.hr.restingToday !== null && data.hr.latestSampleSec !== null) {
    const ageSec = nowSec - data.hr.latestSampleSec;
    if (ageSec >= 0 && ageSec <= HR_FRESH_WINDOW_SEC) {
      return {
        value: String(data.hr.restingToday),
        label: 'resting HR',
        priority: 'hr',
      };
    }
  }

  // 3. Last night's sleep.
  if (data.sleep.session) {
    return {
      value: formatSleepDuration(data.sleep.session.totalMinutes),
      label: 'last night',
      priority: 'sleep',
    };
  }

  // 4. Nothing.
  return {
    value: '—',
    label: 'no readings yet today',
    priority: 'none',
  };
}

// ---------------------------------------------------------------------------
// Day moments (the DaySpine source)
// ---------------------------------------------------------------------------

export type MomentVital = 'bp' | 'hr' | 'spo2' | 'sleep' | 'activity';

export interface DayMoment {
  /** Stable id for keys + tests. */
  id: string;
  /** Sort key — unix seconds for the moment's "anchor time". */
  timeSec: number;
  /** Pre-formatted clock label ("6:42a", "Last night"). */
  timeLabel: string;
  /** Serif headline for the moment. Voice-rule clean. */
  title: string;
  /** Mono sub-line ("BP 122/78 · pulse 64"). Voice-rule clean. */
  sub: string;
  /** Color rail vital — drives the spine dot color. */
  vital: MomentVital;
  /** Moments older than ~6 hours render dimmed (0.55 opacity). */
  past: boolean;
  /** True when the underlying classification is calm-concerned. */
  concerned?: boolean;
}

const PAST_THRESHOLD_SEC = 6 * 60 * 60;

/**
 * Build the day-spine moments from the composed DailyPulseData.
 *
 * Returned in chronological order (oldest → newest). Empty array when
 * no derivable moments exist; the renderer surfaces an empty-state
 * placeholder above the spine.
 */
export function deriveDayMoments(
  data: DailyPulseData,
  nowSec: number = Math.floor(Date.now() / 1000),
): DayMoment[] {
  const moments: DayMoment[] = [];

  // ----- Sleep — always the first moment of the spine if present. ---
  if (data.sleep.session) {
    const session = data.sleep.session;
    const calmNight = session.awakeCount <= 1;
    moments.push({
      id: `sleep-${session.sessionStartSec}`,
      timeSec: session.sessionStartSec,
      timeLabel: 'Last night',
      title: calmNight ? 'A quieter night' : 'Sleep began',
      sub: `${formatSleepDuration(session.totalMinutes)} · ${session.awakeCount} awakening${session.awakeCount === 1 ? '' : 's'}`,
      vital: 'sleep',
      past: true,
    });
  }

  // ----- SpO2 — only when there's an overnight low worth surfacing. ---
  if (
    data.spo2.overnightLowsRecent.length > 0 &&
    data.spo2.classification?.tier === 'calm_concerned'
  ) {
    // Most recent overnight low is the last element per slice convention
    // in state/spo2.ts (oldest → newest).
    const recentLow =
      data.spo2.overnightLowsRecent[data.spo2.overnightLowsRecent.length - 1];
    if (recentLow <= SPO2_DIP_THRESHOLD_PERCENT) {
      // Anchor on the sleep-end if available, else 4am today as a sane default
      // (most overnight dips happen in the early hours).
      const anchorSec = data.sleep.session?.sessionEndSec ?? earlyMorningSec(nowSec);
      moments.push({
        id: `spo2-dip-${anchorSec}`,
        timeSec: anchorSec,
        timeLabel: formatClockTime(anchorSec),
        title: 'A brief oxygen dip',
        sub: `SpO₂ ${recentLow}% — back up by morning`,
        vital: 'spo2',
        past: true,
        concerned: true,
      });
    }
  }

  // ----- BP — today's latest reading. ---
  if (data.bp.latest && data.bp.latestSampleSec !== null) {
    const measuredAt = data.bp.latestSampleSec;
    if (nowSec - measuredAt <= TODAY_LOOKBACK_SEC) {
      const concerned =
        data.bp.classification?.tier === 'calm_concerned' ||
        data.bp.classification?.tier === 'confirmed_urgent';
      const morning = isMorningLocal(measuredAt);
      const pulseSuffix =
        data.bp.latest.pulse !== null ? ` · pulse ${data.bp.latest.pulse}` : '';
      moments.push({
        id: `bp-${measuredAt}`,
        timeSec: measuredAt,
        timeLabel: formatClockTime(measuredAt),
        title: morning ? 'Morning reading' : 'Latest reading',
        sub: `BP ${data.bp.latest.systolic}/${data.bp.latest.diastolic}${pulseSuffix}`,
        vital: 'bp',
        past: nowSec - measuredAt > PAST_THRESHOLD_SEC,
        concerned,
      });
    }
  }

  // ----- HR — resting heart rate today. ---
  if (
    data.hr.restingToday !== null &&
    data.hr.latestSampleSec !== null &&
    data.hr.staleness !== 'stale'
  ) {
    const measuredAt = data.hr.latestSampleSec;
    moments.push({
      id: `hr-${measuredAt}`,
      timeSec: measuredAt,
      timeLabel: formatClockTime(measuredAt),
      title: 'Heart resting',
      sub: `${data.hr.restingToday} bpm`,
      vital: 'hr',
      past: nowSec - measuredAt > PAST_THRESHOLD_SEC,
    });
  }

  // ----- Activity — today's steps so far. ---
  if (data.activity.stepsToday > 0) {
    // Activity is per-day; anchor at the latest sample time so the moment
    // sorts naturally with the rest. When we don't have a sample time
    // (cold-start), anchor at "now-ish" so it sits at the bottom of
    // today's spine.
    const measuredAt = data.activity.latestSampleSec ?? nowSec;
    moments.push({
      id: `activity-${measuredAt}`,
      timeSec: measuredAt,
      timeLabel: formatClockTime(measuredAt),
      title: 'Moving so far',
      sub: `${formatSteps(data.activity.stepsToday)} steps`,
      vital: 'activity',
      past: false,
    });
  }

  // Sort oldest → newest for the spine to read top-down chronologically.
  return moments.sort((a, b) => a.timeSec - b.timeSec);
}

// ---------------------------------------------------------------------------
// Formatting helpers — exported for tests.
// ---------------------------------------------------------------------------

/** "7h 24m" formatter for sleep durations (D13 §7.2 example format). */
export function formatSleepDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

/** "6,432" with locale-aware thousand separators, falling back to default. */
export function formatSteps(n: number): string {
  return n.toLocaleString();
}

/** "6:42a" / "9:18p" — short clock time in user-local. */
export function formatClockTime(sec: number): string {
  const d = new Date(sec * 1000);
  const hours24 = d.getHours();
  const minutes = d.getMinutes();
  const isMorning = hours24 < 12;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = minutes.toString().padStart(2, '0');
  return `${hours12}:${mm}${isMorning ? 'a' : 'p'}`;
}

function isMorningLocal(sec: number): boolean {
  return new Date(sec * 1000).getHours() < NOON_HOUR_LOCAL;
}

function earlyMorningSec(nowSec: number): number {
  const d = new Date(nowSec * 1000);
  d.setHours(4, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

