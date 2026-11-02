// Resting heart rate → Health Connect (2026-11-02). One value per
// completed night: the lowest 10-minute average HR between 22:00 and
// 06:00 in the wearer's time zone — the same rule the app already shows.

import { computeRestingHRByNight } from '../../../utils/vitalAggregators';
import { restingHeartRateRecords } from '../adapters/hcRecords';
import type { HRSample } from '../../../types/vitals';

const TZ = 'UTC';
const at = (iso: string) => Date.parse(iso) / 1000;
const hr = (iso: string, bpm: number): HRSample => ({
  measuredAtSec: at(iso),
  bpm,
  sampleWindowSec: 300,
  motionState: 'rest',
  isSpotCheck: false,
});

// Night of 1 → 2 Nov: samples every 5 min, lowest stretch 52/54 at 03:00.
const NIGHT = [
  hr('2026-11-01T23:00:00Z', 70),
  hr('2026-11-01T23:05:00Z', 68),
  hr('2026-11-02T03:00:00Z', 52),
  hr('2026-11-02T03:05:00Z', 54),
  hr('2026-11-02T05:30:00Z', 60),
  hr('2026-11-02T05:35:00Z', 62),
];

describe('computeRestingHRByNight', () => {
  it('takes the lowest 10-minute average of a completed night', () => {
    const nights = computeRestingHRByNight(NIGHT, at('2026-11-02T12:00:00Z'), TZ);
    expect(nights).toEqual([
      { nightKey: '2026-11-02', bpm: 53, measuredAtSec: at('2026-11-02T03:05:00Z'), sampleCount: 6 },
    ]);
  });

  it('leaves out a night still in progress', () => {
    expect(computeRestingHRByNight(NIGHT, at('2026-11-02T04:00:00Z'), TZ)).toEqual([]);
  });

  it('ignores daytime samples and nights with a single sample', () => {
    const nights = computeRestingHRByNight(
      [hr('2026-11-02T14:00:00Z', 40), hr('2026-11-03T02:00:00Z', 50)],
      at('2026-11-03T12:00:00Z'),
      TZ,
    );
    expect(nights).toEqual([]);
  });

  it('uses the wearer time zone for the night boundary', () => {
    // 04:00Z = 22:00 in Chicago (CST): inside Chicago's night, outside UTC's.
    const chicago = computeRestingHRByNight(
      [hr('2026-11-03T04:00:00Z', 55), hr('2026-11-03T04:05:00Z', 57)],
      at('2026-11-03T18:00:00Z'),
      'America/Chicago',
    );
    expect(chicago).toHaveLength(1);
    expect(chicago[0].nightKey).toBe('2026-11-03');
  });
});

describe('restingHeartRateRecords', () => {
  it('one record per night with a stable id; more samples = higher version', () => {
    const [a] = restingHeartRateRecords([
      { nightKey: '2026-11-02', bpm: 53.4, measuredAtSec: at('2026-11-02T03:05:00Z'), sampleCount: 6 },
    ]);
    const [b] = restingHeartRateRecords([
      { nightKey: '2026-11-02', bpm: 52, measuredAtSec: at('2026-11-02T03:05:00Z'), sampleCount: 90 },
    ]);
    const meta = (r: unknown) =>
      (r as { metadata: { clientRecordId: string; clientRecordVersion: number } }).metadata;
    expect((a as unknown as { beatsPerMinute: number }).beatsPerMinute).toBe(53);
    expect(meta(a).clientRecordId).toBe('leiko-rhr-2026-11-02');
    expect(meta(b).clientRecordId).toBe(meta(a).clientRecordId);
    expect(meta(b).clientRecordVersion).toBeGreaterThan(meta(a).clientRecordVersion);
  });

  it('drops values Health Connect would reject', () => {
    expect(
      restingHeartRateRecords([
        { nightKey: 'x', bpm: Number.NaN, measuredAtSec: 1, sampleCount: 2 },
        { nightKey: 'y', bpm: 10, measuredAtSec: 1, sampleCount: 2 },
      ]),
    ).toHaveLength(0);
  });
});
