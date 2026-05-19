// CaregiverHome — Sprint 7.7a integration tests for the bird's-eye view.
//
// Acceptance criteria covered:
//   - Empty state ("Your family circle is quiet for now")
//   - Loading state (skeleton renders)
//   - Three-person populated state (orbs + legend present)
//   - Drill-in: tap a person → navigation.navigate('ReadingDetail', ...)
//   - AnomalyBanner: confirmed-urgent fires; calm-concerned fires; clear-only suppresses
//   - CaregiverActionBar visible with count when populated
//   - Voice gate passes on every authored screen-level string
//
// Mocks the data hooks at the boundary so these stay screen tests,
// not data tests. The pure helper (utils/caregiverPerson.ts) has its
// own unit tests; this file just exercises the wiring.

import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { CaregiverHome } from '../Home/CaregiverHome';
import type { ParentSummary } from '../../services/families/fetchParentSummaries';
import type { CaregiverPerson } from '../../utils/caregiverPerson';

const mockNavigate = jest.fn();
const mockRefresh = jest.fn(async () => undefined);

const mockHookResult = {
  parents: [] as ParentSummary[],
  people: [] as CaregiverPerson[],
  isLoading: false,
  isRefreshing: false,
  error: null as Error | null,
  refresh: mockRefresh,
};

const EMPTY_VITAL_STRIP = { bp: '—', hr: '—', spo2: '—', sleep: '—' };

jest.mock('../../hooks/useCaregiverFamily', () => ({
  useCaregiverFamily: () => mockHookResult,
}));

// Test-controlled viewMode — defaults to 'birds'; individual tests
// flip it via `setMockViewMode('cards')` before render.
let mockViewMode: 'birds' | 'cards' = 'birds';
const setMockViewMode = (m: 'birds' | 'cards') => {
  mockViewMode = m;
};
jest.mock('../../hooks/useCaregiverViewMode', () => ({
  useCaregiverViewMode: () => ({ viewMode: mockViewMode, setViewMode: jest.fn() }),
}));

jest.mock('../../state/pairing', () => ({
  usePairing: (selector?: (s: unknown) => unknown) => {
    const state = { pairedDevice: null };
    return selector ? selector(state) : state;
  },
}));

// Sprint 14.5 task 3 — Caregiver Home renders the home-seeded
// Learn card via this hook. Default the mock to "no card available"
// so the existing 20+ tests don't depend on Learn-corpus state;
// the dedicated test below flips it to assert the slot renders.
jest.mock('../../hooks/useSeededLearnCard', () => ({
  useSeededLearnCard: jest.fn(() => ({
    article: null,
    onArticleOpen: jest.fn(),
    onDismiss: jest.fn(),
  })),
}));

jest.mock('../../state/readings', () => {
  // Sprint 16.6 — `byLocalId` was added to useReadings in the cross-phone
  // tap-routing fix (commit 221f19c) so CaregiverHome can distinguish a
  // local reading (route to ReadingDetail) from a server-only one (route
  // to ParentReadings). The test's existing assertion expects
  // ReadingDetail navigation, so the mock returns a stub for any id.
  const state = {
    latest: () => null,
    pending: [],
    recent: [],
    byLocalId: (id: string) => ({ localId: id } as unknown),
  };
  const useReadings = (selector?: (s: unknown) => unknown) =>
    selector ? selector(state) : state;
  // Sprint 14.5 task 3 — useSeededLearnCard reads useReadings.getState()
  // for the priority-cascade decision. Mirror the zustand surface.
  useReadings.getState = () => state;
  return { useReadings };
});

