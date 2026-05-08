// SpO2Detail — Sprint 8.5 integration tests.
//
// Mocks the data hooks at the boundary so this stays a screen test, not a
// data test. Verifies:
//   - Hero renders the latest percent + the correct tier-based range copy
//     for each of the three classification tiers.
//   - Empty state renders when latestPercent is null (no chart, welcome
//     helper, calm insight body).
//   - Insight card body changes per tier.
//   - Snapshot in dark mode (full surface + populated state).
//   - Voice gate: rendered text never contains the SpO2-forbidden words
//     (dangerous, critical, diagnose, abnormal, predict, prevent, silent
//     killer, medical-grade, clinical SpO2, loved one, you may have, we
//     detected, patient).

import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { SpO2Detail } from '../SpO2Detail';
import {
  composeDailyPulseData,
  type DailyPulseSnapshot,
  type DailyPulseData,
} from '../../../state/dailyPulse';
import type { SpO2Sample } from '../../../types/vitals';

// Real-clock-relative timestamps so the screen's freshness windows always
// see data as current, mirroring SelfBuyerHome.test.tsx.
const NOW_SEC = () => Math.floor(Date.now() / 1000);

const mockOnBack = jest.fn();

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

let mockSpO2Samples: SpO2Sample[] = [];

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

jest.mock('../../../state/spo2', () => ({
  useSpO2: (selector?: (s: unknown) => unknown) => {
    const state = { pending: [], recent: mockSpO2Samples };
    return selector ? selector(state) : state;
  },
}));

function withProviders(ui: ReactNode, colorMode: 'light' | 'dark' = 'dark') {
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

function makeSample(measuredAtSec: number, percent: number): SpO2Sample {
  return {
    measuredAtSec,
    percent,
    maxInWindow: percent,
    minInWindow: percent,
    sampleWindowSec: 60,
    isSpotCheck: false,
    perfusionIndex: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSpO2Samples = [];
});

describe('SpO2Detail — hero + tier copy', () => {
  it('renders latestPercent with in_pattern hero copy', () => {
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: 98,
      // in_pattern: latest >= 95 AND last overnight low >= 90 (here 96).
      spo2OvernightLowsRecent: [97, 96, 96],
      spo2LatestSampleAt: NOW_SEC() - 60 * 60,
      sleepSession: null,
      activityToday: null,
    });
    render(withProviders(<SpO2Detail onBack={mockOnBack} />));
    expect(screen.getByTestId('spo2-detail-hero-primary').props.children).toBe(
      '98',
    );
    expect(screen.getByText('Steady through the night')).toBeTruthy();
  });

  it('renders calm_concerned hero + insight when latest is in 90–94 borderline', () => {
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: 92,
      spo2OvernightLowsRecent: [94, 93, 92],
      spo2LatestSampleAt: NOW_SEC() - 60 * 60,
      sleepSession: null,
      activityToday: null,
    });
    render(withProviders(<SpO2Detail onBack={mockOnBack} />));
    expect(screen.getByTestId('spo2-detail-hero-primary').props.children).toBe(
      '92',
    );
    expect(
      screen.getByText(
        'Worth a look — share with your doctor at your next visit',
      ),
    ).toBeTruthy();
    // Calm-concerned insight names the pattern + the next visit, never
    // panicky words.
    expect(
      screen.getByText(
        'Your overnight oxygen has held below 92% on a few recent nights. Worth mentioning at your next doctor visit.',
      ),
    ).toBeTruthy();
  });

  it('renders confirmed_urgent hero + insight when overnight lows < 88 sustained 3+ nights', () => {
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: 96,
      spo2OvernightLowsRecent: [87, 86, 85],
      spo2LatestSampleAt: NOW_SEC() - 60 * 60,
      sleepSession: null,
      activityToday: null,
    });
    render(withProviders(<SpO2Detail onBack={mockOnBack} />));
    expect(
      screen.getByText('We recommend talking to your doctor soon'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Your overnight oxygen has held below 90 on a few recent nights — worth mentioning at your next doctor visit.',
      ),
    ).toBeTruthy();
  });
});

describe('SpO2Detail — empty state', () => {
  it('shows the welcome empty state when latestPercent is null', () => {
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
    render(withProviders(<SpO2Detail onBack={mockOnBack} />));

    // Hero renders the dash + the empty sub-label.
    expect(screen.getByTestId('spo2-detail-hero-primary').props.children).toBe(
      '—',
    );
    expect(screen.getByText('No oxygen samples yet')).toBeTruthy();
    expect(screen.getByText('No oxygen samples yet today')).toBeTruthy();
    expect(
      screen.getByText('Wear the watch overnight to start tracking your oxygen.'),
    ).toBeTruthy();

    // Chart + readings list omitted in empty state.
    expect(screen.queryByTestId('spo2-detail-chart')).toBeNull();
    expect(screen.queryByTestId('spo2-detail-readings')).toBeNull();
    expect(screen.queryByTestId('spo2-detail-trio')).toBeNull();

    // Insight card still renders with calm welcome body.
    expect(screen.getByTestId('spo2-detail-insight')).toBeTruthy();
  });
});

