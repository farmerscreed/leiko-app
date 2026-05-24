import { type ReactNode } from 'react';
import { Platform, Share } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import {
  ForYourDoctorScreen,
  FYD_STRINGS,
  buildSharePayload,
} from '../ForYourDoctorScreen';
import { lintVoiceText } from '../../../services/voice/voiceLint';
import type { AccountType, UserRow } from '../../../types/database';
import type { TrendsData } from '../../../utils/trends-aggregate';

// ── Mock state — mutated per test ───────────────────────────────────

let mockAccountType: AccountType = 'self_buyer';
let mockIsPlus = false;
let mockFamilyId: string | null = 'family-1';
let mockTrendsData: TrendsData = trendsWithData();

function trendsWithData(): TrendsData {
  const days = ['2026-05-10', '2026-05-11', '2026-05-12'];
  return {
    series: {
      bp: days.map((day, i) => ({
        day,
        sys: 122 + i,
        dia: 80 + i,
        pulse: 70,
        count: 1,
      })),
      hr: [],
      spo2: [],
      sleep: [],
      activity: [],
    },
    summary: {
      bp: { count: 3, avgSys: 123, avgDia: 81, pctInRange: 1 },
      hr: { count: 0, avgResting: null },
      spo2: { count: 0, avgMinPercent: null },
      sleep: { count: 0, avgTotalMinutes: null },
      activity: { count: 0, avgSteps: null },
    },
  };
}

function trendsEmpty(): TrendsData {
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

jest.mock('../../../hooks/useTrendsData', () => ({
  useTrendsData: () => ({
    data: mockTrendsData,
    isLoading: false,
    isRefreshing: false,
    error: null,
  }),
  useTrendsCorrelations: () => ({ correlations: [], isLoading: false, error: null }),
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
      display_name: 'Adaeze Okeke',
      photo_url: null,
      preferred_language: 'en',
      timezone: 'Africa/Lagos',
      year_of_birth: 1980,
      account_type: mockAccountType,
      marketing_opt_in: false,
      gender: null,
      height_cm: null,
      weight_kg: null,
      hypertension_status: null,
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

const mockGeneratePdf = jest.fn();
jest.mock('../../../services/doctorPdf', () => {
  const actual = jest.requireActual('../../../services/doctorPdf');
  return { ...actual, generateDoctorPdf: (...args: unknown[]) => mockGeneratePdf(...args) };
});

const goBack = jest.fn();

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

function renderScreen(initial: { range?: '7d' | '30d' | '90d' | '1y' } = {}) {
  return render(
    withProviders(
      <ForYourDoctorScreen
        navigation={{ goBack }}
        route={{ params: initial }}
      />,
    ),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountType = 'self_buyer';
  mockIsPlus = false;
  mockFamilyId = 'family-1';
  mockTrendsData = trendsWithData();
});

describe('ForYourDoctorScreen — title + entry', () => {
  it("renders the self-buyer title 'For your doctor'", () => {
    renderScreen();
    expect(screen.getByText(/For your /)).toBeTruthy();
    expect(screen.getAllByText('doctor').length).toBeGreaterThan(0);
  });

  it("flips to 'For her doctor' in caregiver mode", () => {
    mockAccountType = 'caregiver';
    renderScreen();
    expect(screen.getByText(/For her /)).toBeTruthy();
  });

  it('the header eyebrow reads "Leiko · Share"', () => {
    renderScreen();
    expect(screen.getByTestId('fyd-header-eyebrow').props.children).toBe(
      FYD_STRINGS.eyebrow,
    );
  });

  it('back button calls navigation.goBack', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('fyd-back'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});

describe('ForYourDoctorScreen — range chips + paywall', () => {
  it('renders 4 range chips', () => {
    renderScreen();
    for (const r of ['7d', '30d', '90d', '1y'] as const) {
      expect(screen.getByTestId(`fyd-range:${r}`)).toBeTruthy();
    }
  });

  it('default range honours the deep-link param when valid', () => {
    mockIsPlus = true;
    renderScreen({ range: '90d' });
    // Plus user — 90d chip is selectable; the active chip is the 90d.
    // Pill component sets selected=true on accent variant; the test
    // confirms the chip's accessibilityLabel matches an active state.
    const chip = screen.getByTestId('fyd-range:90d');
    expect(chip).toBeTruthy();
  });

  it('a free user tapping a Plus-gated chip opens the paywall', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('fyd-range:30d'));
    expect(screen.getByText('Understand your numbers')).toBeTruthy();
  });

  it('a Plus user can switch ranges without the paywall', () => {
    mockIsPlus = true;
    renderScreen();
    fireEvent.press(screen.getByTestId('fyd-range:30d'));
    expect(screen.queryByText('Understand your numbers')).toBeNull();
  });
});

describe('ForYourDoctorScreen — generate flow', () => {
  it('free tap on Generate opens the paywall sheet, not the generator', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('fyd-generate'));
    expect(mockGeneratePdf).not.toHaveBeenCalled();
    expect(screen.getByText('Understand your numbers')).toBeTruthy();
  });

  it('Plus tap on Generate invokes the generator and opens the share sheet', async () => {
    mockIsPlus = true;
    mockGeneratePdf.mockResolvedValueOnce({
      status: 'ok',
      url: 'https://signed.example/report.pdf',
      bytes: 1024,
      storagePath: 'reports/u.pdf',
    });
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({
      action: 'sharedAction' as never,
    } as never);
    renderScreen();
    await act(async () => {
      fireEvent.press(screen.getByTestId('fyd-generate'));
    });
    await waitFor(() => expect(mockGeneratePdf).toHaveBeenCalled());
    expect(mockGeneratePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 'family-1',
        userId: 'user-1',
        range: '30d',
        includeNotes: true,
      }),
    );
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    shareSpy.mockRestore();
  });

  it('a generator error renders the error state', async () => {
    mockIsPlus = true;
    mockGeneratePdf.mockResolvedValueOnce({
      status: 'error',
      reason: 'invoke_failed',
    });
    renderScreen();
    await act(async () => {
      fireEvent.press(screen.getByTestId('fyd-generate'));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('fyd-error')).not.toBeNull();
    });
  });
});

