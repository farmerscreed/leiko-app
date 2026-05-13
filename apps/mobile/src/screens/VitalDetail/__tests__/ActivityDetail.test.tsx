// ActivityDetail — Sprint 8.5.
//
// Mocks the data hooks at the boundary so this stays a screen test, not
// a data test.

import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import {
  ActivityDetail,
  buildChartSeries,
  buildRangedDays,
  buildRecentReadings,
  chartTitle,
  computeStreakFromToday,
  rangeShortLabel,
} from '../ActivityDetail';
import {
  composeDailyPulseData,
  type DailyPulseData,
  type DailyPulseSnapshot,
} from '../../../state/dailyPulse';
import type { ActivityDay, CaloriesDay } from '../../../types/vitals';

const NOW_SEC = () => Math.floor(Date.now() / 1000);
const SECONDS_PER_DAY = 24 * 60 * 60;

let mockData: DailyPulseData = composeDailyPulseData(
  emptySnapshot(),
  NOW_SEC(),
);

let mockRecentSteps: ActivityDay[] = [];
let mockPendingSteps: ActivityDay[] = [];
let mockTodayCalories: CaloriesDay | null = null;

function emptySnapshot(): DailyPulseSnapshot {
  return {
    bpLatest: null,
    hrRestingToday: null,
    hrRestingRecent: [],
    hrLatestSampleAt: null,
    spo2LatestPercent: null,
    spo2OvernightLowsRecent: [],
    spo2LatestSampleAt: null,
    sleepSession: null,
    activityToday: null,
  };
}

const setMockData = (snapshot: DailyPulseSnapshot) => {
  mockData = composeDailyPulseData(snapshot, NOW_SEC());
};

jest.mock('../../../state/dailyPulse', () => {
  const actual = jest.requireActual('../../../state/dailyPulse');
  return {
    ...actual,
    useDailyPulseData: () => mockData,
  };
});

jest.mock('../../../state/activity', () => ({
  useActivity: (selector?: (s: unknown) => unknown) => {
    const state = {
      recentSteps: mockRecentSteps,
      pendingSteps: mockPendingSteps,
      recentCalories: [],
      pendingCalories: [],
      todayCalories: () => mockTodayCalories,
    };
    return selector ? selector(state) : state;
  },
}));

function withProviders(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 720 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver" colorMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function dayKey(secOffset: number): string {
  return new Date((NOW_SEC() - secOffset * SECONDS_PER_DAY) * 1000)
    .toISOString()
    .slice(0, 10);
}

function makeDay(secOffset: number, totalSteps: number, target = 8000): ActivityDay {
  const measuredAtSec = NOW_SEC() - secOffset * SECONDS_PER_DAY;
  return {
    dayLocal: dayKey(secOffset),
    measuredAtSec,
    totalSteps,
    targetSteps: target,
    lastSampleAtSec: measuredAtSec,
    hourly: new Array(24).fill(0),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecentSteps = [];
  mockPendingSteps = [];
  mockTodayCalories = null;
});