// Sprint 10a — the SixthReadingPaywallHost mounted on CaregiverHome
// pulls usePlusEntitlement (TanStack Query against families). These
// tests don't need a live entitlement; stub to a Plus user so the
// auto-paywall short-circuits and the component never opens.
jest.mock('../../hooks/usePlusEntitlement', () => ({
  usePlusEntitlement: () => ({
    tier: 'plus',
    isPlus: true,
    isLoading: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  }),
  isPlusTier: (t: string) => ['plus', 'plus_trial', 'plus_grace'].includes(t),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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
      <ThemeProvider mode="caregiver" colorMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function reading(overrides: Partial<{ id: string; measuredAt: string; systolic: number; diastolic: number }> = {}) {
  return {
    id: overrides.id ?? 'r1',
    measuredAt:
      overrides.measuredAt ?? new Date(Date.now() - 60_000).toISOString(),
    systolic: overrides.systolic ?? 122,
    diastolic: overrides.diastolic ?? 78,
    pulse: 64,
    qualityScore: 'good' as const,
  };
}

function parent(overrides: Partial<ParentSummary> & { familyId: string; parentDisplayName: string }): ParentSummary {
  return {
    familyId: overrides.familyId,
    parentDisplayName: overrides.parentDisplayName,
    parentRelationship: overrides.parentRelationship ?? 'Mom',
    parentYearOfBirth: overrides.parentYearOfBirth ?? 1955,
    latestReading: overrides.latestReading ?? null,
    recentReadings: overrides.recentReadings ?? [],
    latestHr: overrides.latestHr ?? null,
    latestSpo2: overrides.latestSpo2 ?? null,
    latestSleep: overrides.latestSleep ?? null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHookResult.parents = [];
  mockHookResult.people = [];
  mockHookResult.isLoading = false;
  mockHookResult.isRefreshing = false;
  mockHookResult.error = null;
  setMockViewMode('birds');
});

describe('<CaregiverHome /> — empty state', () => {
  // Sprint 16.6 Issue #1 — empty state inverted to lead with the
  // invite-code path (the more common journey for non-technical
  // caregivers being invited by an existing user) and a secondary
  // link drops to Settings → Family for outgoing invites.
  it('renders the empty-state heading + body + both CTAs', () => {
    render(withProviders(<CaregiverHome />));
    expect(screen.getByText('Your family circle is quiet for now')).toBeTruthy();
    expect(
      screen.getByText(/Has someone shared an invite code with you/),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'I have an invite code' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Or invite someone yourself' }),
    ).toBeTruthy();
  });

  it('does not render the constellation or action bar when empty', () => {
    render(withProviders(<CaregiverHome />));
    expect(screen.queryByTestId('caregiver-home-constellation')).toBeNull();
    expect(screen.queryByTestId('caregiver-home-action-bar')).toBeNull();
  });
});

describe('<CaregiverHome /> — loading state', () => {
  it('renders the skeleton (no orbs yet)', () => {
    mockHookResult.isLoading = true;
    render(withProviders(<CaregiverHome />));
    expect(screen.queryByTestId('caregiver-home-constellation')).toBeNull();
    expect(screen.queryByText('Your family circle is quiet for now')).toBeNull();
  });
});

describe('<CaregiverHome /> — populated state', () => {
  function setupThreePeople() {
    mockHookResult.parents = [
      parent({
        familyId: 'fam-1',
        parentDisplayName: 'Marian Okeke',
        parentRelationship: 'Mom',
        latestReading: reading({ id: 'r-mom', systolic: 122, diastolic: 78 }),
      }),
      parent({
        familyId: 'fam-2',
        parentDisplayName: 'Emeka Okeke',
        parentRelationship: 'Dad',
        latestReading: reading({ id: 'r-dad', systolic: 134, diastolic: 86 }),
      }),
      parent({
        familyId: 'fam-3',
        parentDisplayName: 'Joy Adeyemi',
        parentRelationship: 'Aunt',
        latestReading: reading({ id: 'r-aunt', systolic: 118, diastolic: 74 }),
      }),
    ];
    mockHookResult.people = [
      {
        id: 'fam-1',
        fullName: 'Marian Okeke',
        initial: 'M',
        accentIndex: 1,
        status: 'clear',
        bpLabel: '122/78',
        headline: 'Read 1 min ago — in pattern.',
        sentence: 'BP 122/78 a moment ago. Inside the usual band.',
        relation: 'Mom',
        vitalStrip: { bp: '122/78', hr: '64', spo2: '98%', sleep: '7:42' },
      },
      {
        id: 'fam-2',
        fullName: 'Emeka Okeke',
        initial: 'E',
        accentIndex: 2,
        status: 'clear',
        bpLabel: '134/86',
        headline: 'Read 1 min ago — in pattern.',
        sentence: 'BP 134/86 a moment ago. Inside the usual band.',
        relation: 'Dad',
        vitalStrip: { bp: '134/86', hr: '72', spo2: '96%', sleep: '6:18' },
      },
      {
        id: 'fam-3',
        fullName: 'Joy Adeyemi',
        initial: 'J',
        accentIndex: 3,
        status: 'clear',
        bpLabel: '118/74',
        headline: 'Read 1 min ago — in pattern.',
        sentence: 'BP 118/74 a moment ago. Inside the usual band.',
        relation: 'Aunt',
        vitalStrip: { bp: '118/74', hr: '58', spo2: '97%', sleep: '8:00' },
      },
    ];
  }

  it('renders three orbs (constellation) + legend + action bar', () => {
    setupThreePeople();
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('caregiver-home-constellation')).toBeTruthy();
    expect(screen.getByTestId('caregiver-home-legend')).toBeTruthy();
    expect(screen.getByTestId('caregiver-home-action-bar')).toBeTruthy();
  });

  it('renders the count in the action bar', () => {
    setupThreePeople();
    render(withProviders(<CaregiverHome />));
    expect(screen.getByText('3 · all in your circle')).toBeTruthy();
  });

  it('navigates to ReadingDetail on a legend row tap', () => {
    setupThreePeople();
    render(withProviders(<CaregiverHome />));
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Marian, Mom, All clear, Read 1 min ago — in pattern.',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('ReadingDetail', {
      readingLocalId: 'r-mom',
    });
  });
});

