// AccountTypeFork — ADR-0006 Phase 3 (unified model) acceptance tests.
//
// The screen no longer forks caregiver vs self-buyer. It is a calm
// welcome with one "Get started" CTA; every new user onboards as
// 'self_buyer' (the self-owning persona the unified constellation home is
// built on). Bar:
//   - Unified welcome headline + body
//   - Single "Get started" CTA that caches account_type='self_buyer' and
//     routes to SignUp
//   - "Sign in" tertiary link routes to SignIn without caching a type
//   - Voice rules still pass
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
  it('renders the unified welcome headline', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByText('Welcome to Leiko')).toBeTruthy();
  });

  it('renders the unified body naming both capabilities', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(
      screen.getByText(
        /Track your own readings and keep an eye on the people you care\s+for/,
      ),
    ).toBeTruthy();
  });

  it('renders a single Get started CTA', () => {
    render(
      withProviders(<AccountTypeForkScreen navigation={makeNav()} route={makeRoute()} />),
    );
    expect(screen.getByTestId('fork-get-started')).toBeTruthy();
    expect(screen.getByText('Get started')).toBeTruthy();
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
  it("Get started caches account_type='self_buyer' (unified) and routes to SignUp", () => {
    const nav = makeNav();
    render(withProviders(<AccountTypeForkScreen navigation={nav} route={makeRoute()} />));

    fireEvent.press(screen.getByTestId('fork-get-started'));

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
