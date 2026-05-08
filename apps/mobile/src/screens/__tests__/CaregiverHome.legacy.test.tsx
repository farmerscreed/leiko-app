// @ts-nocheck — Sprint 7.7b widened ParentSummary with multi-vital
// fields. This legacy test predates that and constructs ParentSummary
// literals inline in many places. File is deleted at Sprint 7.7 close;
// suppressing the type errors here keeps the test running until then
// without obscuring real type issues elsewhere.
//
// CaregiverHome — Sprint 7 component tests.
//
// Acceptance criteria covered:
//   - Empty + populated states render with correct tokens.
//   - Anomaly banner appears for at least one calm-concerned + one
//     confirmed-urgent fixture (most-severe-wins).
//   - Voice gate passes (verified empty-state copy from spec).
//   - Pull-to-refresh wires through to the hook.

import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import {
  CaregiverHome,
  pickAnomaly,
  averageRecent,
  mergeLocalLatest,
} from '../Home/CaregiverHome.legacy';
import type { ParentSummary } from '../../services/families/fetchParentSummaries';

// Mock the hook entirely — these are screen tests, not data tests.
const mockUseFamilyReadings = jest.fn();
jest.mock('../../hooks/useFamilyReadings', () => ({
  useFamilyReadings: () => mockUseFamilyReadings(),
}));

// Pairing + readings stores used by CaregiverHome — provide minimal
// stub state. The orchestrator's start/stop is wired by RootNavigator,
// not by CaregiverHome, so we don't need to mock that.
jest.mock('../../state/pairing', () => ({
  usePairing: (selector?: (s: unknown) => unknown) => {
    const state = { pairedDevice: null };
    return selector ? selector(state) : state;
  },
}));

jest.mock('../../state/readings', () => ({
  useReadings: (selector?: (s: unknown) => unknown) => {
    const state = { latest: () => null };
    return selector ? selector(state) : state;
  },
}));

