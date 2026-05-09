// Permission prompt tests — Sprint 9.5 / Task 8.
//
// Coverage:
//   • Caregiver account_type → null (component renders nothing)
//   • Self-buyer + not-yet-prompted → bottom sheet visible with copy
//   • Already prompted → null (no re-render)
//   • Connect → requestPermissions called, master + per-vital toggles
//     flipped to match the granted shape, prompted=true
//   • Maybe later → prompted=true with no permission request
//   • Voice rules: no forbidden words in any visible string

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { HealthPlatformPermissionPrompt } from '../HealthPlatformPermissionPrompt';
import {
  __reset as resetMockAdapter,
  mockAdapter,
} from '../../services/health-platform/adapters/mock';
import {
  __setAdapterForTest,
  __resetAdapterForTest,
} from '../../services/health-platform';
import {
  __resetForTest as resetToggles,
  getToggles,
} from '../../services/health-platform/toggles';
import {
  __resetForTest as resetPrompt,
  hasBeenPrompted,
  markPrompted,
} from '../../services/health-platform/permissionPrompt';
import { useAuth } from '../../state/auth';
import type { AccountType, UserRow } from '../../types/database';

function withTheme(ui: React.ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

function setAccountType(kind: AccountType | null): void {
  if (kind === null) {
    useAuth.setState({ profile: null, status: 'unauthenticated' });
    return;
  }
  const profile: UserRow = {
    id: 'u',
    email: 'u@test.local',
    display_name: 'U',
    photo_url: null,
    preferred_language: 'en',
    timezone: 'UTC',
    year_of_birth: 1980,
    account_type: kind,
    marketing_opt_in: false,
    gender: null,
    height_cm: null,
    weight_kg: null,
    hypertension_status: null,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  useAuth.setState({ profile, status: 'authenticated' });
}

beforeEach(() => {
  resetMockAdapter();
  __setAdapterForTest(mockAdapter);
  resetToggles();
  resetPrompt();
  setAccountType(null);
});

afterAll(() => {
  __resetAdapterForTest();
  setAccountType(null);
});

describe('HealthPlatformPermissionPrompt — gating', () => {
  it('renders nothing for caregiver account_type', () => {
    setAccountType('caregiver');
    render(withTheme(<HealthPlatformPermissionPrompt />));
    expect(screen.queryByTestId('health-platform-permission-prompt')).toBeNull();
  });

  it('renders the prompt for self_buyer when not yet prompted', () => {
    setAccountType('self_buyer');
    render(withTheme(<HealthPlatformPermissionPrompt />));
    expect(screen.getByTestId('health-platform-permission-prompt')).toBeTruthy();
    expect(screen.getByText('Keep your numbers in one place')).toBeTruthy();
  });

  it('renders the prompt for parent when not yet prompted', () => {
    setAccountType('parent');
    render(withTheme(<HealthPlatformPermissionPrompt />));
    expect(screen.getByTestId('health-platform-permission-prompt')).toBeTruthy();
  });

  it('renders nothing once prompted=true (set via the store)', () => {
    setAccountType('self_buyer');
    // Mark as prompted before rendering.
    markPrompted();
    render(withTheme(<HealthPlatformPermissionPrompt />));
    expect(screen.queryByText('Keep your numbers in one place')).toBeNull();
  });
});

describe('HealthPlatformPermissionPrompt — Connect CTA', () => {
  it('flips master + per-vital toggles to match granted permissions, marks prompted', async () => {
    setAccountType('self_buyer');
    render(withTheme(<HealthPlatformPermissionPrompt />));

    const connect = screen.getByTestId('health-platform-permission-connect');
    fireEvent.press(connect);

    await waitFor(() => expect(hasBeenPrompted()).toBe(true));
    const toggles = getToggles();
    expect(toggles.master).toBe(true);
    expect(toggles.perVitalWrite.bp).toBe(true);
    expect(toggles.perVitalWrite.hr).toBe(true);
    expect(toggles.perVitalRead.weight).toBe(true);
    expect(toggles.perVitalRead.blood_glucose).toBe(true);
  });
});

describe('HealthPlatformPermissionPrompt — Maybe later CTA', () => {
  it('marks prompted=true without enabling any toggle', async () => {
    setAccountType('self_buyer');
    render(withTheme(<HealthPlatformPermissionPrompt />));

    const dismiss = screen.getByTestId('health-platform-permission-dismiss');
    fireEvent.press(dismiss);

    await waitFor(() => expect(hasBeenPrompted()).toBe(true));
    const toggles = getToggles();
    expect(toggles.master).toBe(false);
    expect(toggles.perVitalWrite.bp).toBe(false);
    expect(toggles.perVitalRead.weight).toBe(false);
  });
});

describe('HealthPlatformPermissionPrompt — voice rules', () => {
  // Per CLAUDE.md docs/05-voice-and-claims.md: no "patient", no
  // "diagnose", no "predict", no "dangerous", no "critical", no
  // "silent killer". We snapshot the rendered text and assert.
  const FORBIDDEN = [
    'patient',
    'diagnose',
    'diagnosis',
    'diagnostic',
    'treat',
    'treatment',
    'cure',
    'predict',
    'silent killer',
    'ticking time bomb',
    'dangerous',
    'critical',
    'medical advice',
  ];

  it('every visible string is voice-rule clean', () => {
    setAccountType('self_buyer');
    render(withTheme(<HealthPlatformPermissionPrompt />));
    // queryAllByText uses substring/regex matching to scan the rendered
    // Text nodes for any forbidden word. Bottom sheet renders the title
    // string as well so the scan covers both header + body copy.
    for (const word of FORBIDDEN) {
      const matches = screen.queryAllByText(new RegExp(word, 'i'));
      expect(matches).toEqual([]);
    }
  });
});
