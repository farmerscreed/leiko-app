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

// Sprint 10b.2 — Settings now reads usePlusEntitlement (TanStack Query
// against families) + the AI quota service. Stub the entitlement hook
// to a free user so the AI section renders the free-tier copy.
jest.mock('../../../hooks/usePlusEntitlement', () => ({
  usePlusEntitlement: () => ({
    tier: 'free',
    isPlus: false,
    isLoading: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  }),
  isPlusTier: (t: string) => ['plus', 'plus_trial', 'plus_grace'].includes(t),
}));

jest.mock('../../../services/ai/quotaCounter', () => ({
  getQuotaSnapshot: () => ({
    count: 0,
    limit: 5,
    monthKey: '2026-05',
    lastReconcileMs: null,
  }),
  reconcileFromAuditLog: jest.fn().mockResolvedValue(0),
  FREE_TIER_QUOTA: 5,
  PLUS_TIER_QUOTA: 100,
  quotaForTier: (t: string) =>
    ['plus', 'plus_trial', 'plus_grace'].includes(t) ? 100 : 5,
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

describe('<SettingsScreen /> — Vital streams + Goals (Sprint 10b.2)', () => {
  beforeEach(() => {
    // Reset the vitalSetup store between tests so toggles start at defaults.
    jest.requireActual('../../../state/vitalSetup').useVitalSetup.getState().__resetForTest();
  });

  it('renders the auto-HR + auto-SpO2 toggles', () => {
    renderScreen();
    expect(screen.getByTestId('settings-vitals-auto-hr')).toBeTruthy();
    expect(screen.getByTestId('settings-vitals-auto-spo2')).toBeTruthy();
  });

  it('renders the steps + sleep targets and opens the picker', () => {
    renderScreen();
    expect(screen.getByTestId('settings-goals-steps')).toBeTruthy();
    expect(screen.getByTestId('settings-goals-sleep')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-goals-steps'));
    expect(screen.getByTestId('settings-steps-option-6000')).toBeTruthy();
  });

  it('writes a new steps target on selection', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-goals-steps'));
    fireEvent.press(screen.getByTestId('settings-steps-option-8000'));
    const after = jest.requireActual('../../../state/vitalSetup').getVitalSetup();
    expect(after.stepsTarget).toBe(8000);
    expect(after.dirty).toBe(true);
  });
});

describe('<SettingsScreen /> — Apple Health / Health Connect (Sprint 10b.2)', () => {
  beforeEach(() => {
    // Reset toggles store between tests.
    jest.requireActual('../../../services/health-platform/toggles').__resetForTest();
  });

  it('hides the section for caregivers', () => {
    mockProfile = makeProfile({ account_type: 'caregiver' });
    renderScreen();
    expect(screen.queryByTestId('settings-section-health-platform')).toBeNull();
  });

  it('renders the master toggle for self-buyers; per-vital rows hidden when master is OFF', () => {
    mockProfile = makeProfile({ account_type: 'self_buyer' });
    renderScreen();
    expect(screen.getByTestId('settings-hp-master')).toBeTruthy();
    expect(screen.queryByTestId('settings-hp-write-bp')).toBeNull();
  });

  it('reveals per-vital toggles when master flips on', () => {
    mockProfile = makeProfile({ account_type: 'self_buyer' });
    // Flip the store directly — RN Switch's value-change event is
    // wrapped inside ListRow and not directly fireable; bypassing the
    // wrapper is fine because we're asserting the screen's reaction
    // to store state, not the wrapper's plumbing (covered by ListRow's
    // own tests).
    jest
      .requireActual('../../../services/health-platform/toggles')
      .setMaster(true);
    renderScreen();
    expect(screen.getByTestId('settings-hp-write-bp')).toBeTruthy();
    expect(screen.getByTestId('settings-hp-read-weight')).toBeTruthy();
  });
});

describe('<SettingsScreen /> — AI section (Sprint 10b.2)', () => {
  it('renders the quota counter and tier explainer', () => {
    renderScreen();
    expect(screen.getByTestId('settings-ai-quota')).toBeTruthy();
    expect(screen.getByTestId('settings-ai-tier')).toBeTruthy();
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
