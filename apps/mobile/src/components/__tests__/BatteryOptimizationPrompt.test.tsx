import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { BatteryOptimizationPrompt } from '../BatteryOptimizationPrompt';

const mockRequest = jest.fn().mockResolvedValue(undefined);
const mockDismiss = jest.fn();
jest.mock('../../hooks/useBatteryOptimizationPrompt', () => ({
  useBatteryOptimizationPrompt: () => ({
    show: true,
    request: mockRequest,
    dismiss: mockDismiss,
  }),
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
  mockRequest.mockClear();
  mockDismiss.mockClear();
});

const FORBIDDEN = [
  'patient',
  'diagnose',
  'diagnosis',
  'treat',
  'cure',
  'predict',
  'prevent',
  'silent killer',
  'dangerous',
  'critical',
];

it('renders the prompt with both CTAs', () => {
  render(withProviders(<BatteryOptimizationPrompt visibleOverride />));
  expect(screen.getByTestId('battery-opt-allow')).toBeTruthy();
  expect(screen.getByTestId('battery-opt-dismiss')).toBeTruthy();
});

it('Allow opens the system dialog and dismisses', () => {
  render(withProviders(<BatteryOptimizationPrompt visibleOverride />));
  fireEvent.press(screen.getByTestId('battery-opt-allow'));
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

it('Not now dismisses without requesting', () => {
  render(withProviders(<BatteryOptimizationPrompt visibleOverride />));
  fireEvent.press(screen.getByTestId('battery-opt-dismiss'));
  expect(mockDismiss).toHaveBeenCalledTimes(1);
  expect(mockRequest).not.toHaveBeenCalled();
});

it('every visible string passes the voice rules', () => {
  render(withProviders(<BatteryOptimizationPrompt visibleOverride />));
  const rendered = JSON.stringify(screen.toJSON()).toLowerCase();
  for (const word of FORBIDDEN) {
    expect(rendered).not.toContain(word);
  }
});
