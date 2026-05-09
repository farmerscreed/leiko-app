// trends-aggregate — pure aggregator unit tests. Sprint 9.

import {
  aggregateTrends,
  rangeStartIso,
  TRENDS_RANGE_DAYS,
  type TrendsData,
} from '../trends-aggregate';
import type { ReadingRow, VitalsOtherRow } from '../../types/database';

function reading(input: Partial<ReadingRow> & { measured_at: string; systolic: number; diastolic: number }): ReadingRow {
  return {
    id: input.id ?? 'r-' + input.measured_at,
    family_id: input.family_id ?? 'family-1',
    device_id: input.device_id ?? null,
    source: input.source ?? 'watch',
    measured_at: input.measured_at,
    measured_at_local: input.measured_at_local ?? null,
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse ?? null,
    quality_score: input.quality_score ?? 'good',
    quality_flags: input.quality_flags ?? {},
    motion_detected: input.motion_detected ?? null,
    hidden: input.hidden ?? false,
    hidden_reason: input.hidden_reason ?? null,
    hidden_by_user_id: input.hidden_by_user_id ?? null,
    hidden_at: input.hidden_at ?? null,
    created_at: input.created_at ?? input.measured_at,
  };
}

function vital(input: Partial<VitalsOtherRow> & {
  vital_type: VitalsOtherRow['vital_type'];
  measured_at: string;
}): VitalsOtherRow {
  return {
    id: input.id ?? 'v-' + input.vital_type + '-' + input.measured_at,
    family_id: input.family_id ?? 'family-1',
    device_id: input.device_id ?? null,
    vital_type: input.vital_type,
    measured_at: input.measured_at,
    value_int: input.value_int ?? null,
    value_int_2: input.value_int_2 ?? null,
    value_int_3: input.value_int_3 ?? null,
    value_jsonb: input.value_jsonb ?? null,
    hidden: input.hidden ?? false,
    hidden_reason: input.hidden_reason ?? null,
    created_at: input.created_at ?? input.measured_at,
  };
}

describe('aggregateTrends — BP', () => {
  it('buckets by day and averages systolic / diastolic / pulse', () => {
    const out = aggregateTrends({
      readings: [
        reading({ measured_at: '2025-01-21T07:00:00Z', systolic: 120, diastolic: 80, pulse: 70 }),
        reading({ measured_at: '2025-01-21T15:00:00Z', systolic: 130, diastolic: 84, pulse: 72 }),
        reading({ measured_at: '2025-01-22T08:00:00Z', systolic: 118, diastolic: 78, pulse: 68 }),
      ],
      vitalsOther: [],
    });
    expect(out.series.bp).toEqual([
      { day: '2025-01-21', sys: 125, dia: 82, pulse: 71, count: 2 },
      { day: '2025-01-22', sys: 118, dia: 78, pulse: 68, count: 1 },
    ]);
    expect(out.summary.bp.count).toBe(3);
    expect(out.summary.bp.avgSys).toBeCloseTo((120 + 130 + 118) / 3, 5);
    expect(out.summary.bp.avgDia).toBeCloseTo((80 + 84 + 78) / 3, 5);
  });

  it('drops hidden rows from both series and summary', () => {
    const out = aggregateTrends({
      readings: [
        reading({ measured_at: '2025-01-21T07:00:00Z', systolic: 120, diastolic: 80 }),
        reading({ measured_at: '2025-01-22T07:00:00Z', systolic: 200, diastolic: 110, hidden: true }),
      ],
      vitalsOther: [],
    });
    expect(out.series.bp).toHaveLength(1);
    expect(out.summary.bp.count).toBe(1);
  });

  it('computes pctInRange across daily means', () => {
    const out = aggregateTrends({
      readings: [
        // Day A: in range (mean 122/80)
        reading({ measured_at: '2025-01-21T07:00:00Z', systolic: 122, diastolic: 80 }),
        // Day B: out of range (mean 145/95)
        reading({ measured_at: '2025-01-22T07:00:00Z', systolic: 145, diastolic: 95 }),
        // Day C: in range (mean 118/78)
        reading({ measured_at: '2025-01-23T07:00:00Z', systolic: 118, diastolic: 78 }),
      ],
      vitalsOther: [],
    });
    expect(out.summary.bp.pctInRange).toBeCloseTo(2 / 3, 5);
  });

  it('returns null pctInRange when there are no readings', () => {
    const out = aggregateTrends({ readings: [], vitalsOther: [] });
    expect(out.summary.bp.pctInRange).toBeNull();
    expect(out.summary.bp.avgSys).toBeNull();
  });
});

