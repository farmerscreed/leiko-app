import { mmkv } from '../../storage';
import { useHR } from '../../../state/hr';
import { useRestPeriods } from '../../../state/restPeriods';
import { scanRestPeriods } from '../restPeriodScan';
import { epochSecForLocalHour } from '../../../utils/userTz';
import type { HRSample } from '../../../types/vitals';

const TZ = 'Africa/Lagos';

function dayOfHR(day: string, napFrom: number, napTo: number): HRSample[] {
  const out: HRSample[] = [];
  const start = epochSecForLocalHour(day, 0, TZ);
  for (let t = start; t < start + 23 * 3600; t += 300) {
    const h = (t - start) / 3600;
    const bpm = h < 6 ? 58 : h >= napFrom && h < napTo ? 60 : 84;
    out.push({ measuredAtSec: t, bpm, sampleWindowSec: 300, motionState: 'unknown', isSpotCheck: false });
  }
  return out;
}

beforeEach(() => {
  mmkv.clearAll();
  useRestPeriods.getState().reset();
  useHR.setState({ pending: [], recent: [] });
});

describe('scanRestPeriods', () => {
  it('scans finished days once and queues what it finds', () => {
    useHR.setState({ pending: [...dayOfHR('2026-11-16', 14, 15), ...dayOfHR('2026-11-17', 13, 13.5)] });
    const now = epochSecForLocalHour('2026-11-18', 10, TZ);
    expect(scanRestPeriods('W1', now, TZ)).toBe(2);
    expect(useRestPeriods.getState().pending.map((p) => p.dayLocal)).toEqual(['2026-11-16', '2026-11-17']);
    expect(useRestPeriods.getState().pending.every((p) => p.confidence === 'hr_only')).toBe(true);
    // Second run: nothing new.
    expect(scanRestPeriods('W1', now, TZ)).toBe(0);
    expect(useRestPeriods.getState().pending).toHaveLength(2);
  });

  it('waits for a day whose evening heart rate has not synced yet', () => {
    const partial = dayOfHR('2026-11-17', 13, 14).filter(
      (s) => s.measuredAtSec < epochSecForLocalHour('2026-11-17', 18, TZ),
    );
    useHR.setState({ pending: partial });
    const now = epochSecForLocalHour('2026-11-18', 10, TZ);
    expect(scanRestPeriods('W1', now, TZ)).toBe(0);
    useHR.setState({ pending: dayOfHR('2026-11-17', 13, 14) });
    expect(scanRestPeriods('W1', now, TZ)).toBe(1);
  });

  it('never scans today', () => {
    useHR.setState({ pending: dayOfHR('2026-11-18', 13, 14) });
    expect(scanRestPeriods('W1', epochSecForLocalHour('2026-11-18', 23, TZ), TZ)).toBe(0);
  });
});
