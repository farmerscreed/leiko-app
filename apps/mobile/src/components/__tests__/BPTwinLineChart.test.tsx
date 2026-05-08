// BPTwinLineChart — Sprint 8.5 unit + render tests.
//
// Pure-helper tests run without React/SVG; render tests mount under the
// theme provider to exercise the SVG output + the legend.

import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import {
  BPTwinLineChart,
  buildBPTwinGeometry,
} from '../BPTwinLineChart';

function withTheme(ui: ReactNode) {
  return (
    <ThemeProvider mode="caregiver" colorMode="dark">
      {ui}
    </ThemeProvider>
  );
}

const SYS = [114, 110, 122, 124, 128, 130, 126, 120];
const DIA = [72, 70, 78, 79, 82, 84, 81, 76];
const HOURS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];
const SYS_RANGE: [number, number] = [110, 130];

describe('buildBPTwinGeometry — pure logic', () => {
  it('returns empty coords for an empty data set', () => {
    const g = buildBPTwinGeometry([], [], SYS_RANGE, 320, 170);
    expect(g.xs).toEqual([]);
    expect(g.sysY).toEqual([]);
    expect(g.diaY).toEqual([]);
    expect(g.rangeRect.w).toBe(0);
  });

  it('returns one centered coord for a single-point series', () => {
    const g = buildBPTwinGeometry([122], [78], SYS_RANGE, 320, 170);
    expect(g.xs).toHaveLength(1);
    expect(g.sysY).toHaveLength(1);
    expect(g.diaY).toHaveLength(1);
  });

  it('produces sysY < diaY for every point (sys is the higher number, drawn higher on the chart)', () => {
    // Higher BP value → smaller y (SVG y axis grows downward).
    const g = buildBPTwinGeometry(SYS, DIA, SYS_RANGE, 320, 170);
    g.sysY.forEach((y, i) => {
      expect(y).toBeLessThan(g.diaY[i]);
    });
  });

  it('range rect height is positive when range[1] > range[0]', () => {
    const g = buildBPTwinGeometry(SYS, DIA, SYS_RANGE, 320, 170);
    expect(g.rangeRect.h).toBeGreaterThan(0);
    expect(g.rangeRect.w).toBeGreaterThan(0);
  });

  it('clamps to the shorter of sys / dia when arrays have differing lengths', () => {
    const g = buildBPTwinGeometry([120, 122, 118], [72, 76], SYS_RANGE, 320, 170);
    expect(g.xs).toHaveLength(2);
    expect(g.sysY).toHaveLength(2);
    expect(g.diaY).toHaveLength(2);
  });
});

describe('BPTwinLineChart — render', () => {
  it('renders a sys + dia dot at every hour', () => {
    render(
      withTheme(
        <BPTwinLineChart
          vital="bp"
          sys={SYS}
          dia={DIA}
          hourLabels={HOURS}
          range={SYS_RANGE}
          testID="chart"
        />,
      ),
    );
    // 8 hours × 2 series = 16 dots total
    SYS.forEach((_, i) => {
      expect(screen.getByTestId(`chart-sys-dot-${i}`)).toBeTruthy();
      expect(screen.getByTestId(`chart-dia-dot-${i}`)).toBeTruthy();
    });
  });

  it('renders the range band rect', () => {
    render(
      withTheme(
        <BPTwinLineChart
          vital="bp"
          sys={SYS}
          dia={DIA}
          hourLabels={HOURS}
          range={SYS_RANGE}
          testID="chart"
        />,
      ),
    );
    expect(screen.getByTestId('chart-range-band')).toBeTruthy();
  });

  it('renders the two-line legend with plain-language labels', () => {
    render(
      withTheme(
        <BPTwinLineChart
          vital="bp"
          sys={SYS}
          dia={DIA}
          hourLabels={HOURS}
          range={SYS_RANGE}
          testID="chart"
        />,
      ),
    );
    expect(screen.getByText('Systolic · the first number')).toBeTruthy();
    expect(screen.getByText('Diastolic')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(
      withTheme(
        <BPTwinLineChart
          vital="bp"
          sys={SYS}
          dia={DIA}
          hourLabels={HOURS}
          range={SYS_RANGE}
          testID="chart"
        />,
      ),
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
