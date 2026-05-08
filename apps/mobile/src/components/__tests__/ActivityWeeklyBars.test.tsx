// ActivityWeeklyBars — Sprint 8.5.

import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import {
  ActivityWeeklyBars,
  barHeightRatio,
  goalLineFraction,
} from '../ActivityWeeklyBars';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

describe('barHeightRatio + goalLineFraction — pure helpers', () => {
  it('barHeightRatio scales against max(goal*1.5, valuesMax)', () => {
    const values = [4200, 6800, 7900, 5400, 8200, 9100, 2140];
    const goal = 8000;
    // scaleMax = max(12000, 9100) = 12000
    expect(barHeightRatio(0, values, goal)).toBe(0);
    expect(barHeightRatio(12000, values, goal)).toBe(1);
    expect(barHeightRatio(6000, values, goal)).toBeCloseTo(0.5);
    expect(barHeightRatio(15000, values, goal)).toBe(1); // clamps
  });

  it('goalLineFraction returns 1 - goal/scaleMax (top = 0)', () => {
    const values = [4200, 6800, 7900, 5400, 8200, 9100, 2140];
    expect(goalLineFraction(8000, values)).toBeCloseTo(1 - 8000 / 12000);
  });

  it('handles zero-goal gracefully', () => {
    expect(barHeightRatio(0, [], 0)).toBe(0);
    expect(goalLineFraction(0, [])).toBeGreaterThanOrEqual(0);
  });
});

describe('ActivityWeeklyBars — render', () => {
  const days = [4200, 6800, 7900, 5400, 8200, 9100, 2140];
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  it('renders 7 bars + the goal line + the goal label', () => {
    render(
      withTheme(
        <ActivityWeeklyBars
          days={days}
          dayLabels={labels}
          goal={8000}
          testID="weekly"
        />,
      ),
    );
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`weekly-bar-${i}`)).toBeTruthy();
    }
    expect(screen.getByTestId('activity-weekly-bars-goal-line')).toBeTruthy();
    expect(screen.getByText('goal 8k')).toBeTruthy();
  });

  it('renders the section eyebrow "This week vs goal"', () => {
    render(
      withTheme(
        <ActivityWeeklyBars
          days={days}
          dayLabels={labels}
          goal={8000}
          testID="weekly"
        />,
      ),
    );
    expect(screen.getByText('This week vs goal')).toBeTruthy();
  });

  it('matches snapshot in dark mode', () => {
    const { toJSON } = render(
      withTheme(
        <ActivityWeeklyBars
          days={days}
          dayLabels={labels}
          goal={8000}
          testID="weekly"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
