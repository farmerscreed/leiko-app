// Vital baselines unit tests — Sprint 16.5f.
//
// Pure-helper tests; live in src/utils/__tests__ so they're picked up
// by the "pure" jest project.

import {
  bpBaseline,
  hrBaseline,
  spo2Baseline,
  activityBaseline,
  formatBPBaseline,
  formatHRBaseline,
  formatSpO2Baseline,
  formatActivityBaseline,
} from '../vitalBaselines';
import type { ActivityDay } from '../../types/vitals';
import type { LocalReading } from '../../state/readings';

const NOW_MS = Date.UTC(2026, 4, 14, 12, 0, 0); // 2026-05-14 noon UTC
const DAY = 24 * 3600_000;

function makeBP(sys: number, dia: number, daysAgo: number): LocalReading {
  return {
    localId: `bp-${daysAgo}`,
    serverId: null,
    measuredAtSec: Math.floor((NOW_MS - daysAgo * DAY) / 1000),
    systolic: sys,
    diastolic: dia,
    pulse: 70,
    source: 'watch',
    deviceBleId: null,
    classification: {
      tier: 'in_pattern',
      reason: 'within_baseline',
    },
    capturedAtMs: NOW_MS - daysAgo * DAY,
  };
}

function makeActivity(steps: number, daysAgo: number): ActivityDay {
  return {
    dayLocal: new Date(NOW_MS - daysAgo * DAY).toISOString().slice(0, 10),
    measuredAtSec: Math.floor((NOW_MS - daysAgo * DAY) / 1000),
    totalSteps: steps,
    targetSteps: 8000,
    lastSampleAtSec: Math.floor((NOW_MS - daysAgo * DAY) / 1000),
    hourly: new Array(24).fill(0),
  };
}

describe('vitalBaselines — bpBaseline', () => {
  test('returns null when fewer than 5 readings', () => {
    const readings = [makeBP(120, 80, 1), makeBP(125, 82, 2)];
    expect(bpBaseline(readings, NOW_MS)).toBeNull();
  });

  test('returns p10/p90 sys + dia band over the window', () => {
    const readings = [
      makeBP(110, 70, 1),
      makeBP(115, 72, 2),
      makeBP(120, 75, 3),
      makeBP(125, 78, 4),
      makeBP(130, 80, 5),
      makeBP(135, 82, 6),
      makeBP(140, 85, 7),
      makeBP(145, 88, 8),
      makeBP(150, 90, 9),
      makeBP(155, 92, 10),
    ];
    const band = bpBaseline(readings, NOW_MS);
    expect(band).not.toBeNull();
    expect(band!.sampleCount).toBe(10);
    // p10 of [110..155] = 110, p90 = 150 (index 9 → 155 with our naive percentile)
    expect(band!.sysLow).toBeLessThanOrEqual(band!.sysHigh);
    expect(band!.diaLow).toBeLessThanOrEqual(band!.diaHigh);
  });

  test('excludes readings outside the window', () => {
    const inside = Array.from({ length: 5 }, (_, i) => makeBP(120, 80, i + 1));
    const outside = makeBP(200, 120, 60); // 60 days ago — outside 30d window
    const band = bpBaseline([...inside, outside], NOW_MS);
    expect(band!.sysHigh).toBeLessThan(200);
  });
});

describe('vitalBaselines — hrBaseline', () => {
  test('returns null below MIN_HR_DAYS', () => {
    expect(hrBaseline([65, 68])).toBeNull();
  });

  test('computes p10/p90 band', () => {
    const band = hrBaseline([55, 60, 65, 70, 75, 80, 85]);
    expect(band).not.toBeNull();
    expect(band!.bpmLow).toBeLessThanOrEqual(band!.bpmHigh);
    expect(band!.sampleCount).toBe(7);
  });
});

describe('vitalBaselines — spo2Baseline', () => {
  test('returns null below MIN_SPO2_NIGHTS', () => {
    expect(spo2Baseline([95, 96])).toBeNull();
  });

  test('computes p10/p90 band', () => {
    const band = spo2Baseline([92, 93, 94, 95, 96, 97, 98]);
    expect(band).not.toBeNull();
    expect(band!.percentLow).toBeLessThanOrEqual(band!.percentHigh);
  });
});

describe('vitalBaselines — activityBaseline', () => {
  test('returns null below MIN_ACTIVITY_DAYS', () => {
    const days = [makeActivity(7000, 1), makeActivity(8000, 2)];
    expect(activityBaseline(days, NOW_MS)).toBeNull();
  });

  test('returns median over non-zero days in window', () => {
    const days = [
      makeActivity(5000, 1),
      makeActivity(7000, 2),
      makeActivity(8000, 3),
      makeActivity(9000, 4),
      makeActivity(11000, 5),
      makeActivity(0, 6), // zero day excluded
    ];
    const baseline = activityBaseline(days, NOW_MS);
    expect(baseline).not.toBeNull();
    expect(baseline!.sampleCount).toBe(5);
    // Median of [5000, 7000, 8000, 9000, 11000] = 8000 (index 2 of 5)
    expect(baseline!.median).toBe(8000);
  });

  test('excludes days outside the window', () => {
    const days = [
      makeActivity(5000, 1),
      makeActivity(7000, 2),
      makeActivity(8000, 3),
      makeActivity(9000, 4),
      makeActivity(11000, 5),
      makeActivity(99999, 60), // outside 30d window
    ];
    const baseline = activityBaseline(days, NOW_MS);
    expect(baseline!.median).toBeLessThan(99999);
  });
});

describe('vitalBaselines — formatters', () => {
  test('formatBPBaseline returns SYS–SYS / DIA–DIA', () => {
    expect(
      formatBPBaseline({
        sysLow: 115, sysHigh: 128, diaLow: 72, diaHigh: 82, sampleCount: 30,
      }),
    ).toBe('115–128 / 72–82');
  });

  test('formatHRBaseline returns bpm range', () => {
    expect(
      formatHRBaseline({ bpmLow: 62, bpmHigh: 78, sampleCount: 14 }),
    ).toBe('62–78 bpm');
  });

  test('formatSpO2Baseline returns percent range', () => {
    expect(
      formatSpO2Baseline({ percentLow: 94, percentHigh: 98, sampleCount: 14 }),
    ).toBe('94–98%');
  });

  test('formatActivityBaseline returns median with commas', () => {
    expect(
      formatActivityBaseline({ median: 8400, sampleCount: 30 }),
    ).toBe('~8,400 steps');
  });
});
