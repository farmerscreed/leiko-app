import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { DetailHeader } from '../DetailHeader';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

describe('DetailHeader — render + interaction', () => {
  it('renders the vital eyebrow label', () => {
    const onBack = jest.fn();
    render(
      withTheme(
        <DetailHeader vital="hr" onBack={onBack} testID="header" />,
      ),
    );
    expect(screen.getByText('HR')).toBeTruthy();
  });

  it('fires onBack when the back button is tapped', () => {
    const onBack = jest.fn();
    render(
      withTheme(
        <DetailHeader vital="bp" onBack={onBack} testID="header" />,
      ),
    );
    fireEvent.press(screen.getByTestId('header-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('disables the menu button when onMenuPress is omitted', () => {
    const onBack = jest.fn();
    render(
      withTheme(
        <DetailHeader vital="sleep" onBack={onBack} testID="header" />,
      ),
    );
    const menu = screen.getByTestId('header-menu');
    expect(menu.props.accessibilityState.disabled).toBe(true);
  });

  it('fires onMenuPress when provided and tapped', () => {
    const onBack = jest.fn();
    const onMenuPress = jest.fn();
    render(
      withTheme(
        <DetailHeader
          vital="activity"
          onBack={onBack}
          onMenuPress={onMenuPress}
          testID="header"
        />,
      ),
    );
    fireEvent.press(screen.getByTestId('header-menu'));
    expect(onMenuPress).toHaveBeenCalledTimes(1);
  });

  it('matches snapshot in dark mode for each vital', () => {
    const { toJSON } = render(
      withTheme(
        <DetailHeader vital="spo2" onBack={() => undefined} testID="header" />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