describe('ActivityDetail — populated state', () => {
  beforeEach(() => {
    // Build a 7-day history including today.
    mockPendingSteps = [makeDay(0, 2140)];
    mockRecentSteps = [
      makeDay(1, 9100),
      makeDay(2, 8200),
      makeDay(3, 5400),
      makeDay(4, 7900),
      makeDay(5, 6800),
      makeDay(6, 4200),
    ];
    mockTodayCalories = {
      dayLocal: dayKey(0),
      measuredAtSec: NOW_SEC(),
      totalKcal: 410,
      activityKcal: 410,
      bmrKcal: 0,
      targetKcal: null,
    };
    setMockData({
      ...emptySnapshot(),
      activityToday: mockPendingSteps[0],
    });
  });

  it('renders all sections (hero, stat trio, weekly bars, insight, recent, goal row)', () => {
    render(withProviders(<ActivityDetail onBack={() => undefined} />));
    expect(screen.getByTestId('activity-detail-hero')).toBeTruthy();
    expect(screen.getByTestId('activity-detail-stat-trio')).toBeTruthy();
    expect(screen.getByTestId('activity-detail-weekly-bars')).toBeTruthy();
    expect(screen.getByTestId('activity-detail-insight')).toBeTruthy();
    expect(screen.getByTestId('activity-detail-recent')).toBeTruthy();
    expect(screen.getByTestId('activity-detail-goal-row')).toBeTruthy();
  });

  it('shows the comma-formatted step count in the hero', () => {
    render(withProviders(<ActivityDetail onBack={() => undefined} />));
    expect(screen.getAllByText('2,140').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the section labels', () => {
    render(withProviders(<ActivityDetail onBack={() => undefined} />));
    expect(screen.getByText('This week vs goal')).toBeTruthy();
    expect(screen.getByText('Recent days')).toBeTruthy();
    expect(screen.getByText('Daily step goal')).toBeTruthy();
  });

  it('uses the supportive insight body (no gamification words)', () => {
    render(withProviders(<ActivityDetail onBack={() => undefined} />));
    const json = JSON.stringify(screen.toJSON());
    expect(json).not.toMatch(/\bcrush(ed|ing)?\b/i);
    expect(json).not.toMatch(/\bbeast\b/i);
    expect(json).not.toMatch(/\bkiller\b/i);
    expect(json).not.toMatch(/\bdangerous\b/i);
    expect(json).not.toMatch(/\bpatient\b/i);
    expect(json).not.toMatch(/\bdiagnose\b/i);
  });
});

describe('ActivityDetail — empty state', () => {
  beforeEach(() => {
    setMockData(emptySnapshot());
    mockRecentSteps = [];
    mockPendingSteps = [];
    mockTodayCalories = null;
  });

  it('shows the welcome message and skips the weekly bars', () => {
    render(withProviders(<ActivityDetail onBack={() => undefined} />));
    expect(
      screen.getByText('Start moving to see your day fill in.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('activity-detail-weekly-bars')).toBeNull();
    expect(screen.queryByTestId('activity-detail-stat-trio')).toBeNull();
    expect(screen.queryByTestId('activity-detail-recent')).toBeNull();
  });

  it('still renders the insight + goal config row', () => {
    render(withProviders(<ActivityDetail onBack={() => undefined} />));
    expect(screen.getByTestId('activity-detail-insight')).toBeTruthy();
    expect(screen.getByTestId('activity-detail-goal-row')).toBeTruthy();
  });
});

describe('ActivityDetail — goal sheet wiring', () => {
  beforeEach(() => {
    setMockData(emptySnapshot());
  });

  it('tapping the goal row opens the sheet', () => {
    render(withProviders(<ActivityDetail onBack={() => undefined} />));
    expect(screen.queryByTestId('activity-detail-goal-sheet-save')).toBeNull();
    fireEvent.press(screen.getByTestId('activity-detail-goal-row'));
    expect(
      screen.getByTestId('activity-detail-goal-sheet-save'),
    ).toBeTruthy();
  });

  it('saving a new goal fires the onGoalChange callback', () => {
    const onGoalChange = jest.fn();
    render(
      withProviders(
        <ActivityDetail onBack={() => undefined} onGoalChange={onGoalChange} />,
      ),
    );
    fireEvent.press(screen.getByTestId('activity-detail-goal-row'));
    fireEvent.press(screen.getByTestId('activity-detail-goal-sheet-option-10000'));
    fireEvent.press(screen.getByTestId('activity-detail-goal-sheet-save'));
    expect(onGoalChange).toHaveBeenCalledWith(10000);
  });
});

// ---- Sprint 16.5e — pure helper tests --------------------------------

describe('ActivityDetail helpers — buildChartSeries', () => {
  const dailyGoal = 8000;

  function makeAt(unixSec: number, totalSteps: number): ActivityDay {
    return {
      dayLocal: new Date(unixSec * 1000).toISOString().slice(0, 10),
      measuredAtSec: unixSec,
      totalSteps,
      targetSteps: dailyGoal,
      lastSampleAtSec: unixSec,
      hourly: new Array(24).fill(0),
    };
  }

  it('7d returns 7 daily bars with the daily goal', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) =>
      makeAt(nowSec - i * SECONDS_PER_DAY, (7 - i) * 1000),
    );
    const out = buildChartSeries([], days, dailyGoal, '7d', nowSec);
    expect(out.values).toHaveLength(7);
    expect(out.goal).toBe(dailyGoal);
    // Index 6 is today (newest).
    expect(out.values[6]).toBe(7000);
    expect(out.values[0]).toBe(1000);
  });

  it('30d returns weekly aggregates (5 bins) with weekly goal', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days: ActivityDay[] = [];
    for (let i = 0; i < 30; i++) {
      days.push(makeAt(nowSec - i * SECONDS_PER_DAY, 5000));
    }
    const out = buildChartSeries([], days, dailyGoal, '30d', nowSec);
    expect(out.values.length).toBeLessThanOrEqual(5);
    expect(out.goal).toBe(dailyGoal * 7);
    // Every bin should be the sum of its constituent days.
    const total = out.values.reduce((a, b) => a + b, 0);
    expect(total).toBe(30 * 5000);
  });

  it('90d returns 13 weekly aggregates', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days: ActivityDay[] = [];
    for (let i = 0; i < 90; i++) {
      days.push(makeAt(nowSec - i * SECONDS_PER_DAY, 3000));
    }
    const out = buildChartSeries([], days, dailyGoal, '90d', nowSec);
    expect(out.values).toHaveLength(13);
    expect(out.values.reduce((a, b) => a + b, 0)).toBe(90 * 3000);
  });

  it('zero-fills missing days for 7d', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    // Only today + 3 days ago — others are gaps.
    const days = [
      makeAt(nowSec, 9000),
      makeAt(nowSec - 3 * SECONDS_PER_DAY, 4000),
    ];
    const out = buildChartSeries([], days, dailyGoal, '7d', nowSec);
    expect(out.values).toHaveLength(7);
    expect(out.values[6]).toBe(9000); // today
    expect(out.values[3]).toBe(4000); // 3d ago
    expect(out.values[5]).toBe(0);
    expect(out.values[4]).toBe(0);
  });
});

