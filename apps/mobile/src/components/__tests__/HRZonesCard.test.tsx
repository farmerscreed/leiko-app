import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { HRZonesCard, type HRZone } from '../HRZonesCard';

function withTheme(
  ui: ReactNode,
  colorMode: 'dark' | 'light' = 'dark',
) {
  return (
    <ThemeProvider mode="caregiver" colorMode={colorMode}>
      {ui}
    </ThemeProvider>
  );
}

const ZONES: [HRZone, HRZone, HRZone, HRZone] = [
  { name: 'Resting', range: '< 60', pct: 18 },
  { name: 'Calm', range: '60–80', pct: 56 },
  { name: 'Active', range: '80–110', pct: 22 },
  { name: 'Vigorous', range: '110+', pct: 4 },
];

describe('HRZonesCard', () => {
  it('renders the default eyebrow label', () => {
    render(withTheme(<HRZonesCard zones={ZONES} testID="zones" />));
    expect(screen.getByText('Time in zones · today')).toBeTruthy();
  });

  it('honours an eyebrow label override', () => {
    render(
      withTheme(<HRZonesCard zones={ZONES} label="Time in zones · this week" />),
    );
    expect(screen.getByText('Time in zones · this week')).toBeTruthy();
  });

  it('renders all four zone names', () => {
    render(withTheme(<HRZonesCard zones={ZONES} testID="zones" />));
    expect(screen.getByText('Resting')).toBeTruthy();
    expect(screen.getByText('Calm')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Vigorous')).toBeTruthy();
  });

  it('renders all four zone ranges with bpm suffix', () => {
    render(withTheme(<HRZonesCard zones={ZONES} testID="zones" />));
    expect(screen.getByText('< 60 bpm')).toBeTruthy();
    expect(screen.getByText('60–80 bpm')).toBeTruthy();
    expect(screen.getByText('80–110 bpm')).toBeTruthy();
    expect(screen.getByText('110+ bpm')).toBeTruthy();
  });

  it('renders the rounded percent label for each row', () => {
    render(
      withTheme(
        <HRZonesCard
          zones={[
            { name: 'Resting', range: '< 60', pct: 17.6 },
            { name: 'Calm', range: '60–80', pct: 55.4 },
            { name: 'Active', range: '80–110', pct: 22 },
            { name: 'Vigorous', range: '110+', pct: 5 },
          ]}
        />,
      ),
    );
    expect(screen.getByText('18%')).toBeTruthy();
    expect(screen.getByText('55%')).toBeTruthy();
    expect(screen.getByText('22%')).toBeTruthy();
    expect(screen.getByText('5%')).toBeTruthy();
  });

  it('exposes a composed accessibility label per row', () => {
    render(withTheme(<HRZonesCard zones={ZONES} testID="zones" />));
    expect(screen.getByLabelText('Resting zone, < 60 bpm, 18 percent')).toBeTruthy();
    expect(screen.getByLabelText('Vigorous zone, 110+ bpm, 4 percent')).toBeTruthy();
  });

  it('matches snapshot in dark mode', () => {
    const { toJSON } = render(
      withTheme(<HRZonesCard zones={ZONES} testID="zones" />, 'dark'),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
