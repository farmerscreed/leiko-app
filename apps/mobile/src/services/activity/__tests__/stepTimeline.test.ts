import { mmkv } from '../../storage';
import { advanceTimeline, getTimeline, recordStepTotal, unplacedSteps } from '../stepTimeline';

const TZ = 'Africa/Lagos'; // UTC+1, no DST
const DAY = '2026-11-18';
// 2026-11-18 00:00 Lagos = 2026-11-17T23:00Z
const at = (hh: number, mm = 0) => Date.UTC(2026, 10, 17, 23 + hh, mm) / 1000;

describe('advanceTimeline', () => {
  it('starts a day with nothing placed — steps before the first read are not invented', () => {
    const t = advanceTimeline(null, DAY, 1200, at(9, 30), TZ);
    expect(t.hourly.reduce((a, b) => a + b, 0)).toBe(0);
    expect(unplacedSteps(t, 1200)).toBe(1200);
  });

  it('puts steps taken within the hour into that hour', () => {
    let t = advanceTimeline(null, DAY, 1000, at(9, 5), TZ);
    t = advanceTimeline(t, DAY, 1600, at(9, 50), TZ);
    expect(t.hourly[9]).toBe(600);
    expect(t.spreadSec).toBe(0);
  });

  it('spreads a multi-hour gap across the hours by time, with an exact sum', () => {
    let t = advanceTimeline(null, DAY, 0, at(8, 0), TZ);
    t = advanceTimeline(t, DAY, 3001, at(11, 0), TZ);
    expect(t.hourly[8] + t.hourly[9] + t.hourly[10]).toBe(3001);
    expect(t.hourly[8]).toBe(1000);
    expect(t.hourly[9]).toBe(1000);
    expect(t.hourly[10]).toBe(1001);
    expect(t.spreadSec).toBe(3 * 3600);
  });

  it('re-baselines when the total goes down, keeping placed hours', () => {
    let t = advanceTimeline(null, DAY, 100, at(7), TZ);
    t = advanceTimeline(t, DAY, 500, at(7, 30), TZ);
    t = advanceTimeline(t, DAY, 20, at(8), TZ); // watch reset
    expect(t.hourly[7]).toBe(400);
    expect(t.lastTotal).toBe(20);
    t = advanceTimeline(t, DAY, 120, at(8, 30), TZ);
    expect(t.hourly[8]).toBe(100);
  });

  it("keeps a late read of yesterday's final total inside yesterday", () => {
    let t = advanceTimeline(null, DAY, 5000, at(22), TZ);
    t = advanceTimeline(t, DAY, 5600, at(26), TZ); // read at 02:00 next day
    expect(t.hourly[22] + t.hourly[23]).toBe(600);
  });

  it('starts fresh for a new day', () => {
    const t1 = advanceTimeline(null, DAY, 5000, at(22), TZ);
    const t2 = advanceTimeline(t1, '2026-11-19', 30, at(24, 10), TZ);
    expect(t2.dayLocal).toBe('2026-11-19');
    expect(t2.hourly.every((h) => h === 0)).toBe(true);
  });
});

describe('recordStepTotal store', () => {
  beforeEach(() => mmkv.clearAll());

  it('persists per watch and day, keeping the last 3 days', () => {
    recordStepTotal('W1', '2026-11-15', 10, at(1), TZ);
    recordStepTotal('W1', '2026-11-16', 10, at(1), TZ);
    recordStepTotal('W1', '2026-11-17', 10, at(1), TZ);
    recordStepTotal('W1', DAY, 100, at(9), TZ);
    const t = recordStepTotal('W1', DAY, 400, at(9, 40), TZ);
    expect(t.hourly[9]).toBe(300);
    expect(getTimeline('W1', DAY)?.hourly[9]).toBe(300);
    expect(getTimeline('W1', '2026-11-15')).toBeNull();
    expect(getTimeline('W2', DAY)).toBeNull();
  });
});
