// ActivityDetail — Sprint 8.5.
//
// Mocks the data hooks at the boundary so this stays a screen test, not
// a data test.

import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { ActivityDetail } from '../ActivityDetail';
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
