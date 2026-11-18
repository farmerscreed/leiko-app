import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { ActivityHourlyBars, composeHourlyAccessibilityLabel } from '../ActivityHourlyBars';

const hours = (pairs: Record<number, number>) =>
  Array.from({ length: 24 }, (_, h) => pairs[h] ?? 0);

describe('ActivityHourlyBars', () => {
  it('renders 24 bars and an accessible summary naming the busiest hour', () => {
    const hourly = hours({ 7: 300, 9: 1200, 13: 500 });
    render(
      <ThemeProvider>
        <ActivityHourlyBars hourly={hourly} totalSteps={2000} currentHour={14} testID="hb" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('hb-bar-0', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('hb-bar-23', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText(/Busiest hour 09:00 with 1,200 steps/)).toBeTruthy();
  });

  it('says how many steps could not be placed in an hour', () => {
    render(
      <ThemeProvider>
        <ActivityHourlyBars hourly={hours({ 10: 400 })} totalSteps={1400} currentHour={11} testID="hb" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('hb-unplaced').props.children).toMatch(/^1,000 steps from before/);
  });

  it('omits the caption when every step is placed', () => {
    render(
      <ThemeProvider>
        <ActivityHourlyBars hourly={hours({ 10: 400 })} totalSteps={400} currentHour={11} testID="hb" />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('hb-unplaced')).toBeNull();
  });

  it('describes an empty day plainly', () => {
    expect(composeHourlyAccessibilityLabel(hours({}), 0, 'Today by hour')).toBe(
      'Today by hour. No steps placed in an hour yet today.',
    );
  });
});
