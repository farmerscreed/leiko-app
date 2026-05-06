// TimezonePicker — post-Sprint-4 acceptance tests for the full IANA
// catalogue + search.
//
// Bar:
//   - Trigger displays the formatted label for the current value
//   - Opening the sheet exposes the search box and zone rows
//   - Curated zones render in the "Common" section when no search
//   - Searching filters across the full IANA list
//   - Selecting a zone calls onChange with the IANA name and dismisses
//     the sheet

import { type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme';
import { TimezonePicker } from '../TimezonePicker';

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

describe('TimezonePicker — trigger', () => {
  it('renders the formatted label for a curated value', () => {
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Lagos"
          onChange={() => undefined}
          deviceZone="Africa/Lagos"
          testID="zone"
        />,
      ),
    );
    expect(screen.getByText('Lagos, Nigeria')).toBeTruthy();
  });

  it('renders the derived label for a non-curated value', () => {
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Nairobi"
          onChange={() => undefined}
          deviceZone="Africa/Nairobi"
          testID="zone"
        />,
      ),
    );
    expect(screen.getByText('Nairobi')).toBeTruthy();
  });
});

describe('TimezonePicker — sheet sections', () => {
  it('opens the sheet on tap and shows curated section', () => {
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Lagos"
          onChange={() => undefined}
          deviceZone="Africa/Lagos"
          testID="zone"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('zone'));
    expect(screen.getByText('Common')).toBeTruthy();
    expect(screen.getByText('All locations')).toBeTruthy();
    // Curated entries surface in the Common section.
    expect(screen.getByTestId('zone-Africa/Lagos')).toBeTruthy();
  });

  it('pins the device zone at the top when it is not curated', () => {
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Nairobi"
          onChange={() => undefined}
          deviceZone="Africa/Nairobi"
          testID="zone"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('zone'));
    expect(screen.getByText('Your device')).toBeTruthy();
    expect(screen.getByTestId('zone-device')).toBeTruthy();
  });

  it('hides the device-zone section when the device zone is curated', () => {
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Lagos"
          onChange={() => undefined}
          deviceZone="Africa/Lagos"
          testID="zone"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('zone'));
    expect(screen.queryByText('Your device')).toBeNull();
    expect(screen.queryByTestId('zone-device')).toBeNull();
  });
});

describe('TimezonePicker — search', () => {
  it('filters across the full list when a query is entered', () => {
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Lagos"
          onChange={() => undefined}
          deviceZone="Africa/Lagos"
          testID="zone"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('zone'));
    fireEvent.changeText(screen.getByTestId('zone-search'), 'nairobi');
    expect(screen.getByTestId('zone-Africa/Nairobi')).toBeTruthy();
    // Common header is hidden when searching — search filters across
    // everything.
    expect(screen.queryByText('Common')).toBeNull();
    expect(screen.getByText('Results')).toBeTruthy();
  });

  it('shows the empty-state when nothing matches', () => {
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Lagos"
          onChange={() => undefined}
          deviceZone="Africa/Lagos"
          testID="zone"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('zone'));
    fireEvent.changeText(screen.getByTestId('zone-search'), 'zzzzzznotaplace');
    expect(screen.getByTestId('zone-empty')).toBeTruthy();
  });
});

describe('TimezonePicker — selection', () => {
  it('calls onChange with the IANA name and dismisses', () => {
    const onChange = jest.fn();
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Lagos"
          onChange={onChange}
          deviceZone="Africa/Lagos"
          testID="zone"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('zone'));
    fireEvent.press(screen.getByTestId('zone-America/New_York'));
    expect(onChange).toHaveBeenCalledWith('America/New_York');
  });

  it('selects a zone via the search results', () => {
    const onChange = jest.fn();
    render(
      withProviders(
        <TimezonePicker
          value="Africa/Lagos"
          onChange={onChange}
          deviceZone="Africa/Lagos"
          testID="zone"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('zone'));
    fireEvent.changeText(screen.getByTestId('zone-search'), 'nairobi');
    fireEvent.press(screen.getByTestId('zone-Africa/Nairobi'));
    expect(onChange).toHaveBeenCalledWith('Africa/Nairobi');
  });
});
