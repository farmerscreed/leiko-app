// Deno tests for phi-scrub — Sprint 12.
//
// Run from supabase/functions: `deno test --allow-net=:0 _shared/`
//
// Coverage targets per the Sprint 12 card:
//   - Whitelist behaviour: anything not on ScrubbedAiContext is dropped
//   - Per-vital scrubbers: required-field validation + transforms
//   - quantiseToDay rounding
//   - correlation rounding to 2 decimals
//   - assertScrubbed catches any banned key that snuck through
//   - Synthetic full-payload roundtrip: PHI in → PHI out (via scrub +
//     assertScrubbed) — vitals intact, identifiers stripped

import { assertEquals, assertThrows, assertStrictEquals } from 'jsr:@std/assert@1';
import {
  quantiseToDay,
  scrubBp,
  scrubHr,
  scrubSpo2,
  scrubSleep,
  scrubActivity,
  scrubCorrelation,
  scrubAiContext,
  assertScrubbed,
  type ScrubbedAiContext,
} from './phi-scrub.ts';

const DAY = 24 * 60 * 60;
// Pick a Tuesday afternoon: 2026-05-05 14:33:21 UTC.
const NOW = 1_777_036_401;
const NOW_DAY = Math.floor(NOW / DAY) * DAY;

// ── quantiseToDay ──────────────────────────────────────────────────────

Deno.test('quantiseToDay floors to start-of-UTC-day', () => {
  assertEquals(quantiseToDay(NOW), NOW_DAY);
  assertEquals(quantiseToDay(NOW_DAY), NOW_DAY);
  assertEquals(quantiseToDay(NOW_DAY + 1), NOW_DAY);
  assertEquals(quantiseToDay(NOW_DAY + DAY - 1), NOW_DAY);
  assertEquals(quantiseToDay(NOW_DAY + DAY), NOW_DAY + DAY);
});

Deno.test('quantiseToDay rejects non-finite input', () => {
  assertThrows(() => quantiseToDay(Number.NaN));
  assertThrows(() => quantiseToDay(Number.POSITIVE_INFINITY));
});

// ── scrubBp ────────────────────────────────────────────────────────────

Deno.test('scrubBp keeps allowed fields and quantises measuredAt', () => {
  const out = scrubBp({
    latestSystolic: 124,
    latestDiastolic: 79,
    latestPulse: 64,
    latestMeasuredAtSec: NOW,
    weekAverageSystolic: 122.5,
    weekAverageDiastolic: 78,
    state: 'in_pattern',
    // Banned-or-unknown keys that must NOT survive whitelist:
    motionState: 'walking',
    perfusionIndex: 0.94,
    sampleWindowSec: 60,
    deviceSerial: 'urion-abc-123',
  });
  assertEquals(out.latestSystolic, 124);
  assertEquals(out.latestDiastolic, 79);
  assertEquals(out.latestPulse, 64);
  assertEquals(out.latestMeasuredAtDayUtcSec, NOW_DAY);
  assertEquals(out.weekAverageSystolic, 122.5);
  assertEquals(out.weekAverageDiastolic, 78);
  assertEquals(out.state, 'in_pattern');
  // Whitelist-by-construction means banned fields are absent on the output:
  assertStrictEquals((out as unknown as Record<string, unknown>).motionState, undefined);
  assertStrictEquals((out as unknown as Record<string, unknown>).perfusionIndex, undefined);
  assertStrictEquals((out as unknown as Record<string, unknown>).deviceSerial, undefined);
});

Deno.test('scrubBp accepts null pulse + null aggregates', () => {
  const out = scrubBp({
    latestSystolic: 130,
    latestDiastolic: 85,
    latestPulse: null,
    latestMeasuredAtSec: NOW,
    weekAverageSystolic: null,
    weekAverageDiastolic: null,
    state: 'calm_concerned',
  });
  assertEquals(out.latestPulse, null);
  assertEquals(out.weekAverageSystolic, null);
  assertEquals(out.weekAverageDiastolic, null);
  assertEquals(out.state, 'calm_concerned');
});

Deno.test('scrubBp throws when required fields missing', () => {
  assertThrows(() =>
    scrubBp({ latestDiastolic: 80, latestMeasuredAtSec: NOW, state: 'in_pattern' })
  );
  assertThrows(() => scrubBp(null));
  assertThrows(() => scrubBp(42));
});

