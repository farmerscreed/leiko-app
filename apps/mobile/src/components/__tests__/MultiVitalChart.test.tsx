import { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import {
  MultiVitalChart,
  buildMultiVitalGeometry,
  type MultiVitalSeries,
} from '../MultiVitalChart';
import { ThemeProvider } from '../../theme';

function withTheme(ui: ReactNode, mode: 'caregiver' | 'parent' = 'caregiver') {
  return <ThemeProvider mode={mode}>{ui}</ThemeProvider>;
}

const DAYS = ['2025-04-08', '2025-04-09', '2025-04-10', '2025-04-11'];

function fixture(): MultiVitalSeries[] {
  return [
    { kind: 'bp', visible: true, days: DAYS, values: [120, 125, 122, 128] },
    { kind: 'hr', visible: true, days: DAYS, values: [62, 64, 66, 65] },
    { kind: 'spo2', visible: false, days: DAYS, values: [97, 96, 96, 97] },
    {
      kind: 'sleep',
      visible: true,
      days: DAYS,
      values: [420, 380, 460, 410],
    },
    { kind: 'activity', visible: false, days: DAYS, values: [7100, 8200, 6500, 9100] },
  ];
}

describe('buildMultiVitalGeometry', () => {
  it('builds a shared X axis from the union of visible-series day sets', () => {
    const geo = buildMultiVitalGeometry(fixture(), 360, 200);
    expect(geo.dayCount).toBe(4);
    expect(geo.axisXs).toHaveLength(4);
    expect(geo.axisXs[0]).toBeLessThan(geo.axisXs[1]);
  });

  it('produces a path only for visible series', () => {
    const geo = buildMultiVitalGeometry(fixture(), 360, 200);
    expect(geo.perSeries.bp).toBeDefined();
    expect(geo.perSeries.hr).toBeDefined();
    expect(geo.perSeries.sleep).toBeDefined();
    expect(geo.perSeries.spo2).toBeUndefined();
    expect(geo.perSeries.activity).toBeUndefined();
  });

  it('normalizes each series independently to its own min..max', () => {
    const geo = buildMultiVitalGeometry(fixture(), 360, 200);
    const bp = geo.perSeries.bp!;
    const hr = geo.perSeries.hr!;
    expect(bp.min).toBe(120);
    expect(bp.max).toBe(128);
    expect(hr.min).toBe(62);
    expect(hr.max).toBe(66);
    // Independent normalization: bp's max y position should equal hr's
    // max y position (both normalized to the chart's top), even though
    // their absolute values are very different.
    const bpMaxY = Math.min(...bp.ys);
    const hrMaxY = Math.min(...hr.ys);
    expect(Math.abs(bpMaxY - hrMaxY)).toBeLessThan(0.01);
  });

  it('records the latest value per series', () => {
    const geo = buildMultiVitalGeometry(fixture(), 360, 200);
    expect(geo.perSeries.bp!.latest).toBe(128);
    expect(geo.perSeries.hr!.latest).toBe(65);
    expect(geo.perSeries.sleep!.latest).toBe(410);
  });

  it('handles a single-day series by centering it horizontally', () => {
    const geo = buildMultiVitalGeometry(
      [
        { kind: 'bp', visible: true, days: ['2025-04-08'], values: [120] },
      ],
      360,
      200,
    );
    expect(geo.axisXs).toHaveLength(1);
    // Centered: x ≈ width / 2.
    expect(geo.axisXs[0]).toBeCloseTo(180, 0);
  });

  it('returns empty geometry when nothing is visible', () => {
    const geo = buildMultiVitalGeometry(
      fixture().map((s) => ({ ...s, visible: false })),
      360,
      200,
    );
    expect(geo.dayCount).toBe(0);
    expect(geo.perSeries).toEqual({});
  });
});

describe('MultiVitalChart — rendering', () => {
  it('renders SVG paths only for visible series', () => {
    render(withTheme(<MultiVitalChart series={fixture()} testID="chart" />));
    expect(screen.getByTestId('chart-line-bp')).toBeTruthy();
    expect(screen.getByTestId('chart-line-hr')).toBeTruthy();
    expect(screen.getByTestId('chart-line-sleep')).toBeTruthy();
    expect(screen.queryByTestId('chart-line-spo2')).toBeNull();
    expect(screen.queryByTestId('chart-line-activity')).toBeNull();
  });

  it('renders one legend chip per visible series with the latest value', () => {
    render(withTheme(<MultiVitalChart series={fixture()} testID="chart" />));
    expect(screen.getByTestId('chart-legend-bp')).toBeTruthy();
    expect(screen.getByTestId('chart-legend-hr')).toBeTruthy();
    expect(screen.queryByTestId('chart-legend-spo2')).toBeNull();
  });

  it('formats sleep latest as "h m" and activity as thousands shorthand', () => {
    const series: MultiVitalSeries[] = [
      { kind: 'sleep', visible: true, days: DAYS, values: [420, 380, 460, 410] },
      { kind: 'activity', visible: true, days: DAYS, values: [7100, 8200, 6500, 9100] },
    ];
    render(withTheme(<MultiVitalChart series={series} testID="chart" />));
    // sleep latest = 410 minutes = 6h 50m
    expect(screen.getByTestId('chart-legend-sleep')).toBeTruthy();
    // activity latest = 9100 → "9.1k"
    expect(screen.getByTestId('chart-legend-activity')).toBeTruthy();
  });

  it('renders the empty hint when no series is visible', () => {
    const series = fixture().map((s) => ({ ...s, visible: false }));
    render(withTheme(<MultiVitalChart series={series} testID="chart" />));
    expect(screen.getByTestId('chart-empty')).toBeTruthy();
  });

  it('renders anomaly markers at the supplied indices', () => {
    const series: MultiVitalSeries[] = [
      {
        kind: 'bp',
        visible: true,
        days: DAYS,
        values: [120, 145, 122, 128],
        anomalyIndices: [1],
      },
    ];
    render(withTheme(<MultiVitalChart series={series} testID="chart" />));
    expect(screen.getByTestId('chart-anomaly-bp-1')).toBeTruthy();
  });

  it('exposes a composed accessibility label summarising visible series', () => {
    const { root } = render(
      withTheme(<MultiVitalChart series={fixture()} testID="chart" />),
    );
    expect(root.props.accessibilityLabel).toContain('BP');
    expect(root.props.accessibilityLabel).toContain('HR');
    expect(root.props.accessibilityLabel).toContain('Sleep');
  });
});
