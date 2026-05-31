// HRDetail — Sprint 8.5 screen tests.
//
// Mocks the data hooks at the boundary so this stays a screen test, not
// a data test. The pure helpers (buildTodayTrendData / buildZones /
// buildStats / buildSleepHRCorrelation) could be unit-tested separately;
// here we exercise the screen-level wiring across has-data and empty-
// state paths.

import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { HRDetail } from '../HRDetail';
import {
  composeDailyPulseData,
  type DailyPulseData,
  type DailyPulseSnapshot,
} from '../../../state/dailyPulse';
import type { HRSample, SleepSession } from '../../../types/vitals';

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

let mockHRRecent: HRSample[] = [];
let mockHRPending: HRSample[] = [];
let mockHRRestingRecent: number[] = [];
let mockSleepRecent: SleepSession[] = [];
let mockSleepPending: SleepSession[] = [];

jest.mock('../../../state/dailyPulse', () => {
  const actual = jest.requireActual('../../../state/dailyPulse');
  return {
    ...actual,
    useDailyPulseData: () => mockData,
  };
});

jest.mock('../../../state/hr', () => ({
  useHR: (selector?: (s: unknown) => unknown) => {
    const state = { recent: mockHRRecent, pending: mockHRPending };
    return selector ? selector(state) : state;
  },
}));
(jest.requireMock('../../../state/hr') as {
  useHR: { getState: () => unknown };
}).useHR.getState = () => ({
  recent: mockHRRecent,
  pending: mockHRPending,
  restingBpmRecent: () => mockHRRestingRecent,
});

jest.mock('../../../state/sleep', () => ({
  useSleep: (selector?: (s: unknown) => unknown) => {
    const state = { recent: mockSleepRecent, pending: mockSleepPending };
    return selector ? selector(state) : state;
  },
}));

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

function makeHRSample(measuredAtSec: number, bpm: number): HRSample {
  return {
    measuredAtSec,
    bpm,
    sampleWindowSec: 30,
    motionState: 'rest',
    isSpotCheck: false,
  };
}

function makeSleep(endSec: number, totalMinutes = 7 * 60): SleepSession {
  const startSec = endSec - totalMinutes * 60;
  return {
    sessionStartSec: startSec,
    sessionEndSec: endSec,
    sessionStartLocal: new Date(startSec * 1000).toISOString(),
    sessionEndLocal: new Date(endSec * 1000).toISOString(),
    totalMinutes,
    deepMinutes: 90,
    remMinutes: 80,
    lightMinutes: totalMinutes - 90 - 80 - 4,
    awakeMinutes: 4,
    awakeCount: 1,
    transitions: [],
    sleepScore: 78,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHRRecent = [];
  mockHRPending = [];
  mockHRRestingRecent = [];
  mockSleepRecent = [];
  mockSleepPending = [];
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
});

describe('HRDetail — has-data path', () => {
  beforeEach(() => {
    const now = NOW_SEC();
    setMockData({
      bpLatest: null,
      hrRestingToday: 64,
      hrRestingRecent: [62, 63, 64, 62, 63],
      hrLatestSampleAt: now - 60 * 60,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    // Distribute samples through the last 24h with a peak of 142.
    mockHRRecent = [
      makeHRSample(now - 23 * 3600, 56),
      makeHRSample(now - 20 * 3600, 58),
      makeHRSample(now - 16 * 3600, 64),
      makeHRSample(now - 12 * 3600, 78),
      makeHRSample(now - 10 * 3600, 142),
      makeHRSample(now - 8 * 3600, 88),
      makeHRSample(now - 6 * 3600, 70),
      makeHRSample(now - 4 * 3600, 64),
      makeHRSample(now - 2 * 3600, 60),
      makeHRSample(now - 1 * 3600, 64),
    ];
    mockHRRestingRecent = [62, 63, 64, 62, 63];
  });

  it('renders the resting HR primary value in the hero', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByTestId('hr-detail-hero-primary').props.children).toBe('64');
  });

  it('renders the "Now · resting" hero sub-label', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByText('Now · resting')).toBeTruthy();
  });

  it('renders the StatTrio with three label/value pairs', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    // "Resting" appears twice (StatTrio label + HRZones row); accept that.
    expect(screen.getAllByText('Resting').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Peak')).toBeTruthy();
    expect(screen.getByText('Variability')).toBeTruthy();
    // Resting average rounds to 63 from [62,63,64,62,63].
    expect(screen.getByText('63')).toBeTruthy();
    // Peak of 142 from the 24h window.
    expect(screen.getByText('142')).toBeTruthy();
  });

  it('renders the trend chart when there is HR data', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByTestId('hr-detail-trend')).toBeTruthy();
  });

  it('renders the HR zones card with all four zone names', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByTestId('hr-detail-zones')).toBeTruthy();
    // "Resting" appears in StatTrio + HRZonesCard; the unique zones-only
    // names confirm the zones card itself is rendering.
    expect(screen.getByText('Calm')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Vigorous')).toBeTruthy();
  });

  it('renders the insight card with the has-data body', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(
      screen.getByText(/resting heart rate has settled three points lower/i),
    ).toBeTruthy();
  });

  it('hides the correlation strip when sleep history is missing', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.queryByTestId('hr-detail-correlation')).toBeNull();
  });

  it('renders the correlation strip when both HR + sleep have history', () => {
    const now = NOW_SEC();
    mockSleepRecent = [
      makeSleep(now - 6 * 24 * 3600, 7 * 60),
      makeSleep(now - 5 * 24 * 3600, 6 * 60 + 40),
      makeSleep(now - 4 * 24 * 3600, 7 * 60 + 30),
      makeSleep(now - 3 * 24 * 3600, 7 * 60),
      makeSleep(now - 2 * 24 * 3600, 6 * 60 + 50),
    ];
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByTestId('hr-detail-correlation')).toBeTruthy();
  });
});