Deno.test('scrubBp coerces unknown state to no_data', () => {
  const out = scrubBp({
    latestSystolic: 120,
    latestDiastolic: 80,
    latestPulse: 70,
    latestMeasuredAtSec: NOW,
    state: 'something-bogus',
  });
  assertEquals(out.state, 'no_data');
});

// ── scrubHr / scrubSpo2 / scrubSleep / scrubActivity ──────────────────

Deno.test('scrubHr drops banned sensor fields', () => {
  const out = scrubHr({
    restingToday: 64,
    baseline: 66,
    state: 'in_pattern',
    motionState: 'still',
    sampleWindowSec: 60,
  });
  assertEquals(out.restingToday, 64);
  assertEquals(out.baseline, 66);
  assertStrictEquals((out as unknown as Record<string, unknown>).motionState, undefined);
});

Deno.test('scrubSpo2 drops perfusionIndex', () => {
  const out = scrubSpo2({
    latest: 96,
    overnightLow: 91,
    state: 'in_pattern',
    perfusionIndex: 0.87,
  });
  assertEquals(out.latest, 96);
  assertEquals(out.overnightLow, 91);
  assertStrictEquals((out as unknown as Record<string, unknown>).perfusionIndex, undefined);
});

Deno.test('scrubSleep drops local ISO start/end leaks', () => {
  const out = scrubSleep({
    lastNightTotalMinutes: 412,
    score: 78,
    state: 'in_pattern',
    sessionStartLocal: '2026-05-04T22:14:00+01:00',
    sessionEndLocal: '2026-05-05T05:46:00+01:00',
  });
  assertEquals(out.lastNightTotalMinutes, 412);
  assertEquals(out.score, 78);
  assertStrictEquals((out as unknown as Record<string, unknown>).sessionStartLocal, undefined);
  assertStrictEquals((out as unknown as Record<string, unknown>).sessionEndLocal, undefined);
});

Deno.test('scrubActivity drops lastSampleAtSec', () => {
  const out = scrubActivity({
    todaySteps: 4112,
    targetSteps: 8000,
    state: 'in_pattern',
    lastSampleAtSec: NOW,
  });
  assertEquals(out.todaySteps, 4112);
  assertEquals(out.targetSteps, 8000);
  assertStrictEquals((out as unknown as Record<string, unknown>).lastSampleAtSec, undefined);
});

// ── scrubCorrelation ──────────────────────────────────────────────────

Deno.test('scrubCorrelation rounds coefficient to 2 decimals', () => {
  const out = scrubCorrelation({
    leftVital: 'sleep',
    rightVital: 'bp',
    coefficient: -0.41723,
    meaningful: true,
  });
  assertEquals(out.coefficient, -0.42);
  assertEquals(out.leftVital, 'sleep');
  assertEquals(out.rightVital, 'bp');
  assertEquals(out.meaningful, true);
});

Deno.test('scrubCorrelation defaults meaningful to false when not strictly true', () => {
  const out = scrubCorrelation({
    leftVital: 'activity',
    rightVital: 'hr',
    coefficient: 0.314,
    meaningful: 'yes',
  });
  assertEquals(out.meaningful, false);
});

Deno.test('scrubCorrelation rejects unknown vital names', () => {
  assertThrows(() =>
    scrubCorrelation({
      leftVital: 'temperature',
      rightVital: 'bp',
      coefficient: 0.5,
      meaningful: true,
    })
  );
});

// ── scrubAiContext ────────────────────────────────────────────────────

Deno.test('scrubAiContext requires parentLabel + accountType', () => {
  assertThrows(() =>
    scrubAiContext({ accountType: 'caregiver', yearOfBirth: 1955 })
  );
  assertThrows(() =>
    scrubAiContext({ parentLabel: 'Mum', accountType: 'wizard' })
  );
});

Deno.test('scrubAiContext drops top-level identifying fields', () => {
  const out = scrubAiContext({
    parentLabel: 'Mum',
    yearOfBirth: 1958,
    residenceCity: 'Lagos',
    accountType: 'caregiver',
    // The identifying fields the server might be tempted to forward:
    email: 'mum@example.com',
    phone: '+2348012345678',
    fullName: 'Patience Adesanya',
    lastName: 'Adesanya',
    firstName: 'Patience',
    ip: '102.45.12.9',
    userAgent: 'Mozilla/5.0',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    deviceSerial: 'urion-abc-123',
    geo: { lat: 6.5244, lng: 3.3792 },
    streetAddress: '12 Awolowo Rd',
    postalCode: '101233',
  });
  assertEquals(out.parentLabel, 'Mum');
  assertEquals(out.yearOfBirth, 1958);
  assertEquals(out.residenceCity, 'Lagos');
  assertEquals(out.accountType, 'caregiver');
  // Whitelist-by-construction: every banned field is absent.
  for (const banned of [
    'email', 'phone', 'fullName', 'lastName', 'firstName', 'ip',
    'userAgent', 'macAddress', 'deviceSerial', 'geo', 'streetAddress',
    'postalCode',
  ]) {
    assertStrictEquals(
      (out as unknown as Record<string, unknown>)[banned],
      undefined,
      `banned key "${banned}" leaked through scrub`,
    );
  }
});

