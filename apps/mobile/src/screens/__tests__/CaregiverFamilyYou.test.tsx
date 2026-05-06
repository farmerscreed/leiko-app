// FamilyYou — Sprint 3 acceptance tests.
//
// Bar (per docs/04-screens/caregiver-onboarding.md §4.4.1):
//   - Headline + body render verbatim
//   - Continue is disabled until both name + relationship are filled
//   - Selecting a chip + entering a name then tapping Continue routes to
//     FamilyParent and persists draft to the onboarding store
//   - Voice gate

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { CaregiverFamilyYouScreen } from '../Onboarding/Caregiver/FamilyYou';
import { useOnboarding } from '../../state/onboarding';
import type { CaregiverOnboardingScreenProps } from '../../navigation/types';

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
  } as unknown as CaregiverOnboardingScreenProps<'FamilyYou'>['navigation'];
}

function makeRoute() {
  return { key: 'k', name: 'FamilyYou' as const, params: undefined } as unknown as CaregiverOnboardingScreenProps<'FamilyYou'>['route'];
}

beforeEach(() => {
  useOnboarding.setState({
    caregiver: { displayName: '', relationship: null },
    parent: {
      displayName: '',
      relationship: null,
      relationshipCustom: null,
      timezone: 'UTC',
    },
    familyId: null,
    caregiverOnboardingComplete: false,
    finalizing: false,
    finalizeError: null,
  });
});

describe('FamilyYou — copy', () => {
  it('renders the headline verbatim', () => {
    render(
      withProviders(
        <CaregiverFamilyYouScreen navigation={makeNav()} route={makeRoute()} />,
      ),
    );
    expect(screen.getByText('Tell us about you.')).toBeTruthy();
  });

  it('renders all 5 relationship chips', () => {
    render(
      withProviders(
        <CaregiverFamilyYouScreen navigation={makeNav()} route={makeRoute()} />,
      ),
    );
    for (const chip of ['Daughter', 'Son', 'Niece', 'Nephew', 'Other']) {
      expect(screen.getByText(chip)).toBeTruthy();
    }
  });
});

describe('FamilyYou — interaction', () => {
  it('Continue is disabled until name + relationship are present', () => {
    const nav = makeNav();
    render(
      withProviders(
        <CaregiverFamilyYouScreen navigation={nav} route={makeRoute()} />,
      ),
    );

    // No fields filled — pressing the disabled button should not navigate.
    fireEvent.press(screen.getByTestId('family-you-continue'));
    expect(nav.navigate).not.toHaveBeenCalled();

    // Fill name only.
    fireEvent.changeText(screen.getByTestId('family-you-name'), 'Tunde');
    fireEvent.press(screen.getByTestId('family-you-continue'));
    expect(nav.navigate).not.toHaveBeenCalled();

    // Now also pick a chip.
    fireEvent.press(screen.getByTestId('family-you-chip-son'));
    fireEvent.press(screen.getByTestId('family-you-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('FamilyParent');
  });

  it('persists name + relationship into the onboarding store on Continue', () => {
    const nav = makeNav();
    render(
      withProviders(
        <CaregiverFamilyYouScreen navigation={nav} route={makeRoute()} />,
      ),
    );

    fireEvent.changeText(screen.getByTestId('family-you-name'), 'Tunde');
    fireEvent.press(screen.getByTestId('family-you-chip-son'));
    fireEvent.press(screen.getByTestId('family-you-continue'));

    const { caregiver } = useOnboarding.getState();
    expect(caregiver.displayName).toBe('Tunde');
    expect(caregiver.relationship).toBe('son');
  });

  it('trims whitespace from the entered name', () => {
    const nav = makeNav();
    render(
      withProviders(
        <CaregiverFamilyYouScreen navigation={nav} route={makeRoute()} />,
      ),
    );

    fireEvent.changeText(screen.getByTestId('family-you-name'), '   Aisha   ');
    fireEvent.press(screen.getByTestId('family-you-chip-daughter'));
    fireEvent.press(screen.getByTestId('family-you-continue'));

    expect(useOnboarding.getState().caregiver.displayName).toBe('Aisha');
  });
});

describe('FamilyYou — voice gate', () => {
  it('has no forbidden phrases', () => {
    render(
      withProviders(
        <CaregiverFamilyYouScreen navigation={makeNav()} route={makeRoute()} />,
      ),
    );
    const FORBIDDEN = [
      'patient',
      'loved one',
      'diagnose',
      'predict',
      'medical advice',
      'silent killer',
    ];
    for (const term of FORBIDDEN) {
      expect(screen.queryByText(new RegExp(term, 'i'))).toBeNull();
    }
  });
});
