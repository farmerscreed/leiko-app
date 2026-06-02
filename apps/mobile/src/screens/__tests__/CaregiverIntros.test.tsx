// Caregiver intros — Sprint 3 acceptance tests.
//
// Bar (per docs/04-screens/caregiver-onboarding.md §4.2):
//   - All three intro headlines + bodies render verbatim
//   - Intro 1 has only Continue (no skip)
//   - Intro 2 + Intro 3 have skip; skip routes to FamilyYou
//   - Intro 1 → Intro 2 → Intro 3 → FamilyYou navigation chain
//   - Voice gate: forbidden phrases absent

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { CaregiverIntro1Screen } from '../Onboarding/Caregiver/Intro1';
import { CaregiverIntro2Screen } from '../Onboarding/Caregiver/Intro2';
import { CaregiverIntro3Screen } from '../Onboarding/Caregiver/Intro3';
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

function makeNav<R extends 'Intro1' | 'Intro2' | 'Intro3'>() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as CaregiverOnboardingScreenProps<R>['navigation'];
}

function makeRoute<R extends 'Intro1' | 'Intro2' | 'Intro3'>(name: R) {
  return { key: 'k', name, params: undefined } as unknown as CaregiverOnboardingScreenProps<R>['route'];
}

describe('Intro1 — copy + nav', () => {
  it('renders the headline and body verbatim', () => {
    render(
      withProviders(
        <CaregiverIntro1Screen
          navigation={makeNav<'Intro1'>()}
          route={makeRoute('Intro1')}
        />,
      ),
    );
    expect(screen.getByText('Stay close to the people who shaped you.')).toBeTruthy();
    expect(
      screen.getByText(
        "Leiko is a calm way to keep an eye on a parent's health, even from far away.",
      ),
    ).toBeTruthy();
  });

  it('shows only Continue (no skip on the first intro)', () => {
    render(
      withProviders(
        <CaregiverIntro1Screen
          navigation={makeNav<'Intro1'>()}
          route={makeRoute('Intro1')}
        />,
      ),
    );
    expect(screen.getByTestId('caregiver-intro1-continue')).toBeTruthy();
    expect(screen.queryByText('Skip')).toBeNull();
  });

  it('Continue routes to Intro2', () => {
    const nav = makeNav<'Intro1'>();
    render(
      withProviders(
        <CaregiverIntro1Screen navigation={nav} route={makeRoute('Intro1')} />,
      ),
    );
    fireEvent.press(screen.getByTestId('caregiver-intro1-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('Intro2');
  });
});

describe('Intro2 — copy + nav', () => {
  it('renders the headline and body verbatim', () => {
    render(
      withProviders(
        <CaregiverIntro2Screen
          navigation={makeNav<'Intro2'>()}
          route={makeRoute('Intro2')}
        />,
      ),
    );
    expect(screen.getByText('Their watch. Your peace of mind.')).toBeTruthy();
    expect(
      screen.getByText(
        "When your parent's blood pressure changes, we let you know — gently. No surveillance, no panic.",
      ),
    ).toBeTruthy();
  });

  it('Continue routes to Intro3, Skip routes to FamilyYou', () => {
    const nav = makeNav<'Intro2'>();
    render(
      withProviders(
        <CaregiverIntro2Screen navigation={nav} route={makeRoute('Intro2')} />,
      ),
    );
    fireEvent.press(screen.getByTestId('caregiver-intro2-skip'));
    expect(nav.navigate).toHaveBeenCalledWith('FamilyYou');

    (nav.navigate as jest.Mock).mockClear();
    fireEvent.press(screen.getByTestId('caregiver-intro2-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('Intro3');
  });
});

describe('Intro3 — copy + nav', () => {
  it('renders the headline and body verbatim', () => {
    render(
      withProviders(
        <CaregiverIntro3Screen
          navigation={makeNav<'Intro3'>()}
          route={makeRoute('Intro3')}
        />,
      ),
    );
    expect(screen.getByText('You drive. They wear.')).toBeTruthy();
    expect(
      screen.getByText(
        'You set up the watch and pay. They wear it and tap once a day. Everyone sees the same readings.',
      ),
    ).toBeTruthy();
  });

  it('Get started and Skip both route to FamilyYou', () => {
    const nav = makeNav<'Intro3'>();
    render(
      withProviders(
        <CaregiverIntro3Screen navigation={nav} route={makeRoute('Intro3')} />,
      ),
    );
    fireEvent.press(screen.getByTestId('caregiver-intro3-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('FamilyYou');

    (nav.navigate as jest.Mock).mockClear();
    fireEvent.press(screen.getByTestId('caregiver-intro3-skip'));
    expect(nav.navigate).toHaveBeenCalledWith('FamilyYou');
  });
});

describe('Intros — voice gate', () => {
  const FORBIDDEN = [
    'patient',
    'patients',
    'loved one',
    'diagnose',
    'diagnosis',
    'treatment',
    'predict',
    'medical advice',
    "don't wait",
    'silent killer',
    'dangerous level',
    'critical level',
  ];

  it('Intro1 has no forbidden phrases', () => {
    render(
      withProviders(
        <CaregiverIntro1Screen
          navigation={makeNav<'Intro1'>()}
          route={makeRoute('Intro1')}
        />,
      ),
    );
    for (const term of FORBIDDEN) {
      expect(screen.queryByText(new RegExp(term, 'i'))).toBeNull();
    }
  });

  it('Intro2 has no forbidden phrases', () => {
    render(
      withProviders(
        <CaregiverIntro2Screen
          navigation={makeNav<'Intro2'>()}
          route={makeRoute('Intro2')}
        />,
      ),
    );
    for (const term of FORBIDDEN) {
      expect(screen.queryByText(new RegExp(term, 'i'))).toBeNull();
    }
  });

  it('Intro3 has no forbidden phrases', () => {
    render(
      withProviders(
        <CaregiverIntro3Screen
          navigation={makeNav<'Intro3'>()}
          route={makeRoute('Intro3')}
        />,
      ),
    );
    for (const term of FORBIDDEN) {
      expect(screen.queryByText(new RegExp(term, 'i'))).toBeNull();
    }
  });
});