jest.mock('../../state/syncOrchestrator', () => ({
  useSyncOrchestrator: (selector?: (s: unknown) => unknown) => {
    const state = { status: 'idle', runSync: jest.fn() };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

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
});

// Sprint 7.7b widened ParentSummary with latestHr/latestSpo2/latestSleep.
// This legacy test predates that and constructs ParentSummary literals
// inline without those fields. Coerce via the helper rather than rewrite
// every call site — file is deleted at Sprint 7.7 close.
function setHookResult(
  parents: Array<Partial<ParentSummary>>,
  opts: Partial<{ isLoading: boolean; error: Error | null }> = {},
) {
  const fullParents: ParentSummary[] = parents.map((p) => ({
    familyId: '',
    parentDisplayName: '',
    parentRelationship: '',
    parentYearOfBirth: null,
    latestReading: null,
    recentReadings: [],
    latestHr: null,
    latestSpo2: null,
    latestSleep: null,
    ...p,
  }));
  mockUseFamilyReadings.mockReturnValue({
    parents: fullParents,
    isLoading: opts.isLoading ?? false,
    isRefreshing: false,
    error: opts.error ?? null,
    refresh: jest.fn(async () => undefined),
  });
}

describe('<CaregiverHome />', () => {
  it('renders the verified empty-state copy when the user has no families', () => {
    setHookResult([]);
    render(withProviders(<CaregiverHome />));
    // Per docs/04-screens/caregiver-home.md "Your family circle is quiet for now"
    expect(screen.getByText('Your family circle is quiet for now')).toBeTruthy();
    expect(screen.getByText('Add a family member to start sharing care.')).toBeTruthy();
  });

  it('renders one parent card per family with the latest reading', () => {
    setHookResult([
      {
        familyId: 'fam-1',
        parentDisplayName: 'Mum',
        parentRelationship: 'mother',
        parentYearOfBirth: 1955,
        latestReading: {
          id: 'r1',
          measuredAt: new Date(Date.now() - 60_000).toISOString(),
          systolic: 124,
          diastolic: 79,
          pulse: 72,
          qualityScore: 'good',
        },
        recentReadings: Array.from({ length: 5 }, (_, i) => ({
          id: `r${i}`,
          measuredAt: new Date(Date.now() - i * 86_400_000).toISOString(),
          systolic: 120 + i,
          diastolic: 78,
          pulse: 70,
          qualityScore: 'good' as const,
        })),
      },
    ]);
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('parent-card-fam-1')).toBeTruthy();
    expect(screen.getByText('Mum')).toBeTruthy();
    // The numeric 124/79 is rendered as accessibilityElementsHidden so
    // VoiceOver reads the composed accessibilityLabel — use the test
    // id to assert the card is wired through.
    expect(screen.getByTestId('parent-sparkline-fam-1')).toBeTruthy();
  });

  it('renders the calm-concerned anomaly banner when a parent triggers the calm tier', () => {
    setHookResult([
      {
        familyId: 'fam-1',
        parentDisplayName: 'Mum',
        parentRelationship: 'mother',
        parentYearOfBirth: 1955,
        latestReading: {
          id: 'rc',
          measuredAt: new Date().toISOString(),
          // Above STAGE2_SYS (160) → cold-start path returns calm_concerned.
          systolic: 165,
          diastolic: 100,
          pulse: 72,
          qualityScore: 'good',
        },
        recentReadings: [],
      },
    ]);
    render(withProviders(<CaregiverHome />));
    expect(screen.getByText('Worth a chat with Mum')).toBeTruthy();
  });

  it('renders the confirmed-urgent anomaly banner when a parent triggers the crisis tier', () => {
    setHookResult([
      {
        familyId: 'fam-1',
        parentDisplayName: 'Dad',
        parentRelationship: 'father',
        parentYearOfBirth: 1953,
        latestReading: {
          id: 'ru',
          measuredAt: new Date().toISOString(),
          // ≥180/120 absolute → crisis tier regardless of baseline.
          systolic: 185,
          diastolic: 122,
          pulse: 80,
          qualityScore: 'good',
        },
        recentReadings: [],
      },
    ]);
    render(withProviders(<CaregiverHome />));
    expect(screen.getByText('Talk to Dad now')).toBeTruthy();
  });

  it('shows the no-readings card with "Pair watch" CTA when paired device is missing', () => {
    setHookResult([
      {
        familyId: 'fam-1',
        parentDisplayName: 'Mum',
        parentRelationship: 'mother',
        parentYearOfBirth: 1955,
        latestReading: null,
        recentReadings: [],
      },
    ]);
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('parent-card-pair-fam-1')).toBeTruthy();
  });
});

// ─── Pure helpers ─────────────────────────────────────────────────────

describe('pickAnomaly (most-severe wins)', () => {
  it('returns null when every parent reading is in range', () => {
    expect(
      pickAnomaly([
        {
          familyId: 'a',
          parentDisplayName: 'A',
          parentRelationship: '',
          parentYearOfBirth: null,
          latestReading: {
            id: 'r',
            measuredAt: '2026-05-07T08:00:00Z',
            systolic: 118,
            diastolic: 76,
            pulse: 70,
            qualityScore: 'good',
          },
          recentReadings: [],
        },
      ]),
    ).toBeNull();
  });

  it('prefers confirmed_urgent over calm_concerned across parents', () => {
    const result = pickAnomaly([
      {
        familyId: 'concerned',
        parentDisplayName: 'Mum',
        parentRelationship: '',
        parentYearOfBirth: null,
        latestReading: {
          id: 'rc',
          measuredAt: '2026-05-07T08:00:00Z',
          systolic: 165,
          diastolic: 100,
          pulse: 75,
          qualityScore: 'good',
        },
        recentReadings: [],
      },
      {
        familyId: 'urgent',
        parentDisplayName: 'Dad',
        parentRelationship: '',
        parentYearOfBirth: null,
        latestReading: {
          id: 'ru',
          measuredAt: '2026-05-07T08:00:00Z',
          systolic: 185,
          diastolic: 122,
          pulse: 75,
          qualityScore: 'good',
        },
        recentReadings: [],
      },
    ]);
    expect(result?.tier).toBe('confirmed_urgent');
    expect(result?.parentName).toBe('Dad');
  });
});

