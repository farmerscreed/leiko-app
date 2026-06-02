import { type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { HomeTabBar, type HomeTab } from '../HomeTabBar';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver" colorMode="dark">{ui}</ThemeProvider>;
}

describe('HomeTabBar', () => {
  it('renders all five destinations (Home, Trends, +, Learn, Settings)', () => {
    render(withTheme(<HomeTabBar onSelect={jest.fn()} testID="tb" />));
    expect(screen.getByTestId('tb-tab-home')).toBeTruthy();
    expect(screen.getByTestId('tb-tab-trends')).toBeTruthy();
    expect(screen.getByTestId('tb-tab-take_reading')).toBeTruthy();
    expect(screen.getByTestId('tb-tab-learn')).toBeTruthy();
    expect(screen.getByTestId('tb-tab-settings')).toBeTruthy();
  });

  it('fires onSelect with the tapped tab id', () => {
    const onSelect = jest.fn<void, [HomeTab]>();
    render(withTheme(<HomeTabBar onSelect={onSelect} testID="tb" />));
    fireEvent.press(screen.getByTestId('tb-tab-take_reading'));
    expect(onSelect).toHaveBeenCalledWith('take_reading');
    fireEvent.press(screen.getByTestId('tb-tab-trends'));
    expect(onSelect).toHaveBeenCalledWith('trends');
    fireEvent.press(screen.getByTestId('tb-tab-settings'));
    expect(onSelect).toHaveBeenCalledWith('settings');
  });

  it('marks the active tab as selected', () => {
    render(withTheme(<HomeTabBar onSelect={jest.fn()} active="trends" testID="tb" />));
    expect(screen.getByTestId('tb-tab-trends').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('tb-tab-home').props.accessibilityState.selected).toBe(false);
  });
});
