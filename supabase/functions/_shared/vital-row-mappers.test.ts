// Mapper unit tests — Sprint 7.5.

import { assertEquals } from 'jsr:@std/assert@1';
import {
  mapHRSamples,
  mapSpO2Samples,
  mapSleepSessions,
  mapActivityDays,
  mapCaloriesDays,
  mapBPReadings,
} from './vital-row-mappers.ts';

const FAMILY = '11111111-1111-1111-1111-111111111111';
const DEVICE = '22222222-2222-2222-2222-222222222222';
const NOW = 1_715_000_000;
const NOW_ISO = new Date(NOW * 1000).toISOString();

Deno.test('mapHRSamples produces vital_type=hr rows with bpm in value_int', () => {
  const rows = mapHRSamples(
    [{ measuredAtSec: NOW, bpm: 68, sampleWindowSec: 30, motionState: 'rest', isSpotCheck: false }],
    FAMILY,
    DEVICE,
  );
  assertEquals(rows.length, 1);
  assertEquals(rows[0].vital_type, 'hr');
  assertEquals(rows[0].value_int, 68);
  assertEquals(rows[0].measured_at, NOW_ISO);
  assertEquals(rows[0].value_jsonb.motion_state, 'rest');
});

Deno.test('mapSpO2Samples carries min/max into int_2/int_3', () => {
  const rows = mapSpO2Samples(
    [
      {
        measuredAtSec: NOW,
        percent: 96,
        maxInWindow: 98,
        minInWindow: 94,
        sampleWindowSec: 30,
        isSpotCheck: false,
        perfusionIndex: 0.6,
      },
    ],
    FAMILY,
    DEVICE,
  );
  assertEquals(rows[0].vital_type, 'spo2');
  assertEquals(rows[0].value_int, 96);
  assertEquals(rows[0].value_int_2, 98);
  assertEquals(rows[0].value_int_3, 94);
  assertEquals((rows[0].value_jsonb as { perfusion_index: number }).perfusion_index, 0.6);
});

Deno.test('mapSleepSessions uses sessionEnd as measured_at (constant night key)', () => {
  const start = NOW - 8 * 3600;
  const rows = mapSleepSessions(
    [
      {
        sessionStartSec: start,
        sessionEndSec: NOW,
        sessionStartLocal: new Date(start * 1000).toISOString(),
        sessionEndLocal: NOW_ISO,
        totalMinutes: 444,
        deepMinutes: 100,
        remMinutes: 90,
        lightMinutes: 240,
        awakeMinutes: 14,
        awakeCount: 2,
        transitions: [],
        sleepScore: 78,
      },
    ],
    FAMILY,
    DEVICE,
  );
  assertEquals(rows[0].vital_type, 'sleep_session');
  // Now the session END — re-reads of a night (whose synthesized start
  // drifts with total) share this constant key and reconcile one row.
  assertEquals(rows[0].measured_at, NOW_ISO);
  assertEquals(rows[0].value_int, 444);
  assertEquals(rows[0].value_int_2, 100);
  assertEquals(rows[0].value_int_3, 90);
  // The real start epoch is preserved in the jsonb for the read side.
  assertEquals(
    (rows[0].value_jsonb as { session_start_local?: string }).session_start_local,
    new Date(start * 1000).toISOString(),
  );
});

Deno.test('mapActivityDays carries day_local and hourly array', () => {
  const rows = mapActivityDays(
    [
      {
        dayLocal: '2026-05-07',
        measuredAtSec: NOW,
        totalSteps: 7200,
        targetSteps: 6000,
        lastSampleAtSec: NOW,
        hourly: Array(24).fill(300),
      },
    ],
    FAMILY,
    DEVICE,
  );
  assertEquals(rows[0].vital_type, 'steps_day');
  assertEquals(rows[0].value_int, 7200);
  assertEquals((rows[0].value_jsonb as { day_local: string }).day_local, '2026-05-07');
});

Deno.test('mapCaloriesDays carries activity + bmr split', () => {
  const rows = mapCaloriesDays(
    [
      {
        dayLocal: '2026-05-07',
        measuredAtSec: NOW,
        totalKcal: 1800,
        activityKcal: 320,
        bmrKcal: 1480,
        targetKcal: null,
      },
    ],
    FAMILY,
    DEVICE,
  );
  assertEquals(rows[0].vital_type, 'calories_day');
  assertEquals(rows[0].value_int, 1800);
  assertEquals((rows[0].value_jsonb as { activity_kcal: number }).activity_kcal, 320);
});

Deno.test('mapBPReadings keeps Sprint-6 shape (sys/dia/pulse + measured_at_local)', () => {
  const rows = mapBPReadings(
    [{ measuredAtSec: NOW, systolic: 124, diastolic: 79, pulse: 72, source: 'watch' }],
    FAMILY,
    DEVICE,
  );
  assertEquals(rows[0].systolic, 124);
  assertEquals(rows[0].diastolic, 79);
  assertEquals(rows[0].pulse, 72);
  assertEquals(rows[0].source, 'watch');
  assertEquals(rows[0].measured_at, NOW_ISO);
  assertEquals(rows[0].measured_at_local, NOW_ISO);
});