describe('ActivityDetail helpers — buildRangedDays', () => {
  function makeAt(unixSec: number, totalSteps: number): ActivityDay {
    return {
      dayLocal: new Date(unixSec * 1000).toISOString().slice(0, 10),
      measuredAtSec: unixSec,
      totalSteps,
      targetSteps: 8000,
      lastSampleAtSec: unixSec,
      hourly: new Array(24).fill(0),
    };
  }

  it('returns days within the range, newest first, no hard cap', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days = [0, 1, 5, 10, 25].map((i) =>
      makeAt(nowSec - i * SECONDS_PER_DAY, 1000 * (i + 1)),
    );
    const out = buildRangedDays([], days, '30d', nowSec);
    // All 5 fall within 30 days; newest first.
    expect(out).toHaveLength(5);
    expect(out[0].dayLocal).toBe(new Date(nowSec * 1000).toISOString().slice(0, 10));
    expect(out[4].dayLocal).toBe(
      new Date((nowSec - 25 * SECONDS_PER_DAY) * 1000).toISOString().slice(0, 10),
    );
  });

  it('excludes days outside the range', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days = [
      makeAt(nowSec, 1000),
      makeAt(nowSec - 60 * SECONDS_PER_DAY, 5000),
    ];
    const out = buildRangedDays([], days, '7d', nowSec);
    expect(out).toHaveLength(1);
    expect(out[0].totalSteps).toBe(1000);
  });

  it('dedups pending vs recent (pending wins)', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const today = makeAt(nowSec, 9999);
    const todayDup = makeAt(nowSec, 1234);
    const out = buildRangedDays([today], [todayDup], '7d', nowSec);
    expect(out).toHaveLength(1);
    expect(out[0].totalSteps).toBe(9999);
  });
});

