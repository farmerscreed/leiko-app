// SleepDetail tests — Sprint 8.5.
//
// Mocks data hooks at the boundary so this stays a screen test, not a
// data test. Mirrors the pattern from screens/__tests__/SelfBuyerHome.test.tsx.

import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { SleepDetail } from '../SleepDetail';
import {
  composeDailyPulseData,
  type DailyPulseSnapshot,
  type DailyPulseData,
} from '../../../state/dailyPulse';
import type { SleepSession } from '../../../types/vitals';

const NOW_SEC = () => Math.floor(Date.now() / 1000);

let mockData: DailyPulseData = composeDailyPulseData(
  {
    bpLatest: null,
    hrRestingToday: null,
    hrRestingRecent: [],
    hrLatestSampleAt: null,
    spo2LatestPercent: null,
    spo2OvernightLowsRecent: [],
    spo2LatestSampleAt: null,
    sleepSession: null,
    activityToday: null,
  },
  NOW_SEC(),
);

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

let mockSleepRecent: SleepSession[] = [];
let mockSleepPending: SleepSession[] = [];
jest.mock('../../../state/sleep', () => ({
  useSleep: (selector?: (s: unknown) => unknown) => {
    const state = { recent: mockSleepRecent, pending: mockSleepPending };
    return selector ? selector(state) : state;
  },
}));
(jest.requireMock('../../../state/sleep') as { useSleep: { getState: () => unknown } }).useSleep.getState = () => ({
  recent: mockSleepRecent,
  pending: mockSleepPending,
});

jest.mock('../../../state/readings', () => ({
  useReadings: (selector?: (s: unknown) => unknown) => {
    const state = { recent: [], pending: [] };
    return selector ? selector(state) : state;
  },
}));
(jest.requireMock('../../../state/readings') as { useReadings: { getState: () => unknown } }).useReadings.getState = () => ({
  recent: [],
  pending: [],
});

function withProviders(ui: ReactNode, colorMode: 'dark' | 'light' = 'dark') {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 720 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver" colorMode={colorMode}>
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function makeSleep({
  endSec = NOW_SEC() - 4 * 3600,
  totalMinutes = 7 * 60 + 42,
  deepMinutes = 98,
  remMinutes = 114,
  lightMinutes,
  awakeMinutes = 18,
  sleepScore = 78,
}: Partial<{
  endSec: number;
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  sleepScore: number;
}> = {}): SleepSession {
  const startSec = endSec - totalMinutes * 60;
  const computedLight =
    lightMinutes ?? Math.max(0, totalMinutes - deepMinutes - remMinutes - awakeMinutes);
  return {
    sessionStartSec: startSec,
    sessionEndSec: endSec,
    sessionStartLocal: new Date(startSec * 1000).toISOString(),
    sessionEndLocal: new Date(endSec * 1000).toISOString(),
    totalMinutes,
    deepMinutes,
    remMinutes,
    lightMinutes: computedLight,
    awakeMinutes,
    awakeCount: 2,
    transitions: [],
    sleepScore,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSleepRecent = [];
  mockSleepPending = [];
});

describe('SleepDetail — hero', () => {
  it('renders the formatted total + bedtime sub when a session exists', () => {
    const session = makeSleep({ totalMinutes: 7 * 60 + 42 });
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: session,
      activityToday: null,
    });
    mockSleepRecent = [session];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    // "7:42" should render in the hero (and possibly the recent-list row).
    expect(screen.getAllByText('7:42').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('hrs')).toBeTruthy();
  });

  it('renders calmer range copy for high sleep score', () => {
    const session = makeSleep({ sleepScore: 85 });
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: session,
      activityToday: null,
    });
    mockSleepRecent = [session];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    expect(screen.getByText('A quieter night than last week')).toBeTruthy();
  });

  it('renders the "more restless" range copy for low sleep score', () => {
    const session = makeSleep({ sleepScore: 40 });
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: session,
      activityToday: null,
    });
    mockSleepRecent = [session];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    expect(screen.getByText('A more restless night than your usual')).toBeTruthy();
  });
});

describe('SleepDetail — empty state', () => {
  it('renders the empty hero copy and the welcome insight body', () => {
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    mockSleepRecent = [];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('No sleep recorded last night')).toBeTruthy();
    // No hypnogram in the empty state
    expect(screen.queryByTestId('sleep-detail-hypnogram')).toBeNull();
    // No recent-readings list either
    expect(screen.queryByTestId('sleep-detail-recent')).toBeNull();
    // The insight card is still present
    expect(screen.getByTestId('sleep-detail-insight')).toBeTruthy();
  });
});

describe('SleepDetail — hypnogram + recent', () => {
  it('renders the hypnogram when a session is present', () => {
    const session = makeSleep();
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: session,
      activityToday: null,
    });
    mockSleepRecent = [session];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    expect(screen.getByTestId('sleep-detail-hypnogram')).toBeTruthy();
    // Eyebrow renamed when SleepDetail moved to RecentReadingsSection
    // (on-device review 2026-05-08): "Last seven nights" → "Recent nights".
    expect(screen.getByText('Recent nights')).toBeTruthy();
  });
});

describe('SleepDetail — snapshot', () => {
  it('matches the dark-mode snapshot with a session', () => {
    const session = makeSleep({
      endSec: 1_715_212_800, // fixed instant for deterministic snapshot
      totalMinutes: 7 * 60 + 42,
      deepMinutes: 98,
      remMinutes: 114,
      sleepScore: 78,
    });
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: session,
      activityToday: null,
    });
    mockSleepRecent = [session];
    const { toJSON } = render(
      withProviders(<SleepDetail onBack={() => undefined} />, 'dark'),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
