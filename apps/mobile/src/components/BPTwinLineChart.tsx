// BPTwinLineChart — Sprint 8.5 (BP detail screen).
//
// Specialised SVG chart for the BPDetail screen. Renders the day's
// systolic + diastolic readings as twin dot rows with a translucent
// vital-color "connector" line between each pair, a faint healthy-range
// band on the systolic side, and an uppercase mono hour-label axis along
// the bottom. Includes a two-line legend explaining systolic vs
// diastolic in plain language ("the first number").
//
// The diastolic dot color is the BP vital color at 0.6 opacity — the
// design's `oklch(... calc(l - .15) ...)` formulation has no cross-
// platform RN equivalent, and Skia's color-math utilities aren't on the
// dependency list. A 0.6 opacity render reads as "lower lightness" on
// both warm-charcoal and linen surfaces (visually checked against the
// design prototype, leiko-detail-screens.jsx lines 60-65).
//
// react-native-svg only — matches the pattern in VitalTrendChart +
// CorrelationStrip + VitalRing.
//
// Voice rules (docs/05-voice-and-claims.md): the legend strings
// "Systolic · the first number" and "Diastolic" are the only
// user-visible copy this component owns. Both are plain-language and
// voice-clean.

import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Line as SvgLine,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { useTheme } from '../theme';

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 170;
const PADDING_X = 16;
const PADDING_Y = 14;
const Y_MIN = 60;
const Y_MAX = 140;
const DOT_RADIUS = 3;
const CONNECTOR_OPACITY = 0.25;
const CONNECTOR_WIDTH = 6;
const RANGE_BAND_OPACITY = 0.08;
const DIA_OPACITY = 0.6;

