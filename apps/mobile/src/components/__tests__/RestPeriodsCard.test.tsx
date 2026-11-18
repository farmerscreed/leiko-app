import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { RestPeriodsCard, REST_PERIODS_FOOTNOTE, restPeriodRowLabel } from '../RestPeriodsCard';
import type { RestPeriod } from '../../types/vitals';

const TZ = 'Africa/Lagos';
const p: RestPeriod = {
  startSec: Date.parse('2026-11-17T13:00:00Z') / 1000, // 14:00 Lagos
  endSec: Date.parse('2026-11-17T13:45:00Z') / 1000,
  durationMinutes: 45,
  avgBpm: 61,
  baselineBpm: 58,
  confidence: 'hr_and_steps',
  dayLocal: '2026-11-17',
};

describe('RestPeriodsCard', () => {
  it("lists each period in the wearer's timezone, labelled as an estimate", () => {
    render(
      <ThemeProvider>
        <RestPeriodsCard periods={[p]} timeZone={TZ} testID="rp" />
      </ThemeProvider>,
    );
    expect(screen.getByText('Daytime rest · estimated')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText(REST_PERIODS_FOOTNOTE)).toBeTruthy();
    expect(screen.getByLabelText(/45 min, estimated$/)).toBeTruthy();
  });

  it('formats the row label with day and times', () => {
    expect(restPeriodRowLabel(p, TZ)).toBe('Nov 17, 2:00 PM–2:45 PM');
  });
});
