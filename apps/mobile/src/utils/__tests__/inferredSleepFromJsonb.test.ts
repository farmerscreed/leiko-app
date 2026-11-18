import { inferredSleepFromJsonb } from '../inferredSleepFromJsonb';

describe('inferredSleepFromJsonb', () => {
  it('reads the stored inferred times and source', () => {
    expect(
      inferredSleepFromJsonb({
        inferred_start: '2026-11-11T23:30:00.000Z',
        inferred_end: '2026-11-12T07:00:00.000Z',
        wake_source: 'hr_inferred',
      }),
    ).toEqual({
      inferredSessionStartSec: Date.parse('2026-11-11T23:30:00Z') / 1000,
      inferredSessionEndSec: Date.parse('2026-11-12T07:00:00Z') / 1000,
      wakeSource: 'hr_inferred',
    });
  });

  it('returns nothing for rows written before 2026-11-18 or with bad values', () => {
    expect(inferredSleepFromJsonb({ sleep_score: 70 })).toEqual({});
    expect(inferredSleepFromJsonb(null)).toEqual({});
    expect(
      inferredSleepFromJsonb({ inferred_start: '2026-11-12T07:00:00Z', inferred_end: '2026-11-11T23:00:00Z' }),
    ).toEqual({});
  });
});
