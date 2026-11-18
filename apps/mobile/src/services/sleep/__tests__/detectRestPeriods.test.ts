import { detectRestPeriods, sleepingBaselineBpm } from '../detectRestPeriods';
import { epochSecForLocalHour } from '../../../utils/userTz';
import type { HRSample } from '../../../types/vitals';

const TZ = 'Africa/Lagos';
const DAY = '2026-11-18';

function hr(sec: number, bpm: number): HRSample {
  return { measuredAtSec: sec, bpm, sampleWindowSec: 300, motionState: 'unknown', isSpotCheck: false };
}

/** A day of 5-min samples: night at `nightBpm`, day at `dayBpm`, with
 *  optional low stretches [startHour, endHour) at `restBpm`. */
function day(nightBpm: number, dayBpm: number, rests: Array<[number, number, number]> = []): HRSample[] {
  const out: HRSample[] = [];
  const start = epochSecForLocalHour(DAY, 0, TZ);
  for (let t = start; t < start + 22 * 3600; t += 300) {
    const h = (t - start) / 3600;
    let bpm = h < 6 ? nightBpm : dayBpm;
    for (const [a, b, v] of rests) if (h >= a && h < b) bpm = v;
    out.push(hr(t, bpm));
  }
  return out;
}

const quietHours = (busy: Record<number, number> = {}) =>
  Array.from({ length: 24 }, (_, h) => busy[h] ?? 40);

describe('sleepingBaselineBpm', () => {
  it("uses the wearer's own night heart rate", () => {
    expect(sleepingBaselineBpm(day(58, 82), DAY, TZ)).toBe(58);
    expect(sleepingBaselineBpm(day(70, 90), DAY, TZ)).toBe(70);
  });

  it('returns null without enough night data', () => {
    expect(sleepingBaselineBpm([], DAY, TZ)).toBeNull();
  });
});

describe('detectRestPeriods', () => {
  it('finds an afternoon nap backed by heart rate and still hours', () => {
    const periods = detectRestPeriods(day(58, 82, [[14, 15, 61]]), DAY, TZ, quietHours({ 10: 900, 17: 1200 }));
    expect(periods).toHaveLength(1);
    const p = periods[0];
    expect(p.startSec).toBe(epochSecForLocalHour(DAY, 14, TZ));
    expect(p.durationMinutes).toBe(60);
    expect(p.avgBpm).toBe(61);
    expect(p.baselineBpm).toBe(58);
    expect(p.confidence).toBe('hr_and_steps');
  });

  it('ignores stretches shorter than 20 minutes', () => {
    expect(detectRestPeriods(day(58, 82, [[14, 14.25, 60]]), DAY, TZ, quietHours())).toHaveLength(0);
  });

  it('rejects low heart rate while the step timeline shows walking', () => {
    expect(detectRestPeriods(day(58, 82, [[14, 15, 61]]), DAY, TZ, quietHours({ 14: 2000 }))).toHaveLength(0);
  });

  it('marks heart-rate-only estimates when there is no step timeline', () => {
    const periods = detectRestPeriods(day(58, 82, [[13, 13.5, 62]]), DAY, TZ, null);
    expect(periods).toHaveLength(1);
    expect(periods[0].confidence).toBe('hr_only');
  });

  it('judges each wearer against their own sleeping level', () => {
    // Daytime 72 is "resting" for someone who sleeps at 68, not for someone at 52.
    expect(detectRestPeriods(day(68, 90, [[15, 16, 72]]), DAY, TZ, quietHours())).toHaveLength(1);
    expect(detectRestPeriods(day(52, 90, [[15, 16, 72]]), DAY, TZ, quietHours())).toHaveLength(0);
  });

  it('splits on a gap in the heart-rate record', () => {
    const samples = day(58, 82, [[14, 16, 60]]).filter((s) => {
      const h = (s.measuredAtSec - epochSecForLocalHour(DAY, 0, TZ)) / 3600;
      return !(h >= 14.9 && h < 15.1);
    });
    const periods = detectRestPeriods(samples, DAY, TZ, quietHours());
    expect(periods.length).toBe(2);
  });

  it('finds nothing without a night baseline', () => {
    const samples = day(58, 82, [[14, 15, 60]]).filter((s) => s.measuredAtSec >= epochSecForLocalHour(DAY, 8, TZ));
    expect(detectRestPeriods(samples, DAY, TZ, quietHours())).toEqual([]);
  });
});
