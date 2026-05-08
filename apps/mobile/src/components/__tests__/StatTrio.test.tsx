import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { StatTrio } from '../StatTrio';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

describe('StatTrio', () => {
  it('renders all three label/value/unit triples', () => {
    render(
      withTheme(
        <StatTrio
          items={[
            { label: '7-day avg', value: '121/77', unit: 'mmHg' },
            { label: 'Lowest', value: '108/68', unit: 'last Tue' },
            { label: 'Highest', value: '134/86', unit: 'last Sat' },
          ]}
          testID="trio"
        />,
      ),
    );
    expect(screen.getByText('7-day avg')).toBeTruthy();
    expect(screen.getByText('121/77')).toBeTruthy();
    expect(screen.getByText('mmHg')).toBeTruthy();
    expect(screen.getByText('Highest')).toBeTruthy();
    expect(screen.getByText('134/86')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(
      withTheme(
        <StatTrio
          items={[
            { label: 'Resting', value: '62', unit: 'bpm avg' },
            { label: 'Peak', value: '142', unit: 'yesterday run' },
            { label: 'Variability', value: '38', unit: 'ms · steady' },
          ]}
          testID="trio"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