export interface BPTwinLineChartProps {
  /** Locked to "bp" — included so the API matches our other chart components. */
  vital: 'bp';
  /** Systolic samples per slot, oldest → newest. `null` for slots with
   *  no reading — those slots render no dot (honest "missing"). */
  sys: (number | null)[];
  /** Diastolic samples per slot, oldest → newest. Same shape rules as `sys`. */
  dia: (number | null)[];
  /** Bottom-axis labels (e.g. "12a", "3a", "6a", ..., "9p"). Same length as `sys`. */
  hourLabels: string[];
  /** Healthy systolic range [low, high] — drawn as a faint vital-color rectangle. */
  range: [number, number];
  width?: number;
  height?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export interface BPTwinChartGeometry {
  /** Per-slot x coordinates (one per labelled slot). */
  xs: number[];
  /** Per-slot y for systolic. `null` for missing-data slots. */
  sysY: (number | null)[];
  /** Per-slot y for diastolic. `null` for missing-data slots. */
  diaY: (number | null)[];
  /** Range-band rectangle (sys low → high) on the chart. */
  rangeRect: { x: number; y: number; w: number; h: number };
}

/**
 * Pure geometry helper — exported for unit tests. Maps the sys + dia
 * arrays into chart-space coordinates with a fixed [Y_MIN, Y_MAX] axis
 * (60..140 mmHg) that comfortably accommodates the BP space without
 * auto-scaling per-day (which would make month-over-month visual
 * comparison harder).
 *
 * Sprint 16.5f — null entries in sys/dia map to null sysY/diaY so the
 * render layer skips dots for slots with no real reading. Previously
 * the screen filled empty slots with mock data; now they're honest.
 */
export function buildBPTwinGeometry(
  sys: (number | null)[],
  dia: (number | null)[],
  range: [number, number],
  width: number,
  height: number,
): BPTwinChartGeometry {
  const innerW = Math.max(0, width - PADDING_X * 2);
  const innerH = Math.max(0, height - PADDING_Y * 2);
  const span = Y_MAX - Y_MIN;
  const points = Math.min(sys.length, dia.length);

  if (points === 0) {
    return {
      xs: [],
      sysY: [],
      diaY: [],
      rangeRect: { x: PADDING_X, y: PADDING_Y, w: 0, h: 0 },
    };
  }

  const xs =
    points === 1
      ? [PADDING_X + innerW / 2]
      : Array.from(
          { length: points },
          (_, i) => PADDING_X + (innerW * i) / (points - 1),
        );

  const yFor = (v: number) =>
    PADDING_Y + innerH - ((v - Y_MIN) / span) * innerH;

  const sysY: (number | null)[] = sys
    .slice(0, points)
    .map((v) => (v === null ? null : yFor(v)));
  const diaY: (number | null)[] = dia
    .slice(0, points)
    .map((v) => (v === null ? null : yFor(v)));

  const rangeTopY = yFor(range[1]);
  const rangeBottomY = yFor(range[0]);

  return {
    xs,
    sysY,
    diaY,
    rangeRect: {
      x: PADDING_X,
      y: rangeTopY,
      w: innerW,
      h: Math.max(rangeBottomY - rangeTopY, 1),
    },
  };
}

export function BPTwinLineChart({
  vital,
  sys,
  dia,
  hourLabels,
  range,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  testID,
  style,
}: BPTwinLineChartProps) {
  const theme = useTheme();
  const labelStyle = theme.type('labelUppercase');
  const vitalColor = theme.colors.vital[vital];

  const geometry = useMemo(
    () => buildBPTwinGeometry(sys, dia, range, width, height),
    [sys, dia, range, width, height],
  );

  return (
    <View style={style} testID={testID}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        testID={testID ? `${testID}-svg` : undefined}
      >
        {/* Range band (systolic 110–130 by default) */}
        {geometry.rangeRect.w > 0 ? (
          <Rect
            x={geometry.rangeRect.x}
            y={geometry.rangeRect.y}
            width={geometry.rangeRect.w}
            height={geometry.rangeRect.h}
            fill={vitalColor}
            fillOpacity={RANGE_BAND_OPACITY}
            testID={testID ? `${testID}-range-band` : undefined}
          />
        ) : null}

        {/* Connector lines between sys + dia — only when BOTH are present. */}
        {geometry.xs.map((x, i) => {
          const sy = geometry.sysY[i];
          const dy = geometry.diaY[i];
          if (sy === null || dy === null) return null;
          return (
            <SvgLine
              key={`c-${i}`}
              x1={x}
              x2={x}
              y1={sy}
              y2={dy}
              stroke={vitalColor}
              strokeOpacity={CONNECTOR_OPACITY}
              strokeWidth={CONNECTOR_WIDTH}
              strokeLinecap="round"
            />
          );
        })}

        {/* Systolic dots — skipped for slots with no reading. */}
        {geometry.xs.map((x, i) => {
          const sy = geometry.sysY[i];
          if (sy === null) return null;
          return (
            <Circle
              key={`s-${i}`}
              cx={x}
              cy={sy}
              r={DOT_RADIUS}
              fill={vitalColor}
              testID={testID ? `${testID}-sys-dot-${i}` : undefined}
            />
          );
        })}

        {/* Diastolic dots — skipped for slots with no reading. */}
        {geometry.xs.map((x, i) => {
          const dy = geometry.diaY[i];
          if (dy === null) return null;
          return (
            <Circle
              key={`d-${i}`}
              cx={x}
              cy={dy}
              r={DOT_RADIUS}
              fill={vitalColor}
              fillOpacity={DIA_OPACITY}
              testID={testID ? `${testID}-dia-dot-${i}` : undefined}
            />
          );
        })}

        {/* Hour labels along the bottom */}
        {hourLabels.map((label, i) => {
          const x = geometry.xs[i];
          if (x === undefined) return null;
          return (
            <SvgText
              key={`h-${i}`}
              x={x}
              y={height - 2}
              textAnchor="middle"
              fontFamily={theme.fontFamilies.numeric}
              fontSize={8.5}
              fill={theme.colors.text.tertiary}
              letterSpacing={0.5}
            >
              {label.toUpperCase()}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View
        style={[
          styles.legendRow,
          {
            borderTopColor: theme.colors.border.subtle,
            paddingTop: theme.spacing.s,
            marginTop: theme.spacing.s,
          },
        ]}
        testID={testID ? `${testID}-legend` : undefined}
      >
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              { backgroundColor: vitalColor },
            ]}
          />
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: labelStyle.family,
              fontSize: labelStyle.size,
              lineHeight: labelStyle.lineHeight,
              letterSpacing: labelStyle.letterSpacing,
              color: theme.colors.text.tertiary,
              textTransform: 'uppercase',
            }}
          >
            Systolic · the first number
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSwatch,
              {
                backgroundColor: vitalColor,
                opacity: DIA_OPACITY,
              },
            ]}
          />
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: labelStyle.family,
              fontSize: labelStyle.size,
              lineHeight: labelStyle.lineHeight,
              letterSpacing: labelStyle.letterSpacing,
              color: theme.colors.text.tertiary,
              textTransform: 'uppercase',
            }}
          >
            Diastolic
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    borderTopWidth: 0.5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
});
