// Deno tests for novel-pattern detector — Sprint 12.5.

import { assertEquals } from 'jsr:@std/assert@1';
import {
  detectNovelPattern,
  isBpAnomalousVsWeekAverage,
} from './novel-pattern.ts';
import { scrubAiContext } from './phi-scrub.ts';

const NOW = 1_777_036_401;

function ctx(overrides: Record<string, unknown> = {}) {
  return scrubAiContext({
    parentLabel: 'Mum',
    accountType: 'caregiver',
    bp: {
      latestSystolic: 124,
      latestDiastolic: 79,
      latestPulse: 64,
      latestMeasuredAtSec: NOW,
      weekAverageSystolic: 122,
      weekAverageDiastolic: 78,
      state: 'in_pattern',
      ...((overrides.bp as Record<string, unknown>) ?? {}),
    },
    hr: { restingToday: 64, baseline: 66, state: 'in_pattern', ...((overrides.hr as Record<string, unknown>) ?? {}) },
    spo2: { latest: 96, overnightLow: 91, state: 'in_pattern', ...((overrides.spo2 as Record<string, unknown>) ?? {}) },
    sleep: { lastNightTotalMinutes: 412, score: 78, state: 'in_pattern', ...((overrides.sleep as Record<string, unknown>) ?? {}) },
    activity: { todaySteps: 4112, targetSteps: 8000, state: 'in_pattern', ...((overrides.activity as Record<string, unknown>) ?? {}) },
  });
}

// ── No novel signals → NOT novel ──────────────────────────────────────

Deno.test('all in_pattern + no extra signals → NOT novel (routes Tier-A)', () => {
  const r = detectNovelPattern({
    context: ctx(),
    newCorrelationCount: 0,
    daysSinceLastReading: 0,
    isLatestReadingAnomalous: false,
  });
  assertEquals(r.isNovel, false);
  assertEquals(r.reasons, []);
});

// ── Each condition individually fires ─────────────────────────────────

Deno.test('multi-vital calm_concerned (2+) → novel', () => {
  const r = detectNovelPattern({
    context: ctx({
      bp: { state: 'calm_concerned' },
      sleep: { state: 'calm_concerned' },
    }),
    newCorrelationCount: 0,
    daysSinceLastReading: 0,
    isLatestReadingAnomalous: false,
  });
  assertEquals(r.isNovel, true);
  assertEquals(r.reasons, ['multi_vital_calm_concerned']);
});

Deno.test('exactly 1 vital calm_concerned → NOT novel by that path alone', () => {
  const r = detectNovelPattern({
    context: ctx({ bp: { state: 'calm_concerned' } }),
    newCorrelationCount: 0,
    daysSinceLastReading: 0,
    isLatestReadingAnomalous: false,
  });
  assertEquals(r.isNovel, false);
});

Deno.test('newCorrelationCount > 0 → novel', () => {
  const r = detectNovelPattern({
    context: ctx(),
    newCorrelationCount: 1,
    daysSinceLastReading: 0,
    isLatestReadingAnomalous: false,
  });
  assertEquals(r.isNovel, true);
  assertEquals(r.reasons, ['new_correlation']);
});

Deno.test('daysSinceLastReading >= 7 → novel', () => {
  const r = detectNovelPattern({
    context: ctx(),
    newCorrelationCount: 0,
    daysSinceLastReading: 7,
    isLatestReadingAnomalous: false,
  });
  assertEquals(r.isNovel, true);
  assertEquals(r.reasons, ['returning_user_7d']);
});

Deno.test('daysSinceLastReading 6 → still NOT novel', () => {
  const r = detectNovelPattern({
    context: ctx(),
    newCorrelationCount: 0,
    daysSinceLastReading: 6,
    isLatestReadingAnomalous: false,
  });
  assertEquals(r.isNovel, false);
});

Deno.test('isLatestReadingAnomalous → novel', () => {
  const r = detectNovelPattern({
    context: ctx(),
    newCorrelationCount: 0,
    daysSinceLastReading: 0,
    isLatestReadingAnomalous: true,
  });
  assertEquals(r.isNovel, true);
  assertEquals(r.reasons, ['baseline_anomaly']);
});

// ── Multiple conditions fire — all reasons captured ───────────────────

Deno.test('multiple conditions → all reasons surfaced for telemetry', () => {
  const r = detectNovelPattern({
    context: ctx({
      bp: { state: 'calm_concerned' },
      sleep: { state: 'calm_concerned' },
    }),
    newCorrelationCount: 1,
    daysSinceLastReading: 8,
    isLatestReadingAnomalous: true,
  });
  assertEquals(r.isNovel, true);
  assertEquals(r.reasons.length, 4);
});

// ── BP-anomaly helper ─────────────────────────────────────────────────

Deno.test('isBpAnomalousVsWeekAverage: latest within 10% → false', () => {
  const c = ctx({
    bp: { latestSystolic: 125, weekAverageSystolic: 122, latestDiastolic: 80, weekAverageDiastolic: 78 },
  });
  assertEquals(isBpAnomalousVsWeekAverage(c), false);
});

Deno.test('isBpAnomalousVsWeekAverage: systolic >10% off → true', () => {
  const c = ctx({
    bp: { latestSystolic: 145, weekAverageSystolic: 122, latestDiastolic: 80, weekAverageDiastolic: 78 },
  });
  assertEquals(isBpAnomalousVsWeekAverage(c), true);
});

Deno.test('isBpAnomalousVsWeekAverage: diastolic >10% off → true', () => {
  const c = ctx({
    bp: { latestSystolic: 124, weekAverageSystolic: 122, latestDiastolic: 95, weekAverageDiastolic: 78 },
  });
  assertEquals(isBpAnomalousVsWeekAverage(c), true);
});

Deno.test('isBpAnomalousVsWeekAverage: missing weekAverage → false (no baseline yet)', () => {
  const c = ctx({
    bp: {
      latestSystolic: 200,
      weekAverageSystolic: null,
      latestDiastolic: 80,
      weekAverageDiastolic: null,
    },
  });
  assertEquals(isBpAnomalousVsWeekAverage(c), false);
});

Deno.test('isBpAnomalousVsWeekAverage: missing bp entirely → false', () => {
  const c = scrubAiContext({ parentLabel: 'Mum', accountType: 'caregiver' });
  assertEquals(isBpAnomalousVsWeekAverage(c), false);
});

Deno.test('isBpAnomalousVsWeekAverage: custom threshold', () => {
  const c = ctx({
    bp: { latestSystolic: 130, weekAverageSystolic: 122, latestDiastolic: 80, weekAverageDiastolic: 78 },
  });
  // Default 10% threshold: 8/122 ≈ 6.5%, not anomalous.
  assertEquals(isBpAnomalousVsWeekAverage(c), false);
  // Custom 5% threshold: now anomalous.
  assertEquals(isBpAnomalousVsWeekAverage(c, 0.05), true);
});
