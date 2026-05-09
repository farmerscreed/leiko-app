// SettingsScreen — Sprint 10b.1 integration tests.
//
// Covers:
//   • Profile section renders for both account types; hypertension chip
//     is self-buyer only (D8a §10.1).
//   • Watch section preserves the Sprint 5 paired vs empty branches +
//     the Forget sheet.
//   • About section renders version + opens external URLs via Linking.
//   • Sign-out flow opens a dignified sheet (no guilt copy) and routes
//     through useAuth.signOut.
//
// Mocks the data hooks at the boundary so this stays a screen test, not
// a data test. updateProfile is mocked to assert hypertension writes.

import { type ReactNode } from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { SettingsScreen } from '../SettingsScreen';
import type { UserRow } from '../../../types/database';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue(undefined);
const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);
const mockForget = jest.fn().mockResolvedValue(undefined);
const mockUpdateProfile = jest.fn().mockResolvedValue({} as UserRow);

let mockProfile: UserRow | null = null;
let mockPairedDevice: { bleId: string; name: string | null; macSuffix: string; pairedAt: number } | null = null;

jest.mock('../../../state/auth', () => ({
  useAuth: (selector?: (s: unknown) => unknown) => {
    const state = {
      profile: mockProfile,
      refreshProfile: mockRefreshProfile,
      signOut: mockSignOut,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('../../../state/pairing', () => ({
  usePairing: (selector?: (s: unknown) => unknown) => {
    const state = {
      pairedDevice: mockPairedDevice,
      forget: mockForget,
    };
    return selector ? selector(state) : state;
  },
}));

jest.mock('../../../services/users/updateProfile', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

const linkingSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

function makeProfile(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-1',
    email: 'biebele@gmail.com',
    display_name: 'Adaeze Okafor',
    photo_url: null,
    preferred_language: 'en',
    timezone: 'Africa/Lagos',
    year_of_birth: 1985,
    account_type: 'caregiver',
    marketing_opt_in: false,
    gender: null,
    height_cm: null,
    weight_kg: null,
    hypertension_status: null,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderScreen(): ReturnType<typeof render> {
  const navigation = { goBack: mockGoBack, navigate: mockNavigate } as unknown as {
    goBack: () => void;
    navigate: (route: string) => void;
  };
  const wrap = (node: ReactNode) =>
    (
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
        <ThemeProvider mode="caregiver">{node}</ThemeProvider>
      </SafeAreaProvider>
    );
  return render(
    wrap(
      <SettingsScreen
        navigation={navigation}
      />,
    ),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = makeProfile();
  mockPairedDevice = null;
});

describe('<SettingsScreen /> — Profile', () => {
  it('renders the four profile data rows for a caregiver', () => {
    renderScreen();
    expect(screen.getByTestId('settings-profile-name')).toBeTruthy();
    expect(screen.getByTestId('settings-profile-photo')).toBeTruthy();
    expect(screen.getByTestId('settings-profile-timezone')).toBeTruthy();
    expect(screen.getByTestId('settings-profile-yob')).toBeTruthy();
    // Hypertension chip is self-buyer only.
    expect(screen.queryByTestId('settings-profile-hypertension')).toBeNull();
  });

  it('renders the hypertension chip only for self-buyers', () => {
    mockProfile = makeProfile({ account_type: 'self_buyer' });
    renderScreen();
    expect(screen.getByTestId('settings-profile-hypertension')).toBeTruthy();
  });

  it('writes the new hypertension status on chip select', async () => {
    mockProfile = makeProfile({ account_type: 'self_buyer' });
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-profile-hypertension'));
    expect(screen.getByTestId('settings-hypertension-yes')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-hypertension-yes'));
    });
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', {
        hypertension_status: 'yes',
      });
    });
    expect(mockRefreshProfile).toHaveBeenCalled();
  });
});

describe('<SettingsScreen /> — Watch', () => {
  it('shows the empty state + pair CTA when no device is paired', () => {
    mockPairedDevice = null;
    renderScreen();
    expect(screen.getByTestId('settings-watch-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-watch-pair-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('Pairing');
  });

  it('shows the paired card and last-sync row when a device is paired', () => {
    mockPairedDevice = {
      bleId: 'AA:BB:CC:DD:EE:FF',
      name: 'Leiko U16PRO',
      macSuffix: 'EEFF',
      pairedAt: Date.now(),
    };
    renderScreen();
    expect(screen.getByTestId('settings-watch-paired')).toBeTruthy();
    expect(screen.getByTestId('settings-watch-last-sync')).toBeTruthy();
  });

  it('opens the Forget sheet and routes through pairing.forget on confirm', async () => {
    mockPairedDevice = {
      bleId: 'AA:BB:CC:DD:EE:FF',
      name: 'Leiko U16PRO',
      macSuffix: 'EEFF',
      pairedAt: Date.now(),
    };
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-watch-forget'));
    expect(screen.getByTestId('settings-forget-confirm')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-forget-confirm'));
    });
    await waitFor(() => {
      expect(mockForget).toHaveBeenCalledTimes(1);
    });
  });
});

describe('<SettingsScreen /> — About', () => {
  it('renders the version row + opens terms / privacy / help via Linking', () => {
    renderScreen();
    expect(screen.getByTestId('settings-about-version')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-about-terms'));
    expect(linkingSpy).toHaveBeenCalledWith('https://leiko.app/terms');
    fireEvent.press(screen.getByTestId('settings-about-privacy'));
    expect(linkingSpy).toHaveBeenCalledWith('https://leiko.app/privacy');
    fireEvent.press(screen.getByTestId('settings-about-help'));
    expect(linkingSpy).toHaveBeenCalledWith('mailto:support@leiko.app');
  });
});

describe('<SettingsScreen /> — Sign out', () => {
  it('opens a dignified sign-out sheet and signs out on confirm', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-account-signout'));
    expect(screen.getByTestId('settings-signout-confirm')).toBeTruthy();
    // Voice check: no guilt copy.
    expect(screen.queryByText(/are you sure/i)).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-signout-confirm'));
    });
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it('cancels cleanly via "Stay signed in"', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-account-signout'));
    fireEvent.press(screen.getByTestId('settings-signout-cancel'));
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('<SettingsScreen /> — voice rules', () => {
  it.each([
    'Settings',
    'Profile',
    'Watch',
    'About',
    'Account',
    'Sign out',
    'Help',
    'Terms of service',
    'Privacy policy',
  ])('renders voice-rule clean string: %s', (text) => {
    renderScreen();
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });
});
