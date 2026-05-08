// Activity slice unit tests — Sprint 7.5.
//
// Bar mirrors hr.test.ts. Two pending buffers (steps + calories), one
// store. Aggregators under test: todaySteps, todayCalories,
// recentStepDays.

import { mmkv, STORAGE_KEYS } from '../../services/storage';
import { useActivity } from '../activity';
import type { ActivityDay, CaloriesDay } from '../../types/vitals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fixtures = require('../../../../../tools/ble-mock/fixtures');

const SECONDS_PER_DAY = 24 * 60 * 60;

function dayLocalFor(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

function makeActivityDay(unixSec: number, totalSteps: number, target = 6000): ActivityDay {
  return {
    dayLocal: dayLocalFor(unixSec),
    measuredAtSec: unixSec,
    totalSteps,
    targetSteps: target,
    lastSampleAtSec: unixSec + 22 * 3600,
    hourly: Array.from({ length: 24 }, () => 0),
  };
}

function makeCaloriesDay(unixSec: number, totalKcal: number): CaloriesDay {
  return {
    dayLocal: dayLocalFor(unixSec),
    measuredAtSec: unixSec,
    totalKcal,
    activityKcal: 320,
    bmrKcal: totalKcal - 320,
    targetKcal: null,
  };
}

beforeEach(() => {
  mmkv.clearAll();
  useActivity.getState().reset();
});

describe('useActivity slice', () => {
  test('addPendingSteps writes synchronously to MMKV (offline-first)', () => {
    const today = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    expect(mmkv.getString(STORAGE_KEYS.pendingActivity)).toBeUndefined();
    useActivity.getState().addPendingSteps(makeActivityDay(today, 7200));
    const raw = mmkv.getString(STORAGE_KEYS.pendingActivity);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  test('addPendingCalories writes synchronously to MMKV', () => {
    const today = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    useActivity.getState().addPendingCalories(makeCaloriesDay(today, 1800));
    const raw = mmkv.getString(STORAGE_KEYS.pendingCalories);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  test('addPendingSteps dedups by dayLocal — replaces existing row', () => {
    const today = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    useActivity.getState().addPendingSteps(makeActivityDay(today, 5000));
    useActivity.getState().addPendingSteps(makeActivityDay(today, 7200));
    const pending = useActivity.getState().pendingSteps;
    expect(pending).toHaveLength(1);
    expect(pending[0].totalSteps).toBe(7200);
  });

  test('todaySteps + todayCalories match nowSec dayLocal', () => {
    const todaySec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const yesterdaySec = todaySec - SECONDS_PER_DAY;
    useActivity.setState({
      recentSteps: [
        makeActivityDay(yesterdaySec, 5000),
        makeActivityDay(todaySec, 7200),
      ],
      recentCalories: [
        makeCaloriesDay(yesterdaySec, 1700),
        makeCaloriesDay(todaySec, 1800),
      ],
    });
    expect(useActivity.getState().todaySteps(todaySec)?.totalSteps).toBe(7200);
    expect(useActivity.getState().todayCalories(todaySec)?.totalKcal).toBe(1800);
  });

  test('todaySteps returns null when no row matches nowSec dayLocal', () => {
    const todaySec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const yesterdaySec = todaySec - SECONDS_PER_DAY;
    useActivity.setState({
      recentSteps: [makeActivityDay(yesterdaySec, 5000)],
    });
    expect(useActivity.getState().todaySteps(todaySec)).toBeNull();
  });

  test('recentStepDays — last N days oldest first, empty days skipped', () => {
    const todaySec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    // Days at -1, -3, -5, -10. -10 is outside default 14? no, 14 includes it.
    const days = [1, 3, 5, 10].map((ago) => {
      return makeActivityDay(todaySec - ago * SECONDS_PER_DAY, 1000 * ago);
    });
    useActivity.setState({ recentSteps: days });
    const recent = useActivity.getState().recentStepDays(todaySec, 14);
    // Oldest first: -10 (10000) → -5 (5000) → -3 (3000) → -1 (1000).
    expect(recent).toEqual([10000, 5000, 3000, 1000]);
  });

  test('acceptStepsSyncResult moves rows pending → recent (dedup by dayLocal)', () => {
    const day1 = Date.UTC(2026, 4, 6, 0, 0, 0) / 1000;
    const day2 = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    const a = makeActivityDay(day1, 5000);
    const b = makeActivityDay(day2, 7200);
    useActivity.getState().addPendingSteps(a);
    useActivity.getState().addPendingSteps(b);
    useActivity.getState().acceptStepsSyncResult([a.dayLocal]);
    const state = useActivity.getState();
    expect(state.pendingSteps).toHaveLength(1);
    expect(state.recentSteps).toHaveLength(1);
    expect(state.recentSteps[0].dayLocal).toBe(a.dayLocal);
  });

  test('acceptCaloriesSyncResult moves rows pending → recent (dedup by dayLocal)', () => {
    const day1 = Date.UTC(2026, 4, 6, 0, 0, 0) / 1000;
    const day2 = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    const a = makeCaloriesDay(day1, 1700);
    const b = makeCaloriesDay(day2, 1800);
    useActivity.getState().addPendingCalories(a);
    useActivity.getState().addPendingCalories(b);
    useActivity.getState().acceptCaloriesSyncResult([a.dayLocal]);
    const state = useActivity.getState();
    expect(state.pendingCalories).toHaveLength(1);
    expect(state.recentCalories).toHaveLength(1);
    expect(state.recentCalories[0].dayLocal).toBe(a.dayLocal);
  });

  test('hydrate recovers both pending buffers from MMKV', () => {
    const today = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    useActivity.getState().addPendingSteps(makeActivityDay(today, 7200));
    useActivity.getState().addPendingCalories(makeCaloriesDay(today, 1800));
    useActivity.setState({
      pendingSteps: [],
      pendingCalories: [],
      recentSteps: [],
      recentCalories: [],
    });
    useActivity.getState().hydrate();
    expect(useActivity.getState().pendingSteps).toHaveLength(1);
    expect(useActivity.getState().pendingCalories).toHaveLength(1);
  });

  test('reset clears all pending + recent + MMKV', () => {
    const today = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    useActivity.getState().addPendingSteps(makeActivityDay(today, 7200));
    useActivity.getState().addPendingCalories(makeCaloriesDay(today, 1800));
    useActivity.setState({
      recentSteps: [makeActivityDay(today - SECONDS_PER_DAY, 5000)],
      recentCalories: [makeCaloriesDay(today - SECONDS_PER_DAY, 1700)],
    });
    useActivity.getState().reset();
    expect(useActivity.getState().pendingSteps).toEqual([]);
    expect(useActivity.getState().recentSteps).toEqual([]);
    expect(useActivity.getState().pendingCalories).toEqual([]);
    expect(useActivity.getState().recentCalories).toEqual([]);
    expect(mmkv.contains(STORAGE_KEYS.pendingActivity)).toBe(false);
    expect(mmkv.contains(STORAGE_KEYS.pendingCalories)).toBe(false);
    expect(mmkv.contains(STORAGE_KEYS.recentActivity)).toBe(false);
    expect(mmkv.contains(STORAGE_KEYS.recentCalories)).toBe(false);
  });

  test('fixture activityNormalDay round-trips through addPendingSteps', () => {
    const today = Date.UTC(2026, 4, 7, 0, 0, 0) / 1000;
    const day = fixtures.activityNormalDay({ dayStartSec: today });
    useActivity.getState().addPendingSteps(day);
    const got = useActivity.getState().todaySteps(today);
    expect(got?.totalSteps).toBe(7200);
    expect(got?.targetSteps).toBe(6000);
    expect(got?.hourly).toHaveLength(24);
  });
});
