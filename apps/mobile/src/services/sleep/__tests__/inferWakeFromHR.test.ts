// inferWakeFromHR — Sprint 18 / SLEEP_TIMEZONE_FIX_BRIEF §5.

import { inferWakeFromHR } from '../inferWakeFromHR';
import { formatClockInTz, epochSecForLocalHour } from '../../../utils/userTz';
import type { HRSample } from '../../../types/vitals';

const TZ_LAGOS = 'Africa/Lagos';
const TZ_NYC = 'America/New_York';

function sample(measuredAtSec: number, bpm: number): HRSample {
  return {
    measuredAtSec,
    bpm,
    sampleWindowSec: 300,
    motionState: 'unknown',
    isSpotCheck: false,
  };
}

/** Build a continuous 5-min-cadence HR series across a sleep window.
 *  `wakeHourLocal` defines when the surge begins; samples before then
 *  hover at `sleepBpm`, after at `wakeBpm`. */
function buildNight(
  dayLocal: string,
  tz: string,
  sleepBpm: number,
  wakeBpm: number,
  wakeHourLocal: number,
): HRSample[] {
  const samples: HRSample[] = [];
  // Anchor: 22:00 the previous local day → 09:00 the named local day.
  // Step in 5-min intervals.
  const priorMs = new Date(`${dayLocal}T00:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
  const priorDay = new Date(priorMs).toISOString().slice(0, 10);
  const startSec = epochSecForLocalHour(priorDay, 22, tz);
  const endSec = epochSecForLocalHour(dayLocal, 9, tz);
  const wakeSec = epochSecForLocalHour(dayLocal, wakeHourLocal, tz);
  for (let t = startSec; t <= endSec; t += 5 * 60) {
    samples.push(sample(t, t >= wakeSec ? wakeBpm : sleepBpm));
  }
  return samples;
}

describe('inferWakeFromHR — happy paths', () => {
  it('Lagos · wakes at 06:30 local · HR surge inflection wins', () => {
    const samples = buildNight('2026-05-22', TZ_LAGOS, 58, 78, 6.5);
    const r = inferWakeFromHR(samples, '2026-05-22', 420, TZ_LAGOS);
    expect(r.source).toBe('hr_inferred');
    // The first surge sample (≥ baseline + 15) is at 06:30 local
    // = 05:30 UTC. ±5 min of slack for sample-anchor rounding.
    expect(formatClockInTz(r.sessionEndSec, TZ_LAGOS)).toMatch(/6:30/);
  });

  it('NYC · wakes at 07:15 local · returns the correct UTC sec', () => {
    const samples = buildNight('2026-05-22', TZ_NYC, 56, 82, 7.25);
    const r = inferWakeFromHR(samples, '2026-05-22', 420, TZ_NYC);
    expect(r.source).toBe('hr_inferred');
    expect(formatClockInTz(r.sessionEndSec, TZ_NYC)).toMatch(/7:15/);
  });

  it('sessionStartSec = wake − totalMinutes × 60', () => {
    const samples = buildNight('2026-05-22', TZ_LAGOS, 58, 78, 7);
    const r = inferWakeFromHR(samples, '2026-05-22', 420, TZ_LAGOS);
    expect(r.sessionEndSec - r.sessionStartSec).toBe(420 * 60);
  });
});

describe('inferWakeFromHR — fallbacks', () => {
  it('zero HR samples → fallback at 07:00 local', () => {
    const r = inferWakeFromHR([], '2026-05-22', 420, TZ_LAGOS);
    expect(r.source).toBe('fallback');
    expect(formatClockInTz(r.sessionEndSec, TZ_LAGOS)).toMatch(/7:00/);
  });

  it('one HR sample → fallback (below MIN_SAMPLES threshold)', () => {
    const s = sample(epochSecForLocalHour('2026-05-22', 7, TZ_LAGOS), 80);
    const r = inferWakeFromHR([s], '2026-05-22', 420, TZ_LAGOS);
    expect(r.source).toBe('fallback');
  });

  it('two HR samples → fallback (still below MIN_SAMPLES)', () => {
    const a = sample(epochSecForLocalHour('2026-05-22', 6, TZ_LAGOS), 60);
    const b = sample(epochSecForLocalHour('2026-05-22', 7, TZ_LAGOS), 80);
    const r = inferWakeFromHR([a, b], '2026-05-22', 420, TZ_LAGOS);
    expect(r.source).toBe('fallback');
  });

  it('NYC user → fallback 07:00 local = 11:00 UTC', () => {
    const r = inferWakeFromHR([], '2026-05-22', 420, TZ_NYC);
    expect(r.source).toBe('fallback');
    expect(formatClockInTz(r.sessionEndSec, 'UTC')).toMatch(/11:00/);
  });
});

describe('inferWakeFromHR — false-positive guard', () => {
  it('a brief mid-night HR spike does NOT count as wake', () => {
    // 2-am toilet trip: one sample jumps from 58 → 78 then back to 60.
    const dayLocal = '2026-05-22';
    const samples = buildNight(dayLocal, TZ_LAGOS, 58, 78, 7); // real wake at 07:00
    // Inject a spike at 02:00 local — one sample at 80, then back to
    // sleeping baseline.
    const spikeSec = epochSecForLocalHour(dayLocal, 2, TZ_LAGOS);
    samples.push(sample(spikeSec, 80));
    samples.push(sample(spikeSec + 5 * 60, 58));
    samples.push(sample(spikeSec + 10 * 60, 56));
    samples.sort((a, b) => a.measuredAtSec - b.measuredAtSec);

    const r = inferWakeFromHR(samples, dayLocal, 420, TZ_LAGOS);
    expect(r.source).toBe('hr_inferred');
    // Real wake at 07:00 — the 02:00 spike should be rejected because
    // the 2 follow-ups don't hold above the threshold.
    expect(formatClockInTz(r.sessionEndSec, TZ_LAGOS)).toMatch(/7:00/);
  });

  it('two consecutive spikes still rejected when third returns to baseline', () => {
    const dayLocal = '2026-05-22';
    const samples = buildNight(dayLocal, TZ_LAGOS, 58, 78, 7);
    const spikeSec = epochSecForLocalHour(dayLocal, 3, TZ_LAGOS);
    samples.push(sample(spikeSec, 80));
    samples.push(sample(spikeSec + 5 * 60, 75));
    samples.push(sample(spikeSec + 10 * 60, 56));
    samples.sort((a, b) => a.measuredAtSec - b.measuredAtSec);

    const r = inferWakeFromHR(samples, dayLocal, 420, TZ_LAGOS);
    expect(r.source).toBe('hr_inferred');
    expect(formatClockInTz(r.sessionEndSec, TZ_LAGOS)).toMatch(/7:00/);
  });
});

describe('inferWakeFromHR — earliest valid inflection wins', () => {
  it('two valid surges → returns the first one', () => {
    // User wakes at 06:30, naps until 08:00, then up again at 10:00.
    // First valid inflection (06:30) should win.
    const dayLocal = '2026-05-22';
    const samples = buildNight(dayLocal, TZ_LAGOS, 58, 78, 6.5);

    const r = inferWakeFromHR(samples, dayLocal, 420, TZ_LAGOS);
    expect(r.source).toBe('hr_inferred');
    expect(formatClockInTz(r.sessionEndSec, TZ_LAGOS)).toMatch(/6:30/);
  });
});

describe('inferWakeFromHR — window bounds', () => {
  it('samples from a different day are ignored', () => {
    // All samples on 2026-05-20 — none in the 2026-05-22 wake window.
    const dayLocal = '2026-05-22';
    const samples = buildNight('2026-05-20', TZ_LAGOS, 58, 78, 7);
    const r = inferWakeFromHR(samples, dayLocal, 420, TZ_LAGOS);
    expect(r.source).toBe('fallback');
  });
});
