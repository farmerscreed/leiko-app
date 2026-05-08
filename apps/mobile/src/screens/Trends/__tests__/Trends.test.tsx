// Trends — Sprint 9 integration tests.
//
// Mocks the hooks that the screen depends on at the module boundary
// so these stay screen-level integration tests (not data-store tests).
// Pattern mirrors BPDetail.test.tsx — mocks per-hook, swap data per
// test via let-binding the mock state.

import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { Trends } from '../Trends';
import type { TrendsData } from '../../../utils/trends-aggregate';
import type {
  CorrelationRow,
  AccountType,
  UserRow,
} from '../../../types/database';

// ── Mock state — mutated per test ───────────────────────────────────

let mockTrendsData: TrendsData | undefined = emptyTrends();
let mockTrendsLoading = false;
let mockTrendsError: Error | null = null;
let mockCorrelations: CorrelationRow[] = [];
let mockIsPlus = false;
let mockAccountType: AccountType = 'self_buyer';
let mockFamilyId: string | null = 'family-1';

function emptyTrends(): TrendsData {
  return {
    series: { bp: [], hr: [], spo2: [], sleep: [], activity: [] },
    summary: {
      bp: { count: 0, avgSys: null, avgDia: null, pctInRange: null },
      hr: { count: 0, avgResting: null },
      spo2: { count: 0, avgMinPercent: null },
      sleep: { count: 0, avgTotalMinutes: null },
      activity: { count: 0, avgSteps: null },
    },
  };
}

function trendsWithData(): TrendsData {
  const days = ['2025-04-08', '2025-04-09', '2025-04-10'];
  return {
    series: {
      bp: days.map((day, i) => ({
        day,
        sys: 122 + i,
        dia: 80 + i,
        pulse: 70,
        count: 1,
      })),
      hr: days.map((day, i) => ({
        day,
        restingBpm: 60 + i,
        count: 5,
      })),
      spo2: days.map((day) => ({
        day,
        avgPercent: 96,
        minPercent: 94,
        count: 3,
      })),
      sleep: days.map((day, i) => ({
        day,
        totalMinutes: 420 + i * 10,
        deepMinutes: 100,
      })),
      activity: days.map((day, i) => ({
        day,
        totalSteps: 7000 + i * 200,
      })),
    },
    summary: {
      bp: { count: 3, avgSys: 123, avgDia: 81, pctInRange: 1 },
      hr: { count: 15, avgResting: 61 },
      spo2: { count: 9, avgMinPercent: 94 },
      sleep: { count: 3, avgTotalMinutes: 430 },
      activity: { count: 3, avgSteps: 7200 },
    },
  };
}

jest.mock('../../../hooks/useTrendsData', () => ({
  useTrendsData: () => ({
    data: mockTrendsData,
    isLoading: mockTrendsLoading,
    isRefreshing: false,
    error: mockTrendsError,
  }),
  useTrendsCorrelations: () => ({
    correlations: mockCorrelations,
    isLoading: false,
    error: null,
  }),
}));

jest.mock('../../../hooks/usePlusEntitlement', () => ({
  usePlusEntitlement: () => ({
    tier: mockIsPlus ? 'plus' : 'free',
    isPlus: mockIsPlus,
    isLoading: false,
  }),
  isPlusTier: (t: string) => t === 'plus' || t === 'plus_trial' || t === 'plus_grace',
}));