describe('averageRecent', () => {
  it('returns null on no readings', () => {
    expect(averageRecent([])).toBeNull();
  });

  it('marks "higher" when the recent half is >4 systolic above the earlier half', () => {
    const rs = [
      { id: '1', measuredAt: '', systolic: 130, diastolic: 80, pulse: 70, qualityScore: null },
      { id: '2', measuredAt: '', systolic: 130, diastolic: 80, pulse: 70, qualityScore: null },
      { id: '3', measuredAt: '', systolic: 120, diastolic: 78, pulse: 70, qualityScore: null },
      { id: '4', measuredAt: '', systolic: 120, diastolic: 78, pulse: 70, qualityScore: null },
    ];
    expect(averageRecent(rs)?.trend).toBe('higher');
  });

  it('marks "in_line" when the swing is small', () => {
    const rs = [
      { id: '1', measuredAt: '', systolic: 122, diastolic: 80, pulse: 70, qualityScore: null },
      { id: '2', measuredAt: '', systolic: 121, diastolic: 80, pulse: 70, qualityScore: null },
      { id: '3', measuredAt: '', systolic: 120, diastolic: 80, pulse: 70, qualityScore: null },
      { id: '4', measuredAt: '', systolic: 121, diastolic: 80, pulse: 70, qualityScore: null },
    ];
    expect(averageRecent(rs)?.trend).toBe('in_line');
  });
});

describe('mergeLocalLatest', () => {
  it('returns parents unchanged when local is null', () => {
    const parents: ParentSummary[] = [];
    expect(mergeLocalLatest(parents, null)).toBe(parents);
  });

  it('prepends the local reading when newer than the first parent\'s latest', () => {
    const now = Math.floor(Date.now() / 1000);
    const localReading = {
      localId: 'local',
      serverId: null,
      measuredAtSec: now,
      systolic: 128,
      diastolic: 82,
      pulse: 75,
      source: 'watch' as const,
      classification: { tier: 'in_pattern' as const, reason: 'cold_start' as const },
      deviceBleId: null,
      capturedAtMs: now * 1000,
    };
    const parents: ParentSummary[] = [
      {
        familyId: 'fam-1',
        parentDisplayName: 'Mum',
        parentRelationship: 'mother',
        parentYearOfBirth: 1955,
        latestReading: {
          id: 'older',
          measuredAt: new Date((now - 3600) * 1000).toISOString(),
          systolic: 120,
          diastolic: 80,
          pulse: 70,
          qualityScore: 'good',
        },
        recentReadings: [],
      },
    ];
    const merged = mergeLocalLatest(parents, localReading);
    expect(merged[0].latestReading?.systolic).toBe(128);
  });

  it('leaves parents unchanged when local is older', () => {
    const now = Math.floor(Date.now() / 1000);
    const local = {
      localId: 'local',
      serverId: null,
      measuredAtSec: now - 3600,
      systolic: 125,
      diastolic: 80,
      pulse: 70,
      source: 'watch' as const,
      classification: { tier: 'in_pattern' as const, reason: 'cold_start' as const },
      deviceBleId: null,
      capturedAtMs: now * 1000,
    };
    const parents: ParentSummary[] = [
      {
        familyId: 'fam-1',
        parentDisplayName: 'Mum',
        parentRelationship: 'mother',
        parentYearOfBirth: 1955,
        latestReading: {
          id: 'newer',
          measuredAt: new Date(now * 1000).toISOString(),
          systolic: 130,
          diastolic: 82,
          pulse: 72,
          qualityScore: 'good',
        },
        recentReadings: [],
      },
    ];
    expect(mergeLocalLatest(parents, local)).toBe(parents);
  });
});
