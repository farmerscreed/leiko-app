import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { VitalHero } from '../VitalHero';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

describe('VitalHero — render', () => {
  it('renders primary + sub + range when provided', () => {
    render(
      withTheme(
        <VitalHero
          vital="bp"
          primary="122"
          secondary="/ 78"
          sub="Latest · 6:42 am"
          range="mmHg · within your range"
          ringFill={0.74}
          testID="hero"
        />,
      ),
    );
    expect(screen.getByText('122')).toBeTruthy();
    expect(screen.getByText('/ 78')).toBeTruthy();
    expect(screen.getByText('Latest · 6:42 am')).toBeTruthy();
    expect(screen.getByText('mmHg · within your range')).toBeTruthy();
  });

  it('omits the live pill when livePulse is falsy', () => {
    render(
      withTheme(
        <VitalHero
          vital="hr"
          primary="64"
          sub="Now · resting"
          ringFill={0.55}
          testID="hero"
        />,
      ),
    );
    expect(screen.queryByTestId('hero-live-pill')).toBeNull();
  });

  it('renders the live pill when livePulse is true', () => {
    render(
      withTheme(
        <VitalHero
          vital="hr"
          primary="64"
          sub="Now · resting"
          ringFill={0.55}
          livePulse
          testID="hero"
        />,
      ),
    );
    expect(screen.getByTestId('hero-live-pill')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(
      withTheme(
        <VitalHero
          vital="sleep"
          primary="7:42"
          secondary="hrs"
          sub="Last night · in bed 11:14 pm"
          range="A quieter night than last week"
          ringFill={0.78}
          testID="hero"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