describe('HRDetail — empty state', () => {
  it('renders an em-dash hero value when no resting HR is available', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByTestId('hr-detail-hero-primary').props.children).toBe('—');
  });

  it('renders the welcome onboarding line when there is no data', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(
      screen.getByText('Wear the watch to start tracking your heart rate.'),
    ).toBeTruthy();
  });

  it('skips the trend chart when there is no HR data', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.queryByTestId('hr-detail-trend')).toBeNull();
  });

  it('skips the zones card when there is no HR data', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.queryByTestId('hr-detail-zones')).toBeNull();
  });

  it('still renders the insight card with the welcome body', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    // Welcome copy appears in both the hero range line and the insight
    // card body; either surfacing is acceptable for the empty path.
    expect(screen.getAllByText(/Wear the watch to start tracking/i).length)
      .toBeGreaterThanOrEqual(1);
    // The insight-card-specific phrasing distinguishes it.
    expect(
      screen.getByText(/After a few nights of sleep/i),
    ).toBeTruthy();
  });
});

describe('HRDetail — latest-sample fallback (no resting HR)', () => {
  beforeEach(() => {
    const now = NOW_SEC();
    // No resting HR today and no recent resting nights, but a fresh
    // daytime sample exists — the hero should show it rather than blank.
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: now - 30 * 60,
      hrLatestBpm: 84,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
  });

  it('shows the latest bpm in the hero instead of an em-dash', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByTestId('hr-detail-hero-primary').props.children).toBe('84');
  });

  it('labels the hero as a latest reading, not resting', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByText('Latest reading')).toBeTruthy();
    expect(screen.queryByText('Now · resting')).toBeNull();
  });

  it('keeps the pre-baseline insight body (no resting comparison)', () => {
    render(withProviders(<HRDetail onBack={() => undefined} />));
    expect(screen.getByText(/After a few nights of sleep/i)).toBeTruthy();
  });
});

describe('HRDetail — back button wiring', () => {
  it('routes back-button taps via the embedded DetailHeader', () => {
    const onBack = jest.fn();
    render(withProviders(<HRDetail onBack={onBack} />));
    const back = screen.getByTestId('hr-detail-header-back');
    expect(back).toBeTruthy();
    // SelfBuyerHome.test uses fireEvent.press; we keep parity here.
    const { fireEvent } = jest.requireActual(
      '@testing-library/react-native',
    ) as typeof import('@testing-library/react-native');
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('HRDetail — dark-mode snapshot', () => {
  it('matches snapshot with full data in dark mode', () => {
    const now = NOW_SEC();
    setMockData({
      bpLatest: null,
      hrRestingToday: 64,
      hrRestingRecent: [62, 63, 64, 62, 63],
      hrLatestSampleAt: now - 60 * 60,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    mockHRRecent = [
      makeHRSample(now - 12 * 3600, 78),
      makeHRSample(now - 6 * 3600, 70),
      makeHRSample(now - 1 * 3600, 64),
    ];
    mockHRRestingRecent = [62, 63, 64];
    const { toJSON } = render(
      withProviders(<HRDetail onBack={() => undefined} />, 'dark'),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
