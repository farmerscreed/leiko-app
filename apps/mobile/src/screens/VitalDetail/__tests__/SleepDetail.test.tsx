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

// Sprint 17a parent-scoped hooks land in SleepDetail but were never
// mocked here, so the test suite has been failing on baseline since
// 17a (TanStack Query throws "No QueryClient set"). Stub both to the
// "self-buyer path" defaults (data null, not loading, no error) so the
// existing assertions run; the Sprint 18 audit fixes add new
// describe blocks that flip these mocks to exercise the loading +
// error paths explicitly.
let mockParentPulse: {
  data: unknown;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} = {
  data: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
  refresh: async () => undefined,
};
let mockParentRecent: {
  data: { sleep: unknown[]; readings: unknown[] };
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} = {
  data: { sleep: [], readings: [] },
  isLoading: false,
  isRefreshing: false,
  error: null,
  refresh: async () => undefined,
};
const setMockParentPulse = (next: Partial<typeof mockParentPulse>) => {
  mockParentPulse = { ...mockParentPulse, ...next };
};
// setMockParentRecent retained for future tests that need to flip the
// recent-list slice; intentionally referenced via void here so TS6133
// stays quiet without an eslint suppression. Remove the void line when
// the first real consumer lands.
void ((_next: Partial<typeof mockParentRecent>) => {
  mockParentRecent = { ...mockParentRecent, ..._next };
});
const resetParentMocks = () => {
  mockParentPulse = {
    data: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: async () => undefined,
  };
  mockParentRecent = {
    data: { sleep: [], readings: [] },
    isLoading: false,
    isRefreshing: false,
    error: null,
    refresh: async () => undefined,
  };
};
jest.mock('../../../hooks/useParentDailyPulseData', () => ({
  useParentDailyPulseData: () => mockParentPulse,
}));
jest.mock('../../../hooks/useParentVitalsRecent', () => ({
  useParentVitalsRecent: () => mockParentRecent,
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

  it('renders calmer range copy for high sleep score (with history)', () => {
    // Sprint 18 P1 — comparative phrasing ("than last week") only fires
    // once the user has HISTORY_REFERENCE_NIGHTS (7) recorded sessions.
    // Seed 8 nights so the comparative copy returns.
    const session = makeSleep({ sleepScore: 85 });
    const history = Array.from({ length: 8 }, (_, i) =>
      makeSleep({ endSec: NOW_SEC() - (i + 1) * 86400, sleepScore: 78 }),
    );
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
    mockSleepRecent = [session, ...history];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    expect(screen.getByText('A quieter night than last week')).toBeTruthy();
  });

  it('renders the "more restless" range copy for a genuinely poor night (score derived from data)', () => {
    // Data-completeness fix (2026-06-05): the stored sleepScore was a
    // constant-0 ingest placeholder, so display now derives the score
    // from the REAL session fields (sleepScoreForSession) — the stored
    // field is ignored. A restless night = short total + no deep
    // (4h / 0 deep → score ≈ 30 < 50).
    const session = makeSleep({ sleepScore: 40, totalMinutes: 240, deepMinutes: 0 });
    const history = Array.from({ length: 8 }, (_, i) =>
      makeSleep({ endSec: NOW_SEC() - (i + 1) * 86400, sleepScore: 50 }),
    );
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
    mockSleepRecent = [session, ...history];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    expect(screen.getByText('A more restless night than your usual')).toBeTruthy();
  });

  it('uses non-comparative range copy when the user has fewer than 7 nights of history', () => {
    // Sprint 18 P1 — first-week user shouldn't see "than your usual"
    // when they have no "usual" yet.
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
    mockSleepRecent = [session]; // only 1 night
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    expect(screen.getByText('A quieter night by the numbers')).toBeTruthy();
    expect(screen.queryByText('A quieter night than last week')).toBeNull();
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

describe('SleepDetail — stages bar + recent', () => {
  // Sprint 16.5c replaced SleepHypnogram with SleepStagesBar
  // (testID renamed from `sleep-detail-hypnogram` to
  // `sleep-detail-stages`); test was failing on baseline since then.
  it('renders the stages bar when a session is present', () => {
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
    expect(screen.getByTestId('sleep-detail-stages')).toBeTruthy();
    // Eyebrow renamed when SleepDetail moved to RecentReadingsSection
    // (on-device review 2026-05-08): "Last seven nights" → "Recent nights".
    expect(screen.getByText('Recent nights')).toBeTruthy();
  });
});

// ─── Sprint 18 audit fixes ──────────────────────────────────────────────

describe('SleepDetail — caregiver-scoped loading + error (Sprint 18 S1 + S3)', () => {
  beforeEach(() => {
    resetParentMocks();
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

  it('shows a loading spinner — not the empty-state UI — when the parent fetch is in flight', () => {
    setMockParentPulse({ isLoading: true, data: null });
    render(
      withProviders(
        <SleepDetail onBack={() => undefined} familyId="fam-123" />,
      ),
    );
    expect(screen.getByTestId('sleep-detail-loading')).toBeTruthy();
    // The empty-state body should NOT be claiming "no sleep" while we're still fetching.
    expect(screen.queryByTestId('sleep-detail-insight')).toBeNull();
  });

  it('shows an ErrorState — not the empty-state UI — when the parent fetch errored', () => {
    setMockParentPulse({ error: new Error('network down'), data: null });
    render(
      withProviders(
        <SleepDetail onBack={() => undefined} familyId="fam-123" />,
      ),
    );
    expect(screen.getByTestId('sleep-detail-error')).toBeTruthy();
    expect(screen.queryByTestId('sleep-detail-insight')).toBeNull();
  });
});

describe("SleepDetail — recent-nights labels (Sprint 18 S2)", () => {
  it("does NOT label the newest row 'Last night' / 'now' when it's older than 36 hours", () => {
    // Newest session was 3 days ago (sparse-tracker scenario).
    const stale = makeSleep({ endSec: NOW_SEC() - 3 * 86400, totalMinutes: 420 });
    setMockData({
      bpLatest: null,
      hrRestingToday: null,
      hrRestingRecent: [],
      hrLatestSampleAt: null,
      spo2LatestPercent: null,
      spo2OvernightLowsRecent: [],
      spo2LatestSampleAt: null,
      sleepSession: null, // no last-night session in dailyPulse
      activityToday: null,
    });
    mockSleepRecent = [stale];
    render(withProviders(<SleepDetail onBack={() => undefined} />));
    // The recent-list row should NOT call this stale session "Last night".
    expect(screen.queryByText(/Last night ·/)).toBeNull();
    // And the time chip should not say "now" for it.
    expect(screen.queryByText('now')).toBeNull();
  });
});

describe('SleepDetail — correlation empty-state placeholder (Sprint 18 P5)', () => {
  it('renders the calm placeholder when sleep history exists but BP data is too sparse', () => {
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
    expect(screen.getByTestId('sleep-detail-correlation-placeholder')).toBeTruthy();
  });

  it('does NOT render the placeholder when there is no sleep history at all', () => {
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
    expect(screen.queryByTestId('sleep-detail-correlation-placeholder')).toBeNull();
  });
});

describe('SleepDetail — snapshot', () => {
  // Pin the wall clock so the rendered relative timestamps don't
  // drift as the test machine's clock advances.
  const FROZEN = new Date('2026-05-08T16:30:00Z').getTime();
  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(FROZEN);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

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
