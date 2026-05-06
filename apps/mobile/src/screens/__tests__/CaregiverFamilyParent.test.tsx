// FamilyParent — Sprint 3 acceptance tests.
//
// Bar (per docs/04-screens/caregiver-onboarding.md §4.4.2):
//   - Headline + body render verbatim
//   - 5 relationship chips render (Mum / Dad / Aunt / Uncle / Other)
//   - Choosing 'Other' surfaces the custom-label input
//   - Continue is disabled until all required fields are filled
//   - Continue persists draft (encoded relationship) and routes to FamilyWatch
//   - Voice gate

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { CaregiverFamilyParentScreen } from '../Onboarding/Caregiver/FamilyParent';
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
  } as unknown as CaregiverOnboardingScreenProps<'FamilyParent'>['navigation'];
}

function makeRoute() {
  return { key: 'k', name: 'FamilyParent' as const, params: undefined } as unknown as CaregiverOnboardingScreenProps<'FamilyParent'>['route'];
}

beforeEach(() => {
  useOnboarding.setState({
    caregiver: { displayName: 'Tunde', relationship: 'son' },
    parent: {
      displayName: '',
      relationship: null,
      relationshipCustom: null,
      timezone: 'Africa/Lagos',
    },
    familyId: null,
    caregiverOnboardingComplete: false,
    finalizing: false,
    finalizeError: null,
  });
});

describe('FamilyParent — copy', () => {
  it('renders the headline verbatim', () => {
    render(
      withProviders(
        <CaregiverFamilyParentScreen navigation={makeNav()} route={makeRoute()} />,
      ),
    );
    expect(screen.getByText('Who are you looking after?')).toBeTruthy();
  });

  it('uses Mama Linda as the placeholder example (cultural specificity)', () => {
    render(
      withProviders(
        <CaregiverFamilyParentScreen navigation={makeNav()} route={makeRoute()} />,
      ),
    );
    expect(screen.getByPlaceholderText('Mama Linda')).toBeTruthy();
  });

  it('renders all 5 relationship chips', () => {
    render(
      withProviders(
        <CaregiverFamilyParentScreen navigation={makeNav()} route={makeRoute()} />,
      ),
    );
    for (const chip of ['Mum', 'Dad', 'Aunt', 'Uncle', 'Other']) {
      expect(screen.getByText(chip)).toBeTruthy();
    }
  });
});

describe('FamilyParent — interaction', () => {
  it("'Other' surfaces a custom-label input that gates Continue", () => {
    const nav = makeNav();
    render(
      withProviders(
        <CaregiverFamilyParentScreen navigation={nav} route={makeRoute()} />,
      ),
    );

    fireEvent.changeText(screen.getByTestId('family-parent-name'), 'Aunty Tola');
    fireEvent.press(screen.getByTestId('family-parent-chip-other'));

    // Continue should still be blocked — custom label is required.
    fireEvent.press(screen.getByTestId('family-parent-continue'));
    expect(nav.navigate).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('family-parent-custom'), 'Aunty');
    fireEvent.press(screen.getByTestId('family-parent-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('FamilyWatch');

    const { parent } = useOnboarding.getState();
    expect(parent.displayName).toBe('Aunty Tola');
    expect(parent.relationship).toBe('other');
    expect(parent.relationshipCustom).toBe('Aunty');
  });

  it('persists encoded relationship for non-other choices', () => {
    const nav = makeNav();
    render(
      withProviders(
        <CaregiverFamilyParentScreen navigation={nav} route={makeRoute()} />,
      ),
    );

    fireEvent.changeText(screen.getByTestId('family-parent-name'), 'Mama Linda');
    fireEvent.press(screen.getByTestId('family-parent-chip-mother'));
    fireEvent.press(screen.getByTestId('family-parent-continue'));

    const { parent } = useOnboarding.getState();
    expect(parent.relationship).toBe('mother');
    expect(parent.relationshipCustom).toBeNull();
    expect(parent.timezone).toBe('Africa/Lagos');
  });
});

describe('FamilyParent — voice gate', () => {
  it('has no forbidden phrases', () => {
    render(
      withProviders(
        <CaregiverFamilyParentScreen navigation={makeNav()} route={makeRoute()} />,
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