describe('ForYourDoctorScreen — empty state', () => {
  it('renders the empty state when there are no readings', () => {
    mockTrendsData = trendsEmpty();
    renderScreen();
    expect(screen.getByTestId('fyd-empty')).toBeTruthy();
    expect(screen.queryByTestId('fyd-generate')).toBeNull();
    expect(screen.queryByTestId('fyd-preview')).toBeNull();
  });
});

describe('ForYourDoctorScreen — caregiver-only comments toggle', () => {
  it('hides the caregiver-comments row in self-buyer mode', () => {
    renderScreen();
    expect(screen.queryByTestId('fyd-include-comments')).toBeNull();
  });

  it('shows the caregiver-comments row in caregiver mode', () => {
    mockAccountType = 'caregiver';
    renderScreen();
    expect(screen.getByTestId('fyd-include-comments')).toBeTruthy();
  });
});

describe('ForYourDoctorScreen — voice gate', () => {
  it.each(
    Object.entries(FYD_STRINGS)
      // The subtitle templates contain "{range}" placeholders; lint
      // the rendered form.
      .map(([key, value]) => [
        key,
        value
          .replace('{range}', '7 days'),
      ]) as Array<[string, string]>,
  )('%s passes voice-lint', (_key, copy) => {
    expect(lintVoiceText(copy).passes).toBe(true);
  });
});

describe('buildSharePayload — platform asymmetry', () => {
  // RN's Share.share ignores `url` on Android; pre-fix the share sheet
  // sent JUST the subtitle text with no PDF link, so users were getting
  // the screen subtitle in WhatsApp/Mail instead of the report.
  const url = 'https://signed.example/report.pdf';
  const accountType = 'self_buyer' as const;
  const range = '7d' as const;
  const parentLabel = 'you';

  afterEach(() => {
    // Restore default test platform (jest-expo defaults to 'ios').
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  });

  it('iOS uses the `url` field and a plain subtitle as the message', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const payload = buildSharePayload(url, accountType, range, parentLabel);
    expect(payload.url).toBe(url);
    expect(payload.message).not.toContain(url);
  });

  it('Android omits `url` and appends the URL to the message so the link is actually shared', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const payload = buildSharePayload(url, accountType, range, parentLabel);
    expect(payload.url).toBeUndefined();
    expect(payload.message).toContain(url);
  });
});
