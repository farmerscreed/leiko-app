// SelfBuyer/Watch — Sprint 4 acceptance tests.
//
// Bar (per docs/04-screens/self-buyer-onboarding.md §4.4.2):
//   - Headline + body render verbatim
//   - "I have it" tappable; calls completeSelfBuyer
//   - "I need to order one" disabled with "Coming soon" pill
//   - finalizeError surfaces in a live region when set
//   - Voice gate

import { type ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { SelfBuyerWatchScreen } from '../Onboarding/SelfBuyer/Watch';
import { useOnboarding } from '../../state/onboarding';
import type { SelfBuyerOnboardingScreenProps } from '../../navigation/types';

const mockComplete = jest.fn();

// Self-contained mock (no requireActual): state/onboarding ↔ state/auth
// form a circular import, and requireActual'ing onboarding here used to
// crash at module load ("Cannot read properties of undefined (reading
// 'setState')") because auth was mid-evaluation. The screen only reads
// completeSelfBuyer / finalizing / finalizeError; the test drives the
// latter two via setState. A tiny zustand-like stub covers both.
let mockOnboardingState: Record<string, unknown> = {};
jest.mock('../../state/onboarding', () => {
  const useOnboarding = Object.assign(
    <T,>(selector: (s: Record<string, unknown>) => T): T =>
      selector({ ...mockOnboardingState, completeSelfBuyer: mockComplete }),
    {
      getState: () => ({ ...mockOnboardingState, completeSelfBuyer: mockComplete }),
      setState: (patch: Record<string, unknown>) => {
        mockOnboardingState = { ...mockOnboardingState, ...patch };
      },
    },
  );
  return { useOnboarding };
});

function withProviders(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

function makeNav() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as SelfBuyerOnboardingScreenProps<'Watch'>['navigation'];
}

function makeRoute() {
  return {
    key: 'k',
    name: 'Watch' as const,
    params: undefined,
  } as unknown as SelfBuyerOnboardingScreenProps<'Watch'>['route'];
}

beforeEach(() => {
  mockComplete.mockReset();
  useOnboarding.setState({
    selfBuyer: { displayName: 'Lawrence', yearOfBirth: 1985, timezone: 'Africa/Lagos' },
    caregiver: { displayName: '', relationship: null },
    parent: {
      displayName: '',
      relationship: null,
      relationshipCustom: null,
      timezone: 'UTC',
    },
    familyId: null,
    caregiverOnboardingComplete: false,
    selfBuyerOnboardingComplete: false,
    finalizing: false,
    finalizeError: null,
  });
});

describe('SelfBuyer/Watch — copy', () => {
  it('renders headline and body verbatim', () => {
    render(
      withProviders(<SelfBuyerWatchScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByText('Do you have the watch yet?')).toBeTruthy();
    expect(
      screen.getByText("No problem either way — we'll guide you through the next step."),
    ).toBeTruthy();
  });

  it('renders both card titles', () => {
    render(
      withProviders(<SelfBuyerWatchScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByText('I have it')).toBeTruthy();
    expect(screen.getByText('I need to order one')).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});

describe('SelfBuyer/Watch — interaction', () => {
  it("'I have it' calls completeSelfBuyer", async () => {
    mockComplete.mockResolvedValueOnce(undefined);
    render(
      withProviders(<SelfBuyerWatchScreen navigation={makeNav()} route={makeRoute()} />),
    );

    fireEvent.press(screen.getByTestId('self-buyer-watch-have'));

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces finalizeError when the completion fails', async () => {
    mockComplete.mockRejectedValueOnce(new Error('boom'));
    useOnboarding.setState({ finalizeError: 'Network is offline. Try again.' });

    render(
      withProviders(<SelfBuyerWatchScreen navigation={makeNav()} route={makeRoute()} />),
    );

    expect(screen.getByTestId('self-buyer-watch-error')).toBeTruthy();
    expect(screen.getByText('Network is offline. Try again.')).toBeTruthy();
  });
});

describe('SelfBuyer/Watch — voice gate', () => {
  it('has no forbidden phrases', () => {
    render(
      withProviders(<SelfBuyerWatchScreen navigation={makeNav()} route={makeRoute()} />),
    );
    const FORBIDDEN = [
      'patient',
      'loved one',
      'your family',
      'diagnose',
      'predict',
      'medical advice',
      "don't wait",
      'silent killer',
      'critical level',
    ];
    for (const term of FORBIDDEN) {
      expect(screen.queryByText(new RegExp(term, 'i'))).toBeNull();
    }
  });
});
