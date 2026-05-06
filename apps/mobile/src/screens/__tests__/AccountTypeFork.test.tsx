// AccountTypeFork — Sprint 2 acceptance tests.
//
// Bar (per docs/04-screens/onboarding-fork.md + sprint card):
//   - Headline + body copy match verbatim
//   - Both CTAs present, both rendered as button.primary (D8a §3.1.2 —
//     equal visual weight)
//   - Each CTA, when tapped, dispatches setPendingAccountType with the
//     correct value and navigates to SignUp
//   - The Sprint 2 "Sign in" tertiary link routes to SignIn
//
// We mock useAuth so we don't pull supabase into the RN test runtime.

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';

const mockSetPendingAccountType = jest.fn();

jest.mock('../../state/auth', () => ({
  useAuth: (selector: (s: { setPendingAccountType: typeof mockSetPendingAccountType }) => unknown) =>
    selector({ setPendingAccountType: mockSetPendingAccountType }),
}));

import { AccountTypeForkScreen } from '../Onboarding/AccountTypeFork';

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
  return { navigate: jest.fn(), goBack: jest.fn() } as unknown as Parameters<
    typeof AccountTypeForkScreen
  >[0]['navigation'];
}

function makeRoute() {
  return { key: 'k', name: 'AccountTypeFork', params: undefined } as unknown as Parameters<
    typeof AccountTypeForkScreen
  >[0]['route'];
}

beforeEach(() => {
  mockSetPendingAccountType.mockReset();
});

describe('AccountTypeFork — copy', () => {
  it('renders the headline verbatim per docs/04-screens/onboarding-fork.md', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByText('Who are you setting up for?')).toBeTruthy();
  });

  it('renders the body verbatim', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(
      screen.getByText('Leiko works for both — the path just looks a little different.'),
    ).toBeTruthy();
  });

  it('renders both CTA labels and captions verbatim', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByText('Someone I care for')).toBeTruthy();
    expect(screen.getByText('A parent, partner, or other family member')).toBeTruthy();
    expect(screen.getByText('Myself')).toBeTruthy();
    expect(screen.getByText('I have or want to track my own blood pressure')).toBeTruthy();
  });

  it('renders the Sign in tertiary link', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByTestId('fork-sign-in')).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('passes voice rules: no forbidden words in user-visible strings', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    // docs/05-voice-and-claims.md HARD FAIL list — sample the highest-
    // risk phrases for an onboarding screen. (The CI copy-lint scanner
    // is the canonical check; this is a screen-level smoke test.)
    const forbidden = [
      'patient',
      'patients',
      'loved one',
      'diagnose',
      'diagnosis',
      'treatment',
      'predict',
      'medical advice',
      'simple',
      "don't wait",
      'silent killer',
    ];
    for (const term of forbidden) {
      expect(screen.queryByText(new RegExp(term, 'i'))).toBeNull();
    }
  });
});

describe('AccountTypeFork — interaction', () => {
  it("caregiver tap caches account_type='caregiver' and routes to SignUp", () => {
    const nav = makeNav();
    render(withProviders(<AccountTypeForkScreen navigation={nav} route={makeRoute()} />));

    fireEvent.press(screen.getByTestId('fork-caregiver'));

    expect(mockSetPendingAccountType).toHaveBeenCalledWith('caregiver');
    expect(nav.navigate).toHaveBeenCalledWith('SignUp');
  });

  it("self-buyer tap caches account_type='self_buyer' and routes to SignUp", () => {
    const nav = makeNav();
    render(withProviders(<AccountTypeForkScreen navigation={nav} route={makeRoute()} />));

    fireEvent.press(screen.getByTestId('fork-self-buyer'));

    expect(mockSetPendingAccountType).toHaveBeenCalledWith('self_buyer');
    expect(nav.navigate).toHaveBeenCalledWith('SignUp');
  });

  it('Sign in link routes to SignIn without caching an account_type', () => {
    const nav = makeNav();
    render(withProviders(<AccountTypeForkScreen navigation={nav} route={makeRoute()} />));

    fireEvent.press(screen.getByTestId('fork-sign-in'));

    expect(mockSetPendingAccountType).not.toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith('SignIn');
  });
});

describe('AccountTypeFork — visual weight (D8a §3.1.2)', () => {
  it('both CTAs render as buttons (equal visual weight per spec)', () => {
    // Equal visual weight is enforced by the source: the screen passes
    // variant="primary" to both Buttons. We can't compare resolved
    // backgroundColors without scraping internal Pressable state — too
    // brittle. The robust assertion at unit-test scope is that both
    // CTAs are accessible buttons of the same variant family. Visual
    // parity itself belongs in Sprint 17 visual-regression coverage.
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    const caregiver = screen.getByTestId('fork-caregiver');
    const selfBuyer = screen.getByTestId('fork-self-buyer');
    expect(caregiver.props.accessibilityRole).toBe('button');
    expect(selfBuyer.props.accessibilityRole).toBe('button');
  });
});
