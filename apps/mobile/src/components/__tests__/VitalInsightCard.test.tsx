import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { VitalInsightCard } from '../VitalInsightCard';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

describe('VitalInsightCard', () => {
  it('renders the eyebrow with the vital plain-language name', () => {
    render(
      withTheme(
        <VitalInsightCard
          vital="bp"
          body="Your morning numbers tend to climb roughly 8 points after coffee."
          testID="insight"
        />,
      ),
    );
    expect(screen.getByText(/Leiko · about your blood pressure/i)).toBeTruthy();
  });

  it('renders the body paragraph', () => {
    render(
      withTheme(
        <VitalInsightCard
          vital="hr"
          body="Your resting heart rate has settled three points lower than last month."
          testID="insight"
        />,
      ),
    );
    expect(
      screen.getByText(/resting heart rate has settled three points lower/i),
    ).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(
      withTheme(
        <VitalInsightCard
          vital="sleep"
          body="You spent more time in deep sleep tonight than the seven-night average."
          testID="insight"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
