// Deno tests for vital-validators — Sprint 7.5.
//
// Run from supabase/functions: `deno test --allow-net=:0 _shared/`
// (the --allow-net flag is unused here but matches the supabase CLI's
// default function-test invocation, so the same command works for the
// rest of the suite as we add it.)

import { assertEquals } from 'jsr:@std/assert@1';
import {
  validateBPReadings,
  validateHRSamples,
  validateSpO2Samples,
  validateSleepSessions,
  validateActivityDays,
  validateCaloriesDays,
} from './vital-validators.ts';
import type {
  BPReading,
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
  CaloriesDay,
} from './vital-types.ts';

const NOW = 1_715_000_000;

// BP ────────────────────────────────────────────────────────────────

Deno.test('validateBPReadings accepts in-range and rejects out-of-range', () => {
  const input: BPReading[] = [
    { measuredAtSec: NOW, systolic: 120, diastolic: 80, pulse: 70, source: 'watch' },
    { measuredAtSec: NOW, systolic: 25, diastolic: 80, pulse: 70, source: 'watch' },
    { measuredAtSec: NOW, systolic: 120, diastolic: 15, pulse: 70, source: 'watch' },
    { measuredAtSec: NOW, systolic: 120, diastolic: 80, pulse: 250, source: 'watch' },
    { measuredAtSec: 0, systolic: 120, diastolic: 80, pulse: 70, source: 'watch' },
  ];
  const { accepted, rejected } = validateBPReadings(input);
  assertEquals(accepted.length, 1);
  assertEquals(rejected.map((r) => r.reason), [
    'systolic_out_of_range',
    'diastolic_out_of_range',
    'pulse_out_of_range',
    'missing_measured_at',
  ]);
});

Deno.test('validateBPReadings allows null pulse', () => {
  const input: BPReading[] = [
    { measuredAtSec: NOW, systolic: 120, diastolic: 80, pulse: null, source: 'watch' },
  ];
  const { accepted, rejected } = validateBPReadings(input);
  assertEquals(accepted.length, 1);
  assertEquals(rejected.length, 0);
});

// HR ────────────────────────────────────────────────────────────────

Deno.test('validateHRSamples rejects bpm out of [30,220]', () => {
  const input: HRSample[] = [
    { measuredAtSec: NOW, bpm: 70, sampleWindowSec: 30, motionState: 'rest', isSpotCheck: false },
    { measuredAtSec: NOW, bpm: 25, sampleWindowSec: 30, motionState: 'rest', isSpotCheck: false },
    { measuredAtSec: NOW, bpm: 240, sampleWindowSec: 30, motionState: 'rest', isSpotCheck: false },
  ];
  const { accepted, rejected } = validateHRSamples(input);
  assertEquals(accepted.length, 1);
  assertEquals(rejected.length, 2);
  assertEquals(rejected[0].reason, 'bpm_out_of_range');
});

// SpO2 ──────────────────────────────────────────────────────────────

Deno.test('validateSpO2Samples rejects percent out of [70,100]', () => {
  const input: SpO2Sample[] = [
    {
      measuredAtSec: NOW,
      percent: 96,
      maxInWindow: 97,
      minInWindow: 95,
      sampleWindowSec: 30,
      isSpotCheck: false,
      perfusionIndex: 0.6,
    },
    {
      measuredAtSec: NOW,
      percent: 65,
      maxInWindow: 70,
      minInWindow: 60,
      sampleWindowSec: 30,
      isSpotCheck: false,
      perfusionIndex: 0.4,
    },
    {
      measuredAtSec: NOW,
      percent: 105,
      maxInWindow: 105,
      minInWindow: 100,
      sampleWindowSec: 30,
      isSpotCheck: true,
      perfusionIndex: null,
    },
  ];
  const { accepted, rejected } = validateSpO2Samples(input);
  assertEquals(accepted.length, 1);
  assertEquals(rejected.length, 2);
  assertEquals(rejected[0].reason, 'percent_out_of_range');
});

// Sleep ─────────────────────────────────────────────────────────────

Deno.test('validateSleepSessions rejects too-short and impossibly-long', () => {
  const start = NOW - 8 * 3600;
  const end = NOW;
  const make = (totalMinutes: number, overrides: Partial<SleepSession> = {}): SleepSession => ({
    sessionStartSec: start,
    sessionEndSec: end,
    sessionStartLocal: new Date(start * 1000).toISOString(),
    sessionEndLocal: new Date(end * 1000).toISOString(),
    totalMinutes,
    deepMinutes: 0,
    remMinutes: 0,
    lightMinutes: totalMinutes,
    awakeMinutes: 0,
    awakeCount: 0,
    transitions: [],
    sleepScore: 0,
    ...overrides,
  });
  const input: SleepSession[] = [
    make(420),
    make(15),
    make(20 * 60),
    make(420, { sessionEndSec: start - 1 }),
  ];
  const { accepted, rejected } = validateSleepSessions(input);
  assertEquals(accepted.length, 1);
  assertEquals(rejected.map((r) => r.reason), [
    'total_minutes_out_of_range',
    'total_minutes_out_of_range',
    'invalid_session_end',
  ]);
});

// Activity ──────────────────────────────────────────────────────────

Deno.test('validateActivityDays rejects negative and over 100k', () => {
  const make = (totalSteps: number): ActivityDay => ({
    dayLocal: '2026-05-07',
    measuredAtSec: NOW,
    totalSteps,
    targetSteps: 6000,
    lastSampleAtSec: NOW,
    hourly: Array(24).fill(0),
  });
  const input = [make(7200), make(-1), make(150_000)];
  const { accepted, rejected } = validateActivityDays(input);
  assertEquals(accepted.length, 1);
  assertEquals(rejected.length, 2);
  assertEquals(rejected[0].reason, 'steps_out_of_range');
});

// Calories ──────────────────────────────────────────────────────────

Deno.test('validateCaloriesDays rejects negative and over 10k', () => {
  const make = (totalKcal: number): CaloriesDay => ({
    dayLocal: '2026-05-07',
    measuredAtSec: NOW,
    totalKcal,
    activityKcal: Math.max(0, totalKcal - 1500),
    bmrKcal: 1500,
    targetKcal: null,
  });
  const input = [make(2200), make(-50), make(15_000)];
  const { accepted, rejected } = validateCaloriesDays(input);
  assertEquals(accepted.length, 1);
  assertEquals(rejected.length, 2);
  assertEquals(rejected[0].reason, 'kcal_out_of_range');
});
