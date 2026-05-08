import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { RecentReadingsSection } from '../RecentReadingsSection';
import type { RecentReading } from '../RecentReadingsList';

function withProviders(ui: ReactNode) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 360, height: 720 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider mode="caregiver" colorMode="dark">
        {ui}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function makeReadings(n: number): RecentReading[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r-${i}`,
    value: `${120 + i}/${78 + i}`,
    context: i === 0 ? 'Just now · resting' : 'Earlier today',
    time: i === 0 ? 'now' : `${i}h ago`,
  }));
}

describe('RecentReadingsSection — default behaviour', () => {
  it('renders the eyebrow + the first defaultCount rows', () => {
    render(
      withProviders(
        <RecentReadingsSection
          vital="bp"
          eyebrow="Today's readings"
          readings={makeReadings(20)}
          testID="readings"
        />,
      ),
    );
    expect(screen.getByText("Today's readings")).toBeTruthy();
    // 5 default rows visible.
    expect(screen.getByText('120/78')).toBeTruthy();
    expect(screen.getByText('124/82')).toBeTruthy();
    // Row at index 5 is NOT yet visible.
    expect(screen.queryByText('125/83')).toBeNull();
  });

  it('hides the footer when total <= defaultCount', () => {
    render(
      withProviders(
        <RecentReadingsSection
          vital="bp"
          eyebrow="Today's readings"
          readings={makeReadings(3)}
          testID="readings"
        />,
      ),
    );
    expect(screen.queryByTestId('readings-footer')).toBeNull();
  });

  it('shows the footer when total > defaultCount', () => {
    render(
      withProviders(
        <RecentReadingsSection
          vital="bp"
          eyebrow="Today's readings"
          readings={makeReadings(20)}
          testID="readings"
        />,
      ),
    );
    expect(screen.getByTestId('readings-footer')).toBeTruthy();
    expect(screen.getByText('Show more · 5 of 20')).toBeTruthy();
  });
});

describe('RecentReadingsSection — picker', () => {
  it('opens the picker when the footer is tapped', () => {
    render(
      withProviders(
        <RecentReadingsSection
          vital="bp"
          eyebrow="Today's readings"
          readings={makeReadings(50)}
          testID="readings"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('readings-footer'));
    expect(screen.getByText('Pick how many recent readings to load.')).toBeTruthy();
  });

  it('changes visible count when a picker option is selected', () => {
    render(
      withProviders(
        <RecentReadingsSection
          vital="bp"
          eyebrow="Today's readings"
          readings={makeReadings(50)}
          testID="readings"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('readings-footer'));
    fireEvent.press(screen.getByTestId('readings-option-20'));
    // After picking 20, the 6th row (index 5) becomes visible.
    expect(screen.getByText('125/83')).toBeTruthy();
    // Footer label updates.
    expect(screen.getByText('Show more · 20 of 50')).toBeTruthy();
  });

  it('"All" option resolves to readings.length', () => {
    render(
      withProviders(
        <RecentReadingsSection
          vital="bp"
          eyebrow="Today's readings"
          readings={makeReadings(7)}
          testID="readings"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('readings-footer'));
    fireEvent.press(screen.getByTestId('readings-option-all'));
    expect(screen.getByText('Showing all 7 · change')).toBeTruthy();
  });
});

describe('RecentReadingsSection — interaction', () => {
  it('forwards row taps to onSelect', () => {
    const onSelect = jest.fn();
    const readings = makeReadings(3);
    render(
      withProviders(
        <RecentReadingsSection
          vital="bp"
          eyebrow="Today's readings"
          readings={readings}
          onSelect={onSelect}
          testID="readings"
        />,
      ),
    );
    // Row testIDs come from the inner RecentReadingsList: `${testID}-list-row-${id}`.
    fireEvent.press(screen.getByTestId('readings-list-row-r-0'));
    expect(onSelect).toHaveBeenCalledWith(readings[0]);
  });
});
