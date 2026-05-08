// BPDetail — Sprint 8.5 integration tests.
//
// Mocks `useDailyPulseData` + `useReadings` at the module boundary so
// these stay screen-level tests, not data-store tests. Mirrors the
// pattern in SelfBuyerHome.test.tsx.

import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { BPDetail } from '../BPDetail';
import {
  composeDailyPulseData,
  type DailyPulseData,
  type DailyPulseSnapshot,
} from '../../../state/dailyPulse';
import type { LocalReading } from '../../../state/readings';

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

let mockRecent: LocalReading[] = [];
let mockPending: LocalReading[] = [];

function setMockData(snapshot: DailyPulseSnapshot) {
  mockData = composeDailyPulseData(snapshot, NOW_SEC());
}

jest.mock('../../../state/dailyPulse', () => {
  const actual = jest.requireActual('../../../state/dailyPulse');
  return {
    ...actual,
    useDailyPulseData: () => mockData,
  };
});

jest.mock('../../../state/readings', () => ({
  useReadings: (selector?: (s: unknown) => unknown) => {
    const state = { recent: mockRecent, pending: mockPending };
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

function makeBp(
  measuredAtSec: number,
  sys = 122,
  dia = 78,
  tier: 'in_pattern' | 'calm_concerned' | 'confirmed_urgent' = 'in_pattern',
  localId = `bp-${measuredAtSec}`,
): LocalReading {
  return {
    localId,
    serverId: null,
    measuredAtSec,
    systolic: sys,
    diastolic: dia,
    pulse: 64,
    source: 'watch',
    classification: { tier, reason: 'within_baseline' },
    deviceBleId: null,
    capturedAtMs: measuredAtSec * 1000,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecent = [];
  mockPending = [];
});

describe('BPDetail — populated states', () => {
  it('renders 122/78 + within-your-range copy when BP classifies in_pattern', () => {
    const reading = makeBp(NOW_SEC() - 60 * 60, 122, 78, 'in_pattern');
    mockRecent = [reading];
    setMockData({
      bpLatest: reading,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    render(withProviders(<BPDetail onBack={() => undefined} />));
    expect(screen.getByText('122')).toBeTruthy();
    expect(screen.getByText('/ 78')).toBeTruthy();
    expect(screen.getByText('mmHg · within your range')).toBeTruthy();
    expect(screen.getByTestId('bp-detail-chart')).toBeTruthy();
    expect(screen.getByTestId('bp-detail-readings')).toBeTruthy();
  });

  it('renders worth-a-look copy when tier is calm_concerned', () => {
    const reading = makeBp(NOW_SEC() - 30 * 60, 142, 92, 'calm_concerned');
    mockRecent = [reading];
    setMockData({
      bpLatest: reading,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    render(withProviders(<BPDetail onBack={() => undefined} />));
    expect(screen.getByText('mmHg · worth a look')).toBeTruthy();
  });

  it('renders talk-to-your-doctor copy when tier is confirmed_urgent', () => {
    const reading = makeBp(NOW_SEC() - 30 * 60, 188, 122, 'confirmed_urgent');
    mockRecent = [reading];
    setMockData({
      bpLatest: reading,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    render(withProviders(<BPDetail onBack={() => undefined} />));
    expect(screen.getByText('mmHg · talk to your doctor today')).toBeTruthy();
  });
});

describe('BPDetail — empty state', () => {
  it('renders the no-readings placeholder when there is no BP data', () => {
    mockRecent = [];
    mockPending = [];
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
    render(withProviders(<BPDetail onBack={() => undefined} />));
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('No readings yet')).toBeTruthy();
    expect(
      screen.getByText("Take your first reading whenever you're ready."),
    ).toBeTruthy();
    // Chart + readings list omitted in empty state
    expect(screen.queryByTestId('bp-detail-chart')).toBeNull();
    expect(screen.queryByTestId('bp-detail-readings')).toBeNull();
  });
});

describe('BPDetail — interactions', () => {
  it('fires onSelectReading with the localId when a recent row is tapped', () => {
    const onSelectReading = jest.fn();
    const r1 = makeBp(NOW_SEC() - 60 * 60, 122, 78, 'in_pattern', 'bp-aaa');
    const r2 = makeBp(NOW_SEC() - 25 * 3600, 124, 79, 'in_pattern', 'bp-bbb');
    mockRecent = [r1, r2];
    setMockData({
      bpLatest: r1,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    render(
      withProviders(
        <BPDetail onBack={() => undefined} onSelectReading={onSelectReading} />,
      ),
    );
    // testID nests through RecentReadingsSection → RecentReadingsList:
    // `${section}-list-row-${id}`.
    fireEvent.press(screen.getByTestId('bp-detail-readings-list-row-bp-aaa'));
    expect(onSelectReading).toHaveBeenCalledWith('bp-aaa');
  });

  it('fires onBack when the back chevron is tapped', () => {
    const onBack = jest.fn();
    const r1 = makeBp(NOW_SEC() - 60 * 60, 122, 78, 'in_pattern');
    mockRecent = [r1];
    setMockData({
      bpLatest: r1,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    render(withProviders(<BPDetail onBack={onBack} />));
    fireEvent.press(screen.getByTestId('bp-detail-header-back'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('BPDetail — snapshot', () => {
  // Pin the wall clock so the rendered "Today, X:XX PM" timestamp string
  // is deterministic across runs. Without this the snapshot drifts every
  // few minutes as the test machine's clock advances.
  const FROZEN = new Date('2026-05-08T16:30:00Z').getTime();
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(FROZEN);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('matches snapshot in dark mode with a populated reading', () => {
    const r1 = makeBp(NOW_SEC() - 60 * 60, 122, 78, 'in_pattern', 'bp-snap');
    mockRecent = [r1];
    setMockData({
      bpLatest: r1,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null,
      activityToday: null,
    });
    const { toJSON } = render(
      withProviders(<BPDetail onBack={() => undefined} />, 'dark'),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