describe('<CaregiverHome /> — anomaly banner', () => {
  function setupOnePerson(status: 'clear' | 'attention' | 'urgent') {
    mockHookResult.parents = [
      parent({
        familyId: 'fam-1',
        parentDisplayName: 'Marian Okeke',
        parentRelationship: 'Mom',
        latestReading: reading({ id: 'r1', systolic: 122, diastolic: 78 }),
      }),
    ];
    mockHookResult.people = [
      {
        id: 'fam-1',
        fullName: 'Marian Okeke',
        initial: 'M',
        accentIndex: 1,
        status,
        bpLabel: '122/78',
        headline: 'headline',
        sentence: 'sentence',
        relation: 'Mom',
        vitalStrip: EMPTY_VITAL_STRIP,
      },
    ];
  }

  it('shows confirmed-urgent banner when any person is urgent', () => {
    setupOnePerson('urgent');
    render(withProviders(<CaregiverHome />));
    expect(screen.getByText('Talk to Marian now')).toBeTruthy();
  });

  it('shows calm-concerned banner when only attention status is present', () => {
    setupOnePerson('attention');
    render(withProviders(<CaregiverHome />));
    expect(screen.getByText('Worth a chat with Marian')).toBeTruthy();
  });

  it('does NOT render an AnomalyBanner when everyone is clear', () => {
    setupOnePerson('clear');
    render(withProviders(<CaregiverHome />));
    expect(screen.queryByText(/Talk to/)).toBeNull();
    expect(screen.queryByText(/Worth a chat/)).toBeNull();
  });

  it('confirmed-urgent wins over calm-concerned (most-severe-wins)', () => {
    mockHookResult.parents = [
      parent({
        familyId: 'fam-1',
        parentDisplayName: 'Marian Okeke',
        parentRelationship: 'Mom',
        latestReading: reading({ id: 'r1' }),
      }),
      parent({
        familyId: 'fam-2',
        parentDisplayName: 'Emeka Okeke',
        parentRelationship: 'Dad',
        latestReading: reading({ id: 'r2' }),
      }),
    ];
    mockHookResult.people = [
      {
        id: 'fam-1',
        fullName: 'Marian Okeke',
        initial: 'M',
        accentIndex: 1,
        status: 'attention',
        bpLabel: '122/78',
        headline: 'h',
        sentence: 's',
        relation: 'Mom',
        vitalStrip: EMPTY_VITAL_STRIP,
      },
      {
        id: 'fam-2',
        fullName: 'Emeka Okeke',
        initial: 'E',
        accentIndex: 2,
        status: 'urgent',
        bpLabel: '188/120',
        headline: 'h',
        sentence: 's',
        relation: 'Dad',
        vitalStrip: EMPTY_VITAL_STRIP,
      },
    ];
    render(withProviders(<CaregiverHome />));
    // Confirmed-urgent (Dad) wins; calm-concerned (Marian) is suppressed.
    expect(screen.getByText('Talk to Emeka now')).toBeTruthy();
    expect(screen.queryByText(/Worth a chat/)).toBeNull();
  });
});

