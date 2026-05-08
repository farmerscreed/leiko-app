// useTrendsData — Sprint 9. Pure-helper tests; the TanStack hook
// surface is exercised end-to-end in the Trends.tsx integration tests.

import { latestPerTypeSortedByEffect } from '../useTrendsData';
import type { CorrelationRow } from '../../types/database';

function corr(input: Partial<CorrelationRow> & {
  correlation_type: CorrelationRow['correlation_type'];
  computed_at: string;
  pearson_r: number | null;
}): CorrelationRow {
  return {
    id: input.id ?? 'c-' + input.correlation_type + '-' + input.computed_at,
    family_id: input.family_id ?? 'family-1',
    user_id: input.user_id ?? 'user-1',
    correlation_type: input.correlation_type,
    window_days: input.window_days ?? 30,
    computed_at: input.computed_at,
    pearson_r: input.pearson_r,
    effect_size: input.effect_size ?? null,
    effect_unit: input.effect_unit ?? null,
    significance: input.significance ?? 0.01,
    sample_n: input.sample_n ?? 28,
    is_meaningful: input.is_meaningful ?? true,
    narrative_short: input.narrative_short ?? null,
    narrative_long: input.narrative_long ?? null,
    created_at: input.created_at ?? input.computed_at,
  };
}

describe('latestPerTypeSortedByEffect', () => {
  it('keeps the most recent row per correlation_type', () => {
    const out = latestPerTypeSortedByEffect([
      corr({ correlation_type: 'sleep_x_morning_bp', computed_at: '2025-04-10T03:00:00Z', pearson_r: -0.5 }),
      corr({ correlation_type: 'sleep_x_morning_bp', computed_at: '2025-04-11T03:00:00Z', pearson_r: -0.7 }),
      corr({ correlation_type: 'activity_x_resting_hr', computed_at: '2025-04-11T03:00:00Z', pearson_r: -0.4 }),
    ]);
    expect(out).toHaveLength(2);
    const sleep = out.find((r) => r.correlation_type === 'sleep_x_morning_bp');
    expect(sleep?.pearson_r).toBe(-0.7);
  });

  it('sorts by absolute pearson_r descending and caps at 3', () => {
    const out = latestPerTypeSortedByEffect([
      corr({ correlation_type: 'sleep_x_morning_bp', computed_at: '2025-04-11T03:00:00Z', pearson_r: -0.31 }),
      corr({ correlation_type: 'activity_x_resting_hr', computed_at: '2025-04-11T03:00:00Z', pearson_r: -0.92 }),
      corr({ correlation_type: 'spo2_dip_x_sleep_score', computed_at: '2025-04-11T03:00:00Z', pearson_r: 0.55 }),
    ]);
    expect(out.map((r) => r.correlation_type)).toEqual([
      'activity_x_resting_hr',
      'spo2_dip_x_sleep_score',
      'sleep_x_morning_bp',
    ]);
  });

  it('drops rows with null pearson_r', () => {
    const out = latestPerTypeSortedByEffect([
      corr({ correlation_type: 'sleep_x_morning_bp', computed_at: '2025-04-11T03:00:00Z', pearson_r: null }),
    ]);
    expect(out).toEqual([]);
  });
});
