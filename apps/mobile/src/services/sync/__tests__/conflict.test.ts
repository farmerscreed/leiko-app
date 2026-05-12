import { CONFLICT_POLICY, dedupVitalsOther } from '../conflict';

describe('CONFLICT_POLICY table', () => {
  it('covers every vitals_* row class', () => {
    const rowClasses = CONFLICT_POLICY.map((e) => e.rowClass);
    for (const vital of ['bp', 'hr', 'spo2', 'sleep', 'activity']) {
      expect(rowClasses).toContain(`vitals_${vital}`);
    }
  });

  it('marks vitals_correlations as server-wins (read-only on mobile)', () => {
    const entry = CONFLICT_POLICY.find(
      (e) => e.rowClass === 'vitals_correlations',
    );
    expect(entry?.winner).toBe('server');
  });

  it('marks profile + family + notification prefs as client-wins', () => {
    for (const rc of ['users.*', 'families.*', 'notification_preferences.*']) {
      const entry = CONFLICT_POLICY.find((e) => e.rowClass === rc);
      expect(entry?.winner).toBe('client');
    }
  });
});

describe('dedupVitalsOther', () => {
  const row = (
    userId: string,
    tsUtcSec: number,
    kind: string,
    value: number,
  ) => ({ userId, tsUtcSec, kind, value });

  it('returns the input unchanged when there are no duplicates', () => {
    const rows = [
      row('u1', 1, 'weight', 70),
      row('u1', 2, 'weight', 71),
      row('u1', 1, 'height', 175),
    ];
    expect(dedupVitalsOther(rows)).toHaveLength(3);
  });

  it('the LAST occurrence wins on duplicate (user, ts, kind)', () => {
    const rows = [
      row('u1', 100, 'weight', 70),
      row('u1', 100, 'weight', 71),
      row('u1', 100, 'weight', 72),
    ];
    const out = dedupVitalsOther(rows);
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(72);
  });

  it('treats different kinds at the same timestamp as distinct', () => {
    const rows = [
      row('u1', 100, 'weight', 70),
      row('u1', 100, 'glucose', 88),
    ];
    expect(dedupVitalsOther(rows)).toHaveLength(2);
  });

  it('treats different users at the same timestamp + kind as distinct', () => {
    const rows = [
      row('u1', 100, 'weight', 70),
      row('u2', 100, 'weight', 60),
    ];
    expect(dedupVitalsOther(rows)).toHaveLength(2);
  });
});
