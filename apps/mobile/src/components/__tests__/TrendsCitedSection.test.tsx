import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  TrendsCitedSection,
  TRENDS_CITED_LABEL,
} from '../TrendsCitedSection';
import { ThemeProvider } from '../../theme';
import type { CorrelationRow } from '../../types/database';

function withTheme(ui: ReactNode) {
  return <ThemeProvider mode="caregiver">{ui}</ThemeProvider>;
}

function makeRow(
  type: CorrelationRow['correlation_type'],
  r: number,
  body: string = 'Pattern based on the last 24 days.',
): CorrelationRow {
  return {
    id: 'c-' + type,
    family_id: 'f',
    user_id: 'u',
    correlation_type: type,
    window_days: 30,
    computed_at: '2025-04-11T03:00:00Z',
    pearson_r: r,
    effect_size: 0,
    effect_unit: 'x',
    significance: 0.001,
    sample_n: 24,
    is_meaningful: true,
    narrative_short: '',
    narrative_long: body,
    created_at: '2025-04-11T03:00:00Z',
  };
}

describe('TrendsCitedSection', () => {
  it('renders nothing when given an empty list', () => {
    render(withTheme(<TrendsCitedSection rows={[]} testID="cited" />));
    expect(screen.queryByTestId('cited')).toBeNull();
  });

  it('renders the section eyebrow', () => {
    render(
      withTheme(
        <TrendsCitedSection
          rows={[makeRow('sleep_x_morning_bp', -0.8)]}
          testID="cited"
        />,
      ),
    );
    expect(screen.getByTestId('cited-eyebrow').props.children).toBe(
      TRENDS_CITED_LABEL,
    );
  });

  it('numbers footnotes 1..N in input order', () => {
    render(
      withTheme(
        <TrendsCitedSection
          rows={[
            makeRow('sleep_x_morning_bp', -0.9),
            makeRow('activity_x_resting_hr', -0.4),
          ]}
          testID="cited"
        />,
      ),
    );
    expect(screen.getByTestId('cited-1-numeral').props.children).toBe(1);
    expect(screen.getByTestId('cited-2-numeral').props.children).toBe(2);
  });

  it('maps the strength label correctly across thresholds', () => {
    const cases: Array<[number, 'Strong' | 'Moderate' | 'Gentle']> = [
      [-0.9, 'Strong'],
      [-0.6, 'Strong'],
      [-0.5, 'Moderate'],
      [-0.3, 'Moderate'],
      [-0.29, 'Gentle'],
      [0.1, 'Gentle'],
    ];
    for (const [r, expected] of cases) {
      const { unmount } = render(
        withTheme(
          <TrendsCitedSection
            rows={[makeRow('sleep_x_morning_bp', r)]}
            testID="cited"
          />,
        ),
      );
      expect(screen.getByTestId('cited-1-strength').props.children).toBe(
        expected,
      );
      unmount();
    }
  });
});