Deno.test('scrubAiContext yearOfBirth + residenceCity may be null', () => {
  const out = scrubAiContext({
    parentLabel: 'You',
    yearOfBirth: null,
    residenceCity: null,
    accountType: 'self_buyer',
  });
  assertEquals(out.yearOfBirth, null);
  assertEquals(out.residenceCity, null);
});

Deno.test('scrubAiContext drops empty residenceCity to null', () => {
  const out = scrubAiContext({
    parentLabel: 'You',
    accountType: 'self_buyer',
    residenceCity: '',
  });
  assertEquals(out.residenceCity, null);
});

Deno.test('scrubAiContext composes per-vital scrubbers when present', () => {
  const out = scrubAiContext({
    parentLabel: 'Dad',
    yearOfBirth: 1952,
    residenceCity: 'Brooklyn',
    accountType: 'caregiver',
    bp: {
      latestSystolic: 132,
      latestDiastolic: 84,
      latestPulse: 72,
      latestMeasuredAtSec: NOW,
      weekAverageSystolic: 130,
      weekAverageDiastolic: 82,
      state: 'calm_concerned',
    },
    hr: { restingToday: 70, baseline: 66, state: 'in_pattern' },
    spo2: { latest: 95, overnightLow: 89, state: 'in_pattern' },
    sleep: {
      lastNightTotalMinutes: 380,
      score: 72,
      state: 'in_pattern',
    },
    activity: { todaySteps: 6200, targetSteps: 8000, state: 'in_pattern' },
    correlations: [
      {
        leftVital: 'sleep',
        rightVital: 'bp',
        coefficient: -0.4123,
        meaningful: true,
      },
    ],
  });
  assertEquals(out.bp?.latestMeasuredAtDayUtcSec, NOW_DAY);
  assertEquals(out.hr?.restingToday, 70);
  assertEquals(out.spo2?.latest, 95);
  assertEquals(out.sleep?.score, 72);
  assertEquals(out.activity?.todaySteps, 6200);
  assertEquals(out.correlations?.[0].coefficient, -0.41);
});

// ── assertScrubbed defensive guard ────────────────────────────────────

Deno.test('assertScrubbed passes for a clean scrubAiContext output', () => {
  const ctx = scrubAiContext({
    parentLabel: 'Mum',
    yearOfBirth: 1958,
    residenceCity: 'Lagos',
    accountType: 'caregiver',
    bp: {
      latestSystolic: 124,
      latestDiastolic: 79,
      latestPulse: 64,
      latestMeasuredAtSec: NOW,
      state: 'in_pattern',
    },
  });
  // Should not throw.
  assertScrubbed(ctx);
});

Deno.test('assertScrubbed throws when banned key is forced onto context', () => {
  const ctx = scrubAiContext({
    parentLabel: 'Mum',
    yearOfBirth: 1958,
    residenceCity: 'Lagos',
    accountType: 'caregiver',
  });
  // Simulate a downstream caller that mutates the supposedly-scrubbed
  // object — assertScrubbed is the gate that catches this.
  (ctx as unknown as Record<string, unknown>).email = 'mum@example.com';
  assertThrows(() => assertScrubbed(ctx as ScrubbedAiContext), Error, 'top.email');
});

Deno.test('assertScrubbed throws when banned per-vital key is forced onto bp', () => {
  const ctx = scrubAiContext({
    parentLabel: 'Mum',
    accountType: 'caregiver',
    bp: {
      latestSystolic: 124,
      latestDiastolic: 79,
      latestPulse: 64,
      latestMeasuredAtSec: NOW,
      state: 'in_pattern',
    },
  });
  (ctx.bp as unknown as Record<string, unknown>).motionState = 'walking';
  assertThrows(() => assertScrubbed(ctx), Error, 'bp.motionState');
});