describe('aggregateTrends — HR', () => {
  it('uses overnight samples (22:00–06:00 UTC) for the resting median when available', () => {
    const out = aggregateTrends({
      readings: [],
      vitalsOther: [
        // Overnight: 02:00 UTC. value=58 → resting candidate
        vital({ vital_type: 'hr', measured_at: '2025-01-21T02:00:00Z', value_int: 58 }),
        // Overnight: 04:00 UTC. value=60
        vital({ vital_type: 'hr', measured_at: '2025-01-21T04:00:00Z', value_int: 60 }),
        // Daytime: high value 110 — should NOT push the resting up
        vital({ vital_type: 'hr', measured_at: '2025-01-21T14:00:00Z', value_int: 110 }),
      ],
    });
    expect(out.series.hr[0].day).toBe('2025-01-21');
    expect(out.series.hr[0].restingBpm).toBe(59); // median of 58, 60
    expect(out.series.hr[0].count).toBe(3);
  });

  it('falls back to all-day median when there are no overnight samples', () => {
    const out = aggregateTrends({
      readings: [],
      vitalsOther: [
        vital({ vital_type: 'hr', measured_at: '2025-01-21T10:00:00Z', value_int: 70 }),
        vital({ vital_type: 'hr', measured_at: '2025-01-21T12:00:00Z', value_int: 76 }),
      ],
    });
    expect(out.series.hr[0].restingBpm).toBe(73);
  });
});

describe('aggregateTrends — SpO2', () => {
  it('captures daily avgPercent (mean of value_int) and minPercent (min of value_int_3)', () => {
    const out = aggregateTrends({
      readings: [],
      vitalsOther: [
        vital({
          vital_type: 'spo2',
          measured_at: '2025-01-21T07:00:00Z',
          value_int: 96,
          value_int_3: 94,
        }),
        vital({
          vital_type: 'spo2',
          measured_at: '2025-01-21T15:00:00Z',
          value_int: 98,
          value_int_3: 95,
        }),
      ],
    });
    expect(out.series.spo2[0].avgPercent).toBe(97);
    expect(out.series.spo2[0].minPercent).toBe(94);
  });
});

describe('aggregateTrends — sleep', () => {
  it('keeps one session per day (totalMinutes + deepMinutes)', () => {
    const out = aggregateTrends({
      readings: [],
      vitalsOther: [
        vital({
          vital_type: 'sleep_session',
          measured_at: '2025-01-21T06:00:00Z',
          value_int: 420,
          value_int_2: 100,
        }),
      ],
    });
    expect(out.series.sleep).toEqual([
      { day: '2025-01-21', totalMinutes: 420, deepMinutes: 100 },
    ]);
    expect(out.summary.sleep.avgTotalMinutes).toBe(420);
  });
});

describe('aggregateTrends — activity', () => {
  it('tracks end-of-day step total per day', () => {
    const out = aggregateTrends({
      readings: [],
      vitalsOther: [
        vital({
          vital_type: 'steps_day',
          measured_at: '2025-01-21T00:00:00Z',
          value_int: 7200,
        }),
        vital({
          vital_type: 'steps_day',
          measured_at: '2025-01-22T00:00:00Z',
          value_int: 9100,
        }),
      ],
    });
    expect(out.series.activity).toEqual([
      { day: '2025-01-21', totalSteps: 7200 },
      { day: '2025-01-22', totalSteps: 9100 },
    ]);
    expect(out.summary.activity.avgSteps).toBe(8150);
  });
});

describe('rangeStartIso', () => {
  it('returns range_days * 24h before nowMs', () => {
    // 2025-01-21 12:00:00 UTC
    const now = Date.parse('2025-01-21T12:00:00Z');
    const sevenDaysAgo = rangeStartIso('7d', now);
    expect(sevenDaysAgo.startsWith('2025-01-14T12:00:00')).toBe(true);
    // 2024 is a leap year, so 365 days back from 2025-01-21 lands on
    // 2024-01-22 (one day later than the naive calendar offset).
    const yearAgo = rangeStartIso('1y', now);
    expect(yearAgo.startsWith('2024-01-22')).toBe(true);
  });

  it('honours the days table for each range', () => {
    expect(TRENDS_RANGE_DAYS).toEqual({
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
      all_time: 365 * 50,
    });
  });
});

describe('aggregateTrends — empty input', () => {
  it('returns zero-shaped series + summary without throwing', () => {
    const out: TrendsData = aggregateTrends({ readings: [], vitalsOther: [] });
    expect(out.series.bp).toEqual([]);
    expect(out.series.hr).toEqual([]);
    expect(out.series.spo2).toEqual([]);
    expect(out.series.sleep).toEqual([]);
    expect(out.series.activity).toEqual([]);
    expect(out.summary).toEqual({
      bp: { count: 0, avgSys: null, avgDia: null, pctInRange: null },
      hr: { count: 0, avgResting: null },
      spo2: { count: 0, avgMinPercent: null },
      sleep: { count: 0, avgTotalMinutes: null },
      activity: { count: 0, avgSteps: null },
    });
  });
});
