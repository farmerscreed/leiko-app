import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme';
import { DetailShell } from '../DetailShell';

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

describe('DetailShell', () => {
  it('renders the hero slot + children', () => {
    render(
      withProviders(
        <DetailShell
          vital="bp"
          onBack={() => undefined}
          hero={<Text>HERO_SLOT</Text>}
          testID="shell"
        >
          <Text>BODY_CHILDREN</Text>
        </DetailShell>,
      ),
    );
    expect(screen.getByText('HERO_SLOT')).toBeTruthy();
    expect(screen.getByText('BODY_CHILDREN')).toBeTruthy();
  });

  it('routes back-button taps via the embedded DetailHeader', () => {
    const onBack = jest.fn();
    render(
      withProviders(
        <DetailShell
          vital="hr"
          onBack={onBack}
          hero={<Text>hero</Text>}
          testID="shell"
        >
          <Text>body</Text>
        </DetailShell>,
      ),
    );
    fireEvent.press(screen.getByTestId('shell-header-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('emits onRangeChange when the range pill is tapped', () => {
    const onRangeChange = jest.fn();
    render(
      withProviders(
        <DetailShell
          vital="sleep"
          onBack={() => undefined}
          hero={<Text>hero</Text>}
          onRangeChange={onRangeChange}
          testID="shell"
        >
          <Text>body</Text>
        </DetailShell>,
      ),
    );
    fireEvent.press(screen.getByTestId('shell-range-30d'));
    expect(onRangeChange).toHaveBeenCalledWith('30d');
  });

  it('honours initialRange', () => {
    render(
      withProviders(
        <DetailShell
          vital="activity"
          onBack={() => undefined}
          hero={<Text>hero</Text>}
          initialRange="90d"
          testID="shell"
        >
          <Text>body</Text>
        </DetailShell>,
      ),
    );
    const seg = screen.getByTestId('shell-range-90d');
    expect(seg.props.accessibilityState.selected).toBe(true);
  });
});