describe('SpO2Detail — populated surface', () => {
  beforeEach(() => {
    const baseSec = NOW_SEC() - 4 * 3600;
    mockSpO2Samples = [
      makeSample(baseSec - 6 * 3600, 96),
      makeSample(baseSec - 5 * 3600, 95),
      makeSample(baseSec - 4 * 3600, 94),
      makeSample(baseSec - 3 * 3600, 96),
      makeSample(baseSec - 2 * 3600, 97),
      makeSample(baseSec - 1 * 3600, 98),
    ];
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: 98,
      spo2OvernightLowsRecent: [97, 96, 96],
      spo2LatestSampleAt: NOW_SEC() - 60 * 60,
      sleepSession: null,
      activityToday: null,
    });
  });

  it('renders chart, stat trio, insight card, and readings list', () => {
    render(withProviders(<SpO2Detail onBack={mockOnBack} />));
    expect(screen.getByTestId('spo2-detail-chart')).toBeTruthy();
    expect(screen.getByTestId('spo2-detail-trio')).toBeTruthy();
    expect(screen.getByTestId('spo2-detail-insight')).toBeTruthy();
    expect(screen.getByTestId('spo2-detail-readings')).toBeTruthy();
    expect(screen.getByText('Recent readings')).toBeTruthy();
    expect(screen.getByText('Overnight · oxygen')).toBeTruthy();
    expect(screen.getByText('95–100 band')).toBeTruthy();
  });

  it('matches the dark-mode snapshot for an in_pattern surface', () => {
    // Pin the wall clock so any "now"-relative copy in the rendered tree
    // is deterministic across runs. The fake timer is installed BEFORE
    // we rebuild the sample data so the sample timestamps + the rendered
    // "Just now" / clock strings all derive from the same frozen instant.
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-05-08T16:30:00Z').getTime());
    try {
      const baseSec = NOW_SEC() - 4 * 3600;
      mockSpO2Samples = [
        makeSample(baseSec - 6 * 3600, 96),
        makeSample(baseSec - 5 * 3600, 95),
        makeSample(baseSec - 4 * 3600, 94),
        makeSample(baseSec - 3 * 3600, 96),
        makeSample(baseSec - 2 * 3600, 97),
        makeSample(baseSec - 1 * 3600, 98),
      ];
      setMockData({
        bpLatest: null,
        hrRestingToday: null,
        hrRestingRecent: [],
        hrLatestSampleAt: null,
        spo2LatestPercent: 98,
        spo2OvernightLowsRecent: [97, 96, 96],
        spo2LatestSampleAt: NOW_SEC() - 60 * 60,
        sleepSession: null,
        activityToday: null,
      });
      const tree = render(
        withProviders(<SpO2Detail onBack={mockOnBack} />, 'dark'),
      ).toJSON();
      expect(tree).toMatchSnapshot();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('SpO2Detail — voice gate', () => {
  // SpO2 has the strictest voice bar of any vital. Any of these strings
  // appearing in rendered copy is an immediate fail.
  const FORBIDDEN = [
    'patient',
    'patients',
    'diagnose',
    'diagnosis',
    'diagnostic',
    'predict',
    'prevent',
    'dangerous',
    'critical',
    'silent killer',
    'medical-grade',
    'clinical SpO2',
    'loved one',
    'you may have',
    'we detected',
    'abnormal',
  ];

  function renderedTextFor(snapshot: DailyPulseSnapshot): string {
    setMockData(snapshot);
    const { toJSON } = render(
      withProviders(<SpO2Detail onBack={mockOnBack} />),
    );
    return JSON.stringify(toJSON());
  }

  it('does not contain forbidden words in the in_pattern surface', () => {
    const text = renderedTextFor({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: 98,
      spo2OvernightLowsRecent: [97, 96, 96],
      spo2LatestSampleAt: NOW_SEC() - 60 * 60,
      sleepSession: null,
      activityToday: null,
    });
    for (const word of FORBIDDEN) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('does not contain forbidden words in the calm_concerned surface', () => {
    const text = renderedTextFor({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: 92,
      spo2OvernightLowsRecent: [94, 93, 92],
      spo2LatestSampleAt: NOW_SEC() - 60 * 60,
      sleepSession: null,
      activityToday: null,
    });
    for (const word of FORBIDDEN) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('does not contain forbidden words in the confirmed_urgent surface', () => {
    const text = renderedTextFor({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: 96,
      spo2OvernightLowsRecent: [87, 86, 85],
      spo2LatestSampleAt: NOW_SEC() - 60 * 60,
      sleepSession: null,
      activityToday: null,
    });
    for (const word of FORBIDDEN) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('does not contain forbidden words in the empty state', () => {
    const text = renderedTextFor({
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
    for (const word of FORBIDDEN) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});
