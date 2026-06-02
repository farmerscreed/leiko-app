// SpO2 slice unit tests — Sprint 7.5.
//
// Bar mirrors hr.test.ts. Aggregator under test is overnightLowsRecent.

import { mmkv, STORAGE_KEYS } from '../../services/storage';
import { useSpO2 } from '../spo2';
import type { SpO2Sample } from '../../types/vitals';

function makeSample(measuredAtSec: number, percent: number): SpO2Sample {
  return {
    measuredAtSec,
    percent,
    maxInWindow: percent,
    minInWindow: percent,
    sampleWindowSec: 30 * 60,
    isSpotCheck: false,
    perfusionIndex: 0.5,
  };
}

beforeEach(() => {
  mmkv.clearAll();
  useSpO2.getState().reset();
});

describe('useSpO2 slice', () => {
  test('addPending writes synchronously to MMKV (offline-first)', () => {
    expect(mmkv.getString(STORAGE_KEYS.pendingSpO2)).toBeUndefined();
    useSpO2.getState().addPending(makeSample(1_700_000_000, 97));
    const raw = mmkv.getString(STORAGE_KEYS.pendingSpO2);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  test('addPending dedups on duplicate measuredAtSec — replaces row', () => {
    useSpO2.getState().addPending(makeSample(1_700_000_000, 97));
    useSpO2.getState().addPending(makeSample(1_700_000_000, 95));
    expect(useSpO2.getState().pending).toHaveLength(1);
    expect(useSpO2.getState().pending[0].percent).toBe(95);
  });

  test('latestPercent reads across pending + recent, freshest wins', () => {
    useSpO2.setState({ recent: [makeSample(1_700_000_000, 96)] });
    useSpO2.getState().addPending(makeSample(1_700_001_000, 92));
    expect(useSpO2.getState().latestPercent()).toBe(92);
  });

  test('overnightLowsRecent — minimum percent per night, oldest first', () => {
    // 3 nights ending the morning of 2026-05-07.
    // Night A → morning 2026-05-05: lows 88, 90 → min 88
    // Night B → morning 2026-05-06: lows 92, 93 → min 92
    // Night C → morning 2026-05-07: lows 86, 89 → min 86
    const nightA = Date.UTC(2026, 4, 4, 23, 0, 0) / 1000;
    const nightAa = Date.UTC(2026, 4, 5, 3, 0, 0) / 1000;
    const nightB = Date.UTC(2026, 4, 5, 23, 0, 0) / 1000;
    const nightBb = Date.UTC(2026, 4, 6, 3, 0, 0) / 1000;
    const nightC = Date.UTC(2026, 4, 6, 23, 0, 0) / 1000;
    const nightCc = Date.UTC(2026, 4, 7, 3, 0, 0) / 1000;
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;

    useSpO2.setState({
      recent: [
        makeSample(nightA, 88), makeSample(nightAa, 90),
        makeSample(nightB, 92), makeSample(nightBb, 93),
        makeSample(nightC, 86), makeSample(nightCc, 89),
      ],
    });
    const lows = useSpO2.getState().overnightLowsRecent(nowSec, 14);
    // Oldest first: 88, 92, 86.
    expect(lows).toEqual([88, 92, 86]);
  });

  test('overnightLowsRecent — daytime samples excluded from the window', () => {
    // Samples at 14:00 UTC on the same day should not contribute.
    const dayMid = Date.UTC(2026, 4, 6, 14, 0, 0) / 1000;
    const overnight = Date.UTC(2026, 4, 6, 23, 30, 0) / 1000;
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    useSpO2.setState({
      recent: [
        makeSample(dayMid, 80),    // outside window — ignored
        makeSample(overnight, 95),
      ],
    });
    const lows = useSpO2.getState().overnightLowsRecent(nowSec, 14);
    expect(lows).toEqual([95]);
  });

  test('acceptSyncResult moves rows pending → recent', () => {
    const s1 = makeSample(1_700_000_000, 97);
    const s2 = makeSample(1_700_001_000, 96);
    useSpO2.getState().addPending(s1);
    useSpO2.getState().addPending(s2);
    useSpO2.getState().acceptSyncResult([String(s1.measuredAtSec)]);
    expect(useSpO2.getState().pending).toHaveLength(1);
    expect(useSpO2.getState().recent).toHaveLength(1);
    expect(useSpO2.getState().recent[0].measuredAtSec).toBe(s1.measuredAtSec);
  });

  test('hydrate recovers pending from MMKV after a fresh store instance', () => {
    useSpO2.getState().addPending(makeSample(1_700_000_000, 97));
    useSpO2.setState({ pending: [], recent: [] });
    useSpO2.getState().hydrate();
    expect(useSpO2.getState().pending).toHaveLength(1);
  });

  test('reset clears pending + recent + MMKV', () => {
    useSpO2.getState().addPending(makeSample(1_700_000_000, 97));
    useSpO2.setState({ recent: [makeSample(1_699_999_000, 96)] });
    useSpO2.getState().reset();
    expect(useSpO2.getState().pending).toEqual([]);
    expect(useSpO2.getState().recent).toEqual([]);
    expect(mmkv.contains(STORAGE_KEYS.pendingSpO2)).toBe(false);
    expect(mmkv.contains(STORAGE_KEYS.recentSpO2)).toBe(false);
  });

  // ---- Sprint 16.5e — server hydration ---------------------------------

  test('seedFromServer adds new samples + dedups by measuredAtSec', () => {
    useSpO2.setState({ recent: [makeSample(1_700_000_000, 97)] });
    const serverRows = [
      makeSample(1_700_000_000, 50), // duplicate; existing wins
      makeSample(1_699_900_000, 95),
      makeSample(1_699_800_000, 96),
    ];
    const added = useSpO2.getState().seedFromServer(serverRows);
    expect(added).toBe(2);
    const recent = useSpO2.getState().recent;
    expect(recent).toHaveLength(3);
    const dup = recent.find((s) => s.measuredAtSec === 1_700_000_000);
    expect(dup?.percent).toBe(97);
  });

  test('seedFromServer ignores rows already in pending', () => {
    useSpO2.getState().addPending(makeSample(1_700_000_000, 97));
    const added = useSpO2
      .getState()
      .seedFromServer([makeSample(1_700_000_000, 50)]);
    expect(added).toBe(0);
    expect(useSpO2.getState().recent).toEqual([]);
  });

  test('seedFromServer sorts merged result newest-first + persists', () => {
    const rows = [
      makeSample(1_699_800_000, 94),
      makeSample(1_700_000_000, 97),
      makeSample(1_699_900_000, 95),
    ];
    useSpO2.getState().seedFromServer(rows);
    const recent = useSpO2.getState().recent;
    expect(recent.map((s) => s.measuredAtSec)).toEqual([
      1_700_000_000,
      1_699_900_000,
      1_699_800_000,
    ]);
    expect(mmkv.getString(STORAGE_KEYS.recentSpO2)).toBeDefined();
  });

  test('seedFromServer returns 0 on empty input', () => {
    useSpO2.setState({ recent: [makeSample(1_700_000_000, 97)] });
    expect(useSpO2.getState().seedFromServer([])).toBe(0);
    expect(useSpO2.getState().recent).toHaveLength(1);
  });
});
