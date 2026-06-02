import { type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { CareInviteSheet } from '../CareInviteSheet';

const mockCreateConnect = jest.fn();
jest.mock('../../services/families/manageInvites', () => ({
  createConnect: (...args: unknown[]) => mockCreateConnect(...args),
}));

function withProviders(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, bottom: 34, left: 0, right: 0 },
      }}
    >
      <ThemeProvider mode="caregiver">{ui}</ThemeProvider>
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockCreateConnect.mockReset();
});

describe('CareInviteSheet', () => {
  it('renders the email form when opened', () => {
    render(withProviders(<CareInviteSheet visible onDismiss={jest.fn()} />));
    expect(screen.getByTestId('care-invite-email-input')).toBeTruthy();
    expect(screen.getByTestId('care-invite-send')).toBeTruthy();
  });

  it('validates the email before sending', async () => {
    render(withProviders(<CareInviteSheet visible onDismiss={jest.fn()} />));
    fireEvent.changeText(screen.getByTestId('care-invite-email-input'), 'not-an-email');
    await act(async () => {
      fireEvent.press(screen.getByTestId('care-invite-send'));
    });
    expect(screen.getByTestId('care-invite-error')).toBeTruthy();
    expect(mockCreateConnect).not.toHaveBeenCalled();
  });

  it('sends a pending invite and surfaces the code to share', async () => {
    mockCreateConnect.mockResolvedValue({
      invitationId: 'inv-1',
      pairingCode: '246810',
      urlToken: 'tok-abc',
      expiresAt: '2026-06-10T00:00:00Z',
      emailSent: true,
    });
    render(withProviders(<CareInviteSheet visible onDismiss={jest.fn()} />));
    fireEvent.changeText(screen.getByTestId('care-invite-email-input'), 'mum@example.com');
    await act(async () => {
      fireEvent.press(screen.getByTestId('care-invite-send'));
    });
    await waitFor(() => {
      expect(mockCreateConnect).toHaveBeenCalledWith({ inviteeEmail: 'mum@example.com' });
    });
    expect(screen.getByTestId('care-invite-code')).toBeTruthy();
    expect(screen.getByText('246810')).toBeTruthy();
    expect(screen.getByTestId('care-invite-share')).toBeTruthy();
  });

  it('surfaces a friendly error when the send fails', async () => {
    mockCreateConnect.mockRejectedValue(new Error('boom'));
    render(withProviders(<CareInviteSheet visible onDismiss={jest.fn()} />));
    fireEvent.changeText(screen.getByTestId('care-invite-email-input'), 'mum@example.com');
    await act(async () => {
      fireEvent.press(screen.getByTestId('care-invite-send'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('care-invite-error')).toBeTruthy();
    });
  });
});
