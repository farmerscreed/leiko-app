// utils/vitalBaselines — Sprint 16.5f.
//
// Computes the "your usual" reference band for each vital from local
// history. Surfaced under each detail-screen hero so the calm phrase
// "within your range" finally has a visible range. Returns null when
// sample size is too small to justify a claim — never invent a band
// from < 5 days of data.
//
// Pure helpers — no React, no I/O, no logger.
//
// Voice rules (docs/05-voice-and-claims.md): caller surfaces these as
// "Your usual" / "Your typical" — never "normal range" or "healthy
// range" (those imply clinical thresholds). All forbidden words avoided.

import type {
  HRSample,
  SpO2Sample,
  ActivityDay,
} from '../types/vitals';
import type { LocalReading } from '../state/readings';

const MIN_BP_READINGS = 5;
const MIN_HR_DAYS = 5;
const MIN_SPO2_NIGHTS = 5;
const MIN_ACTIVITY_DAYS = 5;
const BASELINE_WINDOW_DAYS = 30;

export interface BPBaseline {
  sysLow: number;
  sysHigh: number;
  diaLow: number;
  diaHigh: number;
  sampleCount: number;
}

export interface HRBaseline {
  bpmLow: number;
  bpmHigh: number;
  sampleCount: number;
}

export interface SpO2Baseline {
  percentLow: number;
  percentHigh: number;
  sampleCount: number;
}

export interface ActivityBaseline {
  /** Median daily step count over the window. */
  median: number;
  /** Days the baseline was computed over. */
  sampleCount: number;
}

/** Robust percentile — sorts then indexes; safe for small arrays. */
function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * pct));
  return sorted[idx];
}

/** p10 → p90 band of systolic + diastolic from the last 30 days of
 *  readings. Returns null when the user has < MIN_BP_READINGS in the
 *  window (avoids claiming a baseline we can't defend). */
export function bpBaseline(
  readings: ReadonlyArray<LocalReading>,
  nowMs: number = Date.now(),
  windowDays: number = BASELINE_WINDOW_DAYS,
): BPBaseline | null {
  const cutoff = nowMs - windowDays * 24 * 3_600_000;
  const window = readings.filter((r) => r.measuredAtSec * 1000 >= cutoff);
  if (window.length < MIN_BP_READINGS) return null;
  const sys = window.map((r) => r.systolic).slice().sort((a, b) => a - b);
  const dia = window.map((r) => r.diastolic).slice().sort((a, b) => a - b);
  return {
    sysLow: percentile(sys, 0.1),
    sysHigh: percentile(sys, 0.9),
    diaLow: percentile(dia, 0.1),
    diaHigh: percentile(dia, 0.9),
    sampleCount: window.length,
  };
}

/** Resting BPM band from the last 30 days of nightly resting samples.
 *  Returns null when < MIN_HR_DAYS of nights with data. */
export function hrBaseline(
  restingRecentBpm: ReadonlyArray<number>,
): HRBaseline | null {
  if (restingRecentBpm.length < MIN_HR_DAYS) return null;
  const sorted = restingRecentBpm.slice().sort((a, b) => a - b);
  return {
    bpmLow: percentile(sorted, 0.1),
    bpmHigh: percentile(sorted, 0.9),
    sampleCount: sorted.length,
  };
}

/** Overnight SpO2 band from the last 30 nights of overnight lows.
 *  Returns null when < MIN_SPO2_NIGHTS of nights with data. */
export function spo2Baseline(
  overnightLows: ReadonlyArray<number>,
): SpO2Baseline | null {
  if (overnightLows.length < MIN_SPO2_NIGHTS) return null;
  const sorted = overnightLows.slice().sort((a, b) => a - b);
  return {
    percentLow: percentile(sorted, 0.1),
    percentHigh: percentile(sorted, 0.9),
    sampleCount: sorted.length,
  };
}

/** Median daily step count from the last 30 days of activity. Returns
 *  null when < MIN_ACTIVITY_DAYS of days with non-zero data. */
export function activityBaseline(
  recentDays: ReadonlyArray<ActivityDay>,
  nowMs: number = Date.now(),
  windowDays: number = BASELINE_WINDOW_DAYS,
): ActivityBaseline | null {
  const cutoff = nowMs - windowDays * 24 * 3_600_000;
  const window = recentDays.filter(
    (d) => d.measuredAtSec * 1000 >= cutoff && d.totalSteps > 0,
  );
  if (window.length < MIN_ACTIVITY_DAYS) return null;
  const sorted = window.map((d) => d.totalSteps).sort((a, b) => a - b);
  return {
    median: percentile(sorted, 0.5),
    sampleCount: window.length,
  };
}

/** "115–128 / 72–82" formatted BP band. Pure formatter for the hero
 *  baseline line. */
export function formatBPBaseline(b: BPBaseline): string {
  return `${b.sysLow}–${b.sysHigh} / ${b.diaLow}–${b.diaHigh}`;
}

/** "62–78 bpm" — pure formatter. */
export function formatHRBaseline(b: HRBaseline): string {
  return `${b.bpmLow}–${b.bpmHigh} bpm`;
}

/** "94–98%" — pure formatter. */
export function formatSpO2Baseline(b: SpO2Baseline): string {
  return `${b.percentLow}–${b.percentHigh}%`;
}

/** "~8,400 steps" — pure formatter. */
export function formatActivityBaseline(b: ActivityBaseline): string {
  return `~${b.median.toLocaleString()} steps`;
}

// Re-export for callers that want the type-only imports.
export type { HRSample, SpO2Sample, ActivityDay };