describe('<CaregiverHome /> — view toggle (Sprint 7.7b)', () => {
  function setupThree() {
    mockHookResult.parents = [
      parent({
        familyId: 'fam-1',
        parentDisplayName: 'Marian Okeke',
        parentRelationship: 'Mom',
        latestReading: reading({ id: 'r-mom' }),
      }),
    ];
    mockHookResult.people = [
      {
        id: 'fam-1',
        fullName: 'Marian Okeke',
        initial: 'M',
        accentIndex: 1,
        status: 'clear',
        bpLabel: '122/78',
        headline: 'h',
        sentence: 'BP 122/78 a moment ago. Inside the usual band.',
        relation: 'Mom',
        vitalStrip: { bp: '122/78', hr: '64', spo2: '98%', sleep: '7:42' },
      },
    ];
  }

  it('renders the segmented toggle when populated', () => {
    setupThree();
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('caregiver-home-view-toggle')).toBeTruthy();
    expect(screen.getByRole('button', { name: "Bird's-eye view" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Detailed view' })).toBeTruthy();
  });

  it('does NOT render the toggle in empty state', () => {
    render(withProviders(<CaregiverHome />));
    expect(screen.queryByTestId('caregiver-home-view-toggle')).toBeNull();
  });

  it('renders only the birds layer at rest (cards layer unmounted)', () => {
    setupThree();
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('caregiver-home-birds-layer')).toBeTruthy();
    // Cards layer is unmounted at rest to prevent bleed-through and
    // touch interception. It mounts during the transition window.
    expect(screen.queryByTestId('caregiver-home-cards-layer')).toBeNull();
  });

  it('renders the editorial DetailedView when viewMode is cards', () => {
    setupThree();
    setMockViewMode('cards');
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('caregiver-home-detailed')).toBeTruthy();
    expect(screen.queryByTestId('caregiver-home-birds-layer')).toBeNull();
    // 1 person → "One you love, checked in."
    expect(screen.getByText(/One/)).toBeTruthy();
  });

  it('renders a PersonCard per person with its vital strip in cards mode', () => {
    setupThree();
    setMockViewMode('cards');
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('caregiver-home-card-fam-1')).toBeTruthy();
    expect(screen.getAllByText('122/78').length).toBeGreaterThan(0);
    expect(screen.getByText('64')).toBeTruthy();
    expect(screen.getByText('98%')).toBeTruthy();
    expect(screen.getByText('7:42')).toBeTruthy();
  });
});

describe('<CaregiverHome /> — Ask Leiko (Sprint 12 follow-up)', () => {
  it('renders the floating Ask Leiko button', () => {
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('caregiver-home-ask-leiko-fab')).toBeTruthy();
  });
});

describe('<CaregiverHome /> — seeded Learn card (Sprint 14.5 task 3)', () => {
  // The card sits inside the bird's-eye view, which only renders
  // when merged.length > 0 (i.e. the caregiver has at least one
  // person on the constellation). Set up minimal populated state
  // here so the bird's-eye block — and thus the Learn slot — paints.
  beforeEach(() => {
    mockHookResult.parents = [
      parent({
        familyId: 'fam-1',
        parentDisplayName: 'Marian Okeke',
        parentRelationship: 'Mom',
        latestReading: reading({ id: 'r-mom', systolic: 122, diastolic: 78 }),
      }),
    ];
    mockHookResult.people = [
      {
        id: 'fam-1',
        fullName: 'Marian Okeke',
        accentIndex: 1,
        initial: 'M',
        relation: 'Mom',
        status: 'clear',
        bpLabel: '122/78',
        headline: 'In pattern',
        sentence: 'morning numbers steady',
        vitalStrip: { bp: '122/78', hr: '64', spo2: '97', sleep: '7.5h' },
      },
    ];
    const useSeededLearnCard = jest.requireMock('../../hooks/useSeededLearnCard')
      .useSeededLearnCard as jest.Mock;
    useSeededLearnCard.mockReturnValue({
      article: {
        id: 'numbers-001',
        frontmatter: {
          id: 'numbers-001',
          title: 'What is blood pressure?',
          summary: 'A short answer.',
          audience: ['caregiver'],
          category: 'bp',
          read_time_min: 1,
        },
        // HomeLearnCard's extractExcerpt iterates blocks; provide a
        // minimal AST so the iterator doesn't throw.
        blocks: [
          { kind: 'paragraph', children: [{ kind: 'text', value: 'A short answer.' }] },
        ],
      },
      onArticleOpen: jest.fn(),
      onDismiss: jest.fn(),
    });
  });
  afterEach(() => {
    const useSeededLearnCard = jest.requireMock('../../hooks/useSeededLearnCard')
      .useSeededLearnCard as jest.Mock;
    useSeededLearnCard.mockReturnValue({ article: null, onArticleOpen: jest.fn(), onDismiss: jest.fn() });
  });

  it('renders the home-seeded Learn card when the hook returns one', () => {
    render(withProviders(<CaregiverHome />));
    expect(screen.getByTestId('caregiver-home-learn-card')).toBeTruthy();
  });
});

describe('<CaregiverHome /> — voice rules', () => {
  it.each([
    'Your family circle is quiet for now',
    // Sprint 16.6 Issue #1 — empty-state copy refreshed for the
    // invite-code-first CTA. Body explains the incoming-caregiver
    // path; primary CTA opens the AcceptInviteSheet; secondary text
    // link drops to Settings → Family for outgoing invites.
    /Has someone shared an invite code with you/,
    'I have an invite code',
    /Or invite someone yourself/,
    'Good morning',
    'Leiko · Family',
  ])('voice-rule clean string present: %s', (text) => {
    render(withProviders(<CaregiverHome />));
    expect(screen.getByText(text)).toBeTruthy();
  });
});
