// SelfBuyer/You — Sprint 4 acceptance tests.
//
// Bar (per docs/04-screens/self-buyer-onboarding.md §4.4.1 + verified copy
// table in §4.1.1):
//   - Headline + body + field labels render verbatim
//   - Continue is disabled until name is filled
//   - Year of birth is optional; submitting without it is fine
//   - Year of birth, when provided, must be a 4-digit year in 1900..2100
//   - Continue persists draft to the onboarding store and routes to Watch
//   - Voice gate (incl. self-buyer "your family" prohibition)

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { SelfBuyerYouScreen } from '../Onboarding/SelfBuyer/You';
import { useOnboarding } from '../../state/onboarding';
import type { SelfBuyerOnboardingScreenProps } from '../../navigation/types';

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
  } as unknown as SelfBuyerOnboardingScreenProps<'You'>['navigation'];
}

function makeRoute() {
  return {
    key: 'k',
    name: 'You' as const,
    params: undefined,
  } as unknown as SelfBuyerOnboardingScreenProps<'You'>['route'];
}

beforeEach(() => {
  useOnboarding.setState({
    selfBuyer: { displayName: '', yearOfBirth: null, timezone: 'Africa/Lagos' },
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

describe('SelfBuyer/You — verified copy', () => {
  it('renders headline + body verbatim per D8a §4.1.1', () => {
    render(
      withProviders(<SelfBuyerYouScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByText("Welcome. Let's set you up.")).toBeTruthy();
    expect(screen.getByText("A few quick details. We don't need much.")).toBeTruthy();
  });

  it('renders verified field labels and helpers verbatim', () => {
    render(
      withProviders(<SelfBuyerYouScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByText('What should we call you?')).toBeTruthy();
    expect(screen.getByPlaceholderText('First name is fine')).toBeTruthy();
    expect(screen.getByText('Year of birth (optional)')).toBeTruthy();
    expect(
      screen.getByText('Helps us frame your readings in context. You can skip this.'),
    ).toBeTruthy();
    expect(screen.getByText('Your timezone')).toBeTruthy();
    expect(screen.getByText('Auto-detected. Tap to change.')).toBeTruthy();
  });
});

describe('SelfBuyer/You — interaction', () => {
  it('Continue is disabled until the name is filled', () => {
    const nav = makeNav();
    render(
      withProviders(<SelfBuyerYouScreen navigation={nav} route={makeRoute()} />),
    );

    fireEvent.press(screen.getByTestId('self-buyer-you-continue'));
    expect(nav.navigate).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('self-buyer-you-name'), 'Lawrence');
    fireEvent.press(screen.getByTestId('self-buyer-you-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('Watch');
  });

  it('persists draft (name, optional yob, timezone) on Continue', () => {
    const nav = makeNav();
    render(
      withProviders(<SelfBuyerYouScreen navigation={nav} route={makeRoute()} />),
    );

    fireEvent.changeText(screen.getByTestId('self-buyer-you-name'), '   Lawrence   ');
    fireEvent.changeText(screen.getByTestId('self-buyer-you-yob'), '1985');
    fireEvent.press(screen.getByTestId('self-buyer-you-continue'));

    const { selfBuyer } = useOnboarding.getState();
    expect(selfBuyer.displayName).toBe('Lawrence');
    expect(selfBuyer.yearOfBirth).toBe(1985);
    expect(selfBuyer.timezone).toBe('Africa/Lagos');
  });

  it('skipping yob (empty string) is allowed and persists null', () => {
    const nav = makeNav();
    render(
      withProviders(<SelfBuyerYouScreen navigation={nav} route={makeRoute()} />),
    );

    fireEvent.changeText(screen.getByTestId('self-buyer-you-name'), 'Lawrence');
    fireEvent.press(screen.getByTestId('self-buyer-you-continue'));

    expect(useOnboarding.getState().selfBuyer.yearOfBirth).toBeNull();
    expect(nav.navigate).toHaveBeenCalledWith('Watch');
  });

  it('rejects invalid yob (out of range) and blocks Continue', () => {
    const nav = makeNav();
    render(
      withProviders(<SelfBuyerYouScreen navigation={nav} route={makeRoute()} />),
    );

    fireEvent.changeText(screen.getByTestId('self-buyer-you-name'), 'Lawrence');
    fireEvent.changeText(screen.getByTestId('self-buyer-you-yob'), '1850');
    expect(
      screen.getByText('Enter a four-digit year between 1900 and 2100.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('self-buyer-you-continue'));
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

describe('SelfBuyer/You — voice gate', () => {
  it('has no forbidden phrases', () => {
    render(
      withProviders(<SelfBuyerYouScreen navigation={makeNav()} route={makeRoute()} />),
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
    ];
    for (const term of FORBIDDEN) {
      expect(screen.queryByText(new RegExp(term, 'i'))).toBeNull();
    }
  });
});
