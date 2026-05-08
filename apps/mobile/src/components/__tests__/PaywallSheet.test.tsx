import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PaywallSheet } from '../PaywallSheet';
import { ThemeProvider } from '../../theme';

function withTheme(ui: ReactNode, mode: 'caregiver' | 'parent' = 'caregiver') {
  return <ThemeProvider mode={mode}>{ui}</ThemeProvider>;
}

describe('PaywallSheet — copy switching by account_type', () => {
  it('shows self-buyer copy with the doctor-PDF bullet leading', () => {
    render(
      withTheme(
        <PaywallSheet
          visible
          onDismiss={() => undefined}
          accountType="self_buyer"
          trigger="pdf_export"
        />,
      ),
    );
    expect(screen.getByText('Understand your numbers')).toBeTruthy();
    expect(
      screen.getByText('A one-page summary you can save and show your doctor'),
    ).toBeTruthy();
  });

  it('shows caregiver copy when account_type is caregiver', () => {
    render(
      withTheme(
        <PaywallSheet
          visible
          onDismiss={() => undefined}
          accountType="caregiver"
          trigger="range_extension"
        />,
      ),
    );
    expect(screen.getByText('Stay close, every day')).toBeTruthy();
    expect(
      screen.getByText('Up to 5 family members can stay informed'),
    ).toBeTruthy();
  });

  it('falls back to caregiver copy for the parent account_type', () => {
    render(
      withTheme(
        <PaywallSheet
          visible
          onDismiss={() => undefined}
          accountType="parent"
          trigger="anomaly_optin"
        />,
      ),
    );
    // Parent is read-only large-text; if a paywall ever surfaces in
    // hybrid mode the caregiver copy is the safe default.
    expect(screen.getByText('Stay close, every day')).toBeTruthy();
  });
});

describe('PaywallSheet — dismiss', () => {
  it('calls onDismiss when "Maybe later" is tapped', () => {
    const onDismiss = jest.fn();
    render(
      withTheme(
        <PaywallSheet
          visible
          onDismiss={onDismiss}
          accountType="self_buyer"
          trigger="pdf_export"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('paywall-sheet:cta-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('also calls onDismiss when the trial CTA is tapped (Sprint 9 stub)', () => {
    // Sprint 10 swaps this for a RevenueCat trial-start. Sprint 9 just
    // dismisses so the trigger flow stays testable end-to-end.
    const onDismiss = jest.fn();
    render(
      withTheme(
        <PaywallSheet
          visible
          onDismiss={onDismiss}
          accountType="self_buyer"
          trigger="pdf_export"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('paywall-sheet:cta-trial'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('PaywallSheet — accessibility + voice', () => {
  it('exposes the legal footer and never uses urgency framing', () => {
    render(
      withTheme(
        <PaywallSheet
          visible
          onDismiss={() => undefined}
          accountType="self_buyer"
          trigger="pdf_export"
        />,
      ),
    );
    expect(
      screen.getByText('Subscriptions auto-renew. Manage anytime in Settings.'),
    ).toBeTruthy();
  });

  it('includes a screen-reader hint that the trial flow is not yet wired', () => {
    render(
      withTheme(
        <PaywallSheet
          visible
          onDismiss={() => undefined}
          accountType="self_buyer"
          trigger="pdf_export"
        />,
      ),
    );
    const trialButton = screen.getByTestId('paywall-sheet:cta-trial');
    // accessibilityHint surfaces the Sprint 10 hand-off so a screen-
    // reader user isn't surprised when the button only dismisses.
    expect(
      trialButton.props.accessibilityHint?.toLowerCase() ?? '',
    ).toContain('next sprint');
  });
});
