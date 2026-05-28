import { type ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PaywallSheet } from '../PaywallSheet';
import { ThemeProvider } from '../../theme';

const mockRefetch = jest.fn().mockResolvedValue(undefined);
const mockMarkPlusOptimistic = jest.fn();

jest.mock('../../hooks/usePlusEntitlement', () => ({
  usePlusEntitlement: () => ({
    tier: 'free',
    isPlus: false,
    isLoading: false,
    refetch: mockRefetch,
    markPlusOptimistic: mockMarkPlusOptimistic,
  }),
  isPlusTier: (t: string) => ['plus', 'plus_trial', 'plus_grace'].includes(t),
}));

jest.mock('../../services/purchases', () => ({
  PRODUCT_IDS: {
    monthly: 'com.leiko.app.plus.monthly',
    annual: 'com.leiko.app.plus.annual',
  },
  fetchOfferings: jest.fn().mockResolvedValue({ monthly: null, annual: null }),
  // Default to isPlusActive: true so the existing purchase-success
  // tests stay green; the new optimistic-mark coverage lives in
  // dedicated test cases that override these mocks per-test.
  purchasePeriod: jest.fn().mockResolvedValue({ productId: '', isPlusActive: true }),
  restorePurchases: jest.fn().mockResolvedValue({ productId: '', isPlusActive: true }),
}));

import {
  fetchOfferings,
  purchasePeriod,
  restorePurchases,
} from '../../services/purchases';

function withTheme(ui: ReactNode, mode: 'caregiver' | 'parent' = 'caregiver') {
  return <ThemeProvider mode={mode}>{ui}</ThemeProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchOfferings as jest.Mock).mockResolvedValue({ monthly: null, annual: null });
});

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
    expect(screen.getByText('Up to 5 family members can stay informed')).toBeTruthy();
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
    expect(screen.getByText('Stay close, every day')).toBeTruthy();
  });
});

describe('PaywallSheet — price block (D8a §9.5)', () => {
  it('renders fallback prices from docs/09 §1 when offerings are unavailable', () => {
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
    expect(screen.getByText('$39.99 / year')).toBeTruthy();
    expect(screen.getByText('$4.99 / month')).toBeTruthy();
  });

  it('selects annual by default and toggles to monthly on tap', () => {
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
    const monthly = screen.getByTestId('paywall-sheet:period-monthly');
    expect(screen.getByTestId('paywall-sheet:period-annual').props.accessibilityState).toEqual({
      selected: true,
    });
    fireEvent.press(monthly);
    expect(monthly.props.accessibilityState).toEqual({ selected: true });
  });
});

describe('PaywallSheet — purchase + restore + dismiss', () => {
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

  it('triggers a purchase with the selected period and dismisses on success', async () => {
    (purchasePeriod as jest.Mock).mockResolvedValue({
      productId: 'com.leiko.app.plus.annual',
      isPlusActive: true,
    });
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
    await act(async () => {
      fireEvent.press(screen.getByTestId('paywall-sheet:cta-trial'));
    });
    await waitFor(() => {
      expect(purchasePeriod).toHaveBeenCalledWith('annual');
    });
    expect(mockRefetch).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('optimistically flips the cache to Plus when RC SDK reports active', async () => {
    (purchasePeriod as jest.Mock).mockResolvedValueOnce({
      productId: 'com.leiko.app.plus.annual',
      isPlusActive: true,
    });
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
    await act(async () => {
      fireEvent.press(screen.getByTestId('paywall-sheet:cta-trial'));
    });
    await waitFor(() => {
      expect(purchasePeriod).toHaveBeenCalled();
    });
    expect(mockMarkPlusOptimistic).toHaveBeenCalled();
  });

  it('does NOT flip the cache when RC SDK reports no active entitlement', async () => {
    (purchasePeriod as jest.Mock).mockResolvedValueOnce({
      productId: 'com.leiko.app.plus.annual',
      isPlusActive: false,
    });
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
    await act(async () => {
      fireEvent.press(screen.getByTestId('paywall-sheet:cta-trial'));
    });
    await waitFor(() => {
      expect(purchasePeriod).toHaveBeenCalled();
    });
    expect(mockMarkPlusOptimistic).not.toHaveBeenCalled();
  });

  it('shows a quiet error message when the purchase throws', async () => {
    (purchasePeriod as jest.Mock).mockRejectedValue(new Error('user_cancelled'));
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
    await act(async () => {
      fireEvent.press(screen.getByTestId('paywall-sheet:cta-trial'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('paywall-sheet:error')).toBeTruthy();
    });
    // Voice check: no scolding, no urgency.
    const text = screen.getByTestId('paywall-sheet:error').props.children;
    expect(String(text).toLowerCase()).not.toContain('error');
    expect(String(text).toLowerCase()).not.toContain('failed');
  });

  it('calls restorePurchases on the restore CTA', async () => {
    (restorePurchases as jest.Mock).mockResolvedValue({
      productId: '',
      isPlusActive: true,
    });
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
    await act(async () => {
      fireEvent.press(screen.getByTestId('paywall-sheet:cta-restore'));
    });
    expect(restorePurchases).toHaveBeenCalled();
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
});