describe('ActivityDetail helpers — buildRecentReadings (no hard cap)', () => {
  function makeAt(unixSec: number, totalSteps: number): ActivityDay {
    return {
      dayLocal: new Date(unixSec * 1000).toISOString().slice(0, 10),
      measuredAtSec: unixSec,
      totalSteps,
      targetSteps: 8000,
      lastSampleAtSec: unixSec,
      hourly: new Array(24).fill(0),
    };
  }

  it('returns today + every non-zero day in range (was capped at 3 prior days)', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    // 15 prior non-zero days — pre-16.5e only 3 would surface.
    const days: ActivityDay[] = [];
    for (let i = 1; i <= 15; i++) {
      days.push(makeAt(nowSec - i * SECONDS_PER_DAY, 5000));
    }
    const rows = buildRecentReadings(7200, days, 8000);
    // Today + 15 prior = 16 rows. (vs. pre-fix maximum of 4)
    expect(rows).toHaveLength(16);
    expect(rows[0].id).toBe('today');
  });

  it('skips zero-step days', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const days = [
      makeAt(nowSec - SECONDS_PER_DAY, 5000),
      makeAt(nowSec - 2 * SECONDS_PER_DAY, 0),
      makeAt(nowSec - 3 * SECONDS_PER_DAY, 6000),
    ];
    const rows = buildRecentReadings(7200, days, 8000);
    expect(rows).toHaveLength(3); // today + 2 non-zero days
  });
});

describe('ActivityDetail helpers — computeStreakFromToday', () => {
  function makeAt(unixSec: number, totalSteps: number): ActivityDay {
    return {
      dayLocal: new Date(unixSec * 1000).toISOString().slice(0, 10),
      measuredAtSec: unixSec,
      totalSteps,
      targetSteps: 8000,
      lastSampleAtSec: unixSec,
      hourly: new Array(24).fill(0),
    };
  }

  it('counts consecutive met-goal days from today backwards', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days = [
      makeAt(nowSec, 9000),
      makeAt(nowSec - SECONDS_PER_DAY, 8500),
      makeAt(nowSec - 2 * SECONDS_PER_DAY, 8200),
      makeAt(nowSec - 3 * SECONDS_PER_DAY, 5000), // breaks streak
      makeAt(nowSec - 4 * SECONDS_PER_DAY, 9000),
    ];
    expect(computeStreakFromToday(days, 8000, nowSec)).toBe(3);
  });

  it('returns 0 if today missed the goal', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days = [makeAt(nowSec, 5000), makeAt(nowSec - SECONDS_PER_DAY, 9000)];
    expect(computeStreakFromToday(days, 8000, nowSec)).toBe(0);
  });

  it('returns 0 on empty input', () => {
    expect(computeStreakFromToday([], 8000)).toBe(0);
  });

  it('stops at a gap (missing day)', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const days = [
      makeAt(nowSec, 9000),
      // skip yesterday
      makeAt(nowSec - 2 * SECONDS_PER_DAY, 9000),
    ];
    expect(computeStreakFromToday(days, 8000, nowSec)).toBe(1);
  });
});

describe('ActivityDetail helpers — labels', () => {
  it('rangeShortLabel covers all ranges', () => {
    expect(rangeShortLabel('7d')).toBe('week');
    expect(rangeShortLabel('30d')).toBe('month');
    expect(rangeShortLabel('90d')).toBe('90 days');
  });

  it('chartTitle covers all ranges', () => {
    expect(chartTitle('7d')).toBe('This week vs goal');
    expect(chartTitle('30d')).toBe('Last 30 days · weekly');
    expect(chartTitle('90d')).toBe('Last 90 days · weekly');
  });
});

describe('ActivityDetail — snapshot', () => {
  it('matches snapshot in dark mode (populated)', () => {
    mockPendingSteps = [makeDay(0, 6250)];
    mockRecentSteps = [
      makeDay(1, 8000),
      makeDay(2, 7100),
      makeDay(3, 5400),
      makeDay(4, 9000),
      makeDay(5, 6500),
      makeDay(6, 4200),
    ];
    setMockData({ ...emptySnapshot(), activityToday: mockPendingSteps[0] });
    const { toJSON } = render(
      withProviders(<ActivityDetail onBack={() => undefined} />),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
