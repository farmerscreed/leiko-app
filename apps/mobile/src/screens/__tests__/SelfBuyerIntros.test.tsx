// Self-buyer intros — Sprint 4 acceptance tests.
//
// Bar (per docs/04-screens/self-buyer-onboarding.md §4.2.4–6):
//   - All three intro headlines + bodies render verbatim
//   - Intro 1 has only Continue (no skip on the first intro)
//   - Intro 2 + Intro 3 have skip; skip routes to You
//   - Intro 1 → Intro 2 → Intro 3 → You navigation chain
//   - Voice gate: forbidden phrases absent (incl. self-buyer-only:
//     no "your family", no "patient", no "user")

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { SelfBuyerIntro1Screen } from '../Onboarding/SelfBuyer/Intro1';
import { SelfBuyerIntro2Screen } from '../Onboarding/SelfBuyer/Intro2';
import { SelfBuyerIntro3Screen } from '../Onboarding/SelfBuyer/Intro3';
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

function makeNav<R extends 'Intro1' | 'Intro2' | 'Intro3'>() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as unknown as SelfBuyerOnboardingScreenProps<R>['navigation'];
}

function makeRoute<R extends 'Intro1' | 'Intro2' | 'Intro3'>(name: R) {
  return { key: 'k', name, params: undefined } as unknown as SelfBuyerOnboardingScreenProps<R>['route'];
}

describe('SelfBuyer Intro1 — copy + nav', () => {
  it('renders the headline and body verbatim (D8a §3.3.1)', () => {
    render(
      withProviders(
        <SelfBuyerIntro1Screen
          navigation={makeNav<'Intro1'>()}
          route={makeRoute('Intro1')}
        />,
      ),
    );
    expect(screen.getByText('Your blood pressure, in your own words.')).toBeTruthy();
    expect(
      screen.getByText(
        'Leiko helps you understand what your numbers mean — in plain language, on your terms.',
      ),
    ).toBeTruthy();
  });

  it('shows only Continue (no skip)', () => {
    render(
      withProviders(
        <SelfBuyerIntro1Screen
          navigation={makeNav<'Intro1'>()}
          route={makeRoute('Intro1')}
        />,
      ),
    );
    expect(screen.getByTestId('self-buyer-intro1-continue')).toBeTruthy();
    expect(screen.queryByText('Skip')).toBeNull();
  });

  it('Continue routes to Intro2', () => {
    const nav = makeNav<'Intro1'>();
    render(
      withProviders(
        <SelfBuyerIntro1Screen navigation={nav} route={makeRoute('Intro1')} />,
      ),
    );
    fireEvent.press(screen.getByTestId('self-buyer-intro1-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('Intro2');
  });
});

describe('SelfBuyer Intro2 — copy + nav', () => {
  it('renders the headline and body verbatim', () => {
    render(
      withProviders(
        <SelfBuyerIntro2Screen
          navigation={makeNav<'Intro2'>()}
          route={makeRoute('Intro2')}
        />,
      ),
    );
    expect(screen.getByText("Same accuracy as your doctor's cuff.")).toBeTruthy();
    expect(
      screen.getByText(
        'The watch uses an inflatable cuff — the same method clinicians use — measured from your wrist instead of your arm.',
      ),
    ).toBeTruthy();
  });

  it('Continue routes to Intro3, Skip routes to You', () => {
    const nav = makeNav<'Intro2'>();
    render(
      withProviders(
        <SelfBuyerIntro2Screen navigation={nav} route={makeRoute('Intro2')} />,
      ),
    );
    fireEvent.press(screen.getByTestId('self-buyer-intro2-skip'));
    expect(nav.navigate).toHaveBeenCalledWith('You');

    (nav.navigate as jest.Mock).mockClear();
    fireEvent.press(screen.getByTestId('self-buyer-intro2-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('Intro3');
  });
});

describe('SelfBuyer Intro3 — copy + nav', () => {
  it('renders the headline and body verbatim', () => {
    render(
      withProviders(
        <SelfBuyerIntro3Screen
          navigation={makeNav<'Intro3'>()}
          route={makeRoute('Intro3')}
        />,
      ),
    );
    expect(screen.getByText('See your trends. Show them to your doctor.')).toBeTruthy();
    expect(
      screen.getByText(
        'A clear weekly summary, the kind you can save and share at your next appointment.',
      ),
    ).toBeTruthy();
  });

  it('Get started and Skip both route to You', () => {
    const nav = makeNav<'Intro3'>();
    render(
      withProviders(
        <SelfBuyerIntro3Screen navigation={nav} route={makeRoute('Intro3')} />,
      ),
    );
    fireEvent.press(screen.getByTestId('self-buyer-intro3-continue'));
    expect(nav.navigate).toHaveBeenCalledWith('You');

    (nav.navigate as jest.Mock).mockClear();
    fireEvent.press(screen.getByTestId('self-buyer-intro3-skip'));
    expect(nav.navigate).toHaveBeenCalledWith('You');
  });
});

describe('SelfBuyer intros — voice gate', () => {
  // Self-buyer-only anti-patterns (D8a §2.3): "your family" forbidden in
  // self-buyer onboarding; "user" forbidden as user-facing copy; standard
  // HARD FAIL list also enforced.
  const FORBIDDEN = [
    'patient',
    'patients',
    'loved one',
    'your family',
    'diagnose',
    'diagnosis',
    'treatment',
    'predict',
    'medical advice',
    "don't wait",
    'silent killer',
    'dangerous level',
    'critical level',
    'you are at risk',
    'we detected',
    'you may have',
  ];

  it('Intro1 has no forbidden phrases', () => {
    render(
      withProviders(
        <SelfBuyerIntro1Screen
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
        <SelfBuyerIntro2Screen
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
        <SelfBuyerIntro3Screen
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