jest.mock('../../../hooks/useFamilyReadings', () => ({
  useFamilyReadings: () => ({
    parents: mockFamilyId
      ? [
          {
            familyId: mockFamilyId,
            parentDisplayName: 'Test',
            parentRelationship: 'self',
            parentYearOfBirth: 1980,
            latestReading: null,
            recentReadings: [],
            latestHr: null,
            latestSpo2: null,
            latestSleep: null,
          },
        ]
      : [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('../../../state/auth', () => ({
  useAuth: (selector?: (s: unknown) => unknown) => {
    const fakeProfile: UserRow = {
      id: 'user-1',
      email: 'fixture@leiko.test',
      display_name: 'Fixture',
      photo_url: null,
      preferred_language: 'en',
      timezone: 'Africa/Lagos',
      year_of_birth: 1980,
      account_type: mockAccountType,
      marketing_opt_in: false,
      deleted_at: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    };
    const state = {
      profile: fakeProfile,
      session: { user: { id: 'user-1' } },
    };
    return selector ? selector(state) : state;
  },
}));

// ────────────────────────────────────────────────────────────────────

function withProviders(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 720 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTrendsData = trendsWithData();
  mockTrendsLoading = false;
  mockTrendsError = null;
  mockCorrelations = [];
  mockIsPlus = false;
  mockAccountType = 'self_buyer';
  mockFamilyId = 'family-1';
});

describe('Trends — base render', () => {
  it('renders the self-buyer header copy', () => {
    render(withProviders(<Trends />));
    expect(screen.getByTestId('trends-header-title').props.children).toBe(
      'Your trends',
    );
  });

  it('switches the header for caregivers', () => {
    mockAccountType = 'caregiver';
    render(withProviders(<Trends />));
    expect(screen.getByTestId('trends-header-title').props.children).toBe(
      'Trends',
    );
  });

  it('renders all 4 range chips and all 5 vital toggle chips', () => {
    render(withProviders(<Trends />));
    for (const r of ['7d', '30d', '90d', '1y'] as const) {
      expect(screen.getByTestId(`trends-range:${r}`)).toBeTruthy();
    }
    for (const v of ['bp', 'hr', 'spo2', 'sleep', 'activity'] as const) {
      expect(screen.getByTestId(`trends-toggle:${v}`)).toBeTruthy();
    }
  });

  it('renders the multi-vital chart when data is present', () => {
    render(withProviders(<Trends />));
    expect(screen.getByTestId('trends-chart-svg')).toBeTruthy();
  });

  it('renders the weekly summary placeholder copy', () => {
    render(withProviders(<Trends />));
    expect(
      screen.getByText('Your first weekly summary will appear next Sunday.'),
    ).toBeTruthy();
  });
});

describe('Trends — paywall triggers', () => {
  it('opens the paywall sheet when a free user taps a >7d range chip', () => {
    render(withProviders(<Trends />));
    fireEvent.press(screen.getByTestId('trends-range:30d'));
    // PaywallSheet renders the self-buyer headline when visible.
    expect(screen.getByText('Understand your numbers')).toBeTruthy();
  });

  it('opens the paywall sheet when a free user taps the export CTA', () => {
    render(withProviders(<Trends />));
    fireEvent.press(screen.getByTestId('trends-export-cta'));
    expect(screen.getByText('Understand your numbers')).toBeTruthy();
  });

  it('does NOT open the paywall when a Plus user taps a >7d range chip', () => {
    mockIsPlus = true;
    render(withProviders(<Trends />));
    fireEvent.press(screen.getByTestId('trends-range:30d'));
    expect(screen.queryByText('Understand your numbers')).toBeNull();
  });

  it('uses caregiver paywall copy when account_type is caregiver', () => {
    mockAccountType = 'caregiver';
    render(withProviders(<Trends />));
    fireEvent.press(screen.getByTestId('trends-range:30d'));
    expect(screen.getByText('Stay close, every day')).toBeTruthy();
  });
});

describe('Trends — vital toggles', () => {
  it('toggles a vital live without re-fetching data', () => {
    // The mock returns the same trendsData object every render — the
    // chart's visibility flips because the chip toggles local state,
    // not because new data was fetched. Asserting that the SVG line
    // disappears proves the local-toggle path.
    render(withProviders(<Trends />));
    expect(screen.getByTestId('trends-chart-line-bp')).toBeTruthy();
    fireEvent.press(screen.getByTestId('trends-toggle:bp'));
    expect(screen.queryByTestId('trends-chart-line-bp')).toBeNull();
  });
});

describe('Trends — empty / loading / error states', () => {
  it('shows the empty-state copy when no data is present', () => {
    mockTrendsData = emptyTrends();
    render(withProviders(<Trends />));
    expect(screen.getByText('Trends will appear here next week')).toBeTruthy();
  });

  it('shows the loading indicator while the query is in flight', () => {
    mockTrendsLoading = true;
    mockTrendsData = undefined;
    render(withProviders(<Trends />));
    expect(screen.getByTestId('trends-chart-loading')).toBeTruthy();
  });

  it('shows the error state with a Try again CTA when the query fails', () => {
    mockTrendsLoading = false;
    mockTrendsError = new Error('network');
    mockTrendsData = undefined;
    render(withProviders(<Trends />));
    expect(screen.getByTestId('trends-chart-error')).toBeTruthy();
    expect(screen.getByTestId('trends-retry')).toBeTruthy();
  });
});

describe('Trends — correlation cards', () => {
  it('renders a card per meaningful correlation (capped at 3)', () => {
    mockCorrelations = [
      makeCorrelation('sleep_x_morning_bp', -0.9),
      makeCorrelation('activity_x_resting_hr', -0.5),
      makeCorrelation('spo2_dip_x_sleep_score', 0.4),
    ];
    render(withProviders(<Trends />));
    expect(
      screen.getByTestId('trends-correlation:sleep_x_morning_bp'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('trends-correlation:activity_x_resting_hr'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('trends-correlation:spo2_dip_x_sleep_score'),
    ).toBeTruthy();
  });

  it('renders nothing in the correlation slot when no meaningful rows exist', () => {
    mockCorrelations = [];
    render(withProviders(<Trends />));
    expect(screen.queryByTestId('trends-correlations')).toBeNull();
  });

  it('shows the per-card narrative + sample-size disclosure', () => {
    mockCorrelations = [makeCorrelation('sleep_x_morning_bp', -0.9)];
    render(withProviders(<Trends />));
    expect(
      screen.getByText('Poor sleep ↔ +5 mmHg morning systolic'),
    ).toBeTruthy();
    expect(screen.getByText('Over the last 30 days · n=24')).toBeTruthy();
  });
});

describe('Trends — export CTA copy by account_type', () => {
  it('reads "Save as PDF for my doctor" in self-buyer mode', () => {
    render(withProviders(<Trends />));
    expect(screen.getByText('Save as PDF for my doctor')).toBeTruthy();
  });

  it('reads "Share with your doctor" in caregiver mode', () => {
    mockAccountType = 'caregiver';
    render(withProviders(<Trends />));
    expect(screen.getByText('Share with your doctor')).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────

function makeCorrelation(
  type: CorrelationRow['correlation_type'],
  r: number,
): CorrelationRow {
  return {
    id: 'c-' + type,
    family_id: 'family-1',
    user_id: 'user-1',
    correlation_type: type,
    window_days: 30,
    computed_at: '2025-04-11T03:00:00Z',
    pearson_r: r,
    effect_size: -0.083,
    effect_unit:
      type === 'sleep_x_morning_bp'
        ? 'mmHg/hour-sleep'
        : type === 'activity_x_resting_hr'
          ? 'bpm/1000-steps'
          : 'min/SpO2-percent',
    significance: 0.001,
    sample_n: 24,
    is_meaningful: true,
    narrative_short:
      type === 'sleep_x_morning_bp'
        ? 'Poor sleep ↔ +5 mmHg morning systolic'
        : type === 'activity_x_resting_hr'
          ? 'More daily steps ↔ −2 bpm resting HR'
          : 'Lower overnight SpO2 dips ↔ lower sleep score',
    narrative_long: 'Pattern based on the last 24 days.',
    created_at: '2025-04-11T03:00:00Z',
  };
}
