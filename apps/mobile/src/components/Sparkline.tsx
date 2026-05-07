// Sparkline — Sprint 7.
//
// Tiny line chart for the parent reading card. Hand-rolled with View
// primitives (no react-native-svg dep) so it stays a single small
// file with zero new packages. 14 data points × 1 series. Renders as
// a connected polyline + a subtle endpoint dot. Not interactive —
// the parent of the sparkline owns tap behaviour.
//
// Visual rules (CLAUDE.md anti-patterns + docs/03-components):
//   - No animation on the line. Calm-before-clever.
//   - No axis labels, gridlines, or numbers. The card already has a
//     numeric hero; the sparkline is a glance, not a chart.
//   - Color: brand.primarySoft at full opacity. Crimson/urgent state
//     stays reserved for the card's left-edge stripe.
//
// Math: each adjacent pair (p_i, p_{i+1}) becomes a thin rotated View
// segment. Length = euclidean distance; rotation = atan2(dy, dx);
// position = midpoint of the segment with a -length/2 horizontal
// offset (the View's transform pivots around its centre by default).

import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface SparklineProps {
  /** Newest-first or oldest-first; the component sorts by index, not by time. */
  values: number[];
  width: number;
  height: number;
  /** Override the line color. Defaults to brand.primarySoft. */
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface Segment {
  centerX: number;
  centerY: number;
  length: number;
  angleRad: number;
}

interface PlotPoints {
  points: Array<{ x: number; y: number }>;
  segments: Segment[];
  endpoint: { x: number; y: number } | null;
}

function plot(values: number[], width: number, height: number): PlotPoints {
  if (values.length === 0) {
    return { points: [], segments: [], endpoint: null };
  }
  // Sparkline reads left-to-right oldest → newest. Caller hands us
  // newest-first; reverse here so the visual matches reading order.
  const ordered = [...values].reverse();
  // Padding inside the box keeps the line off the top/bottom edge.
  const padY = Math.max(2, Math.round(height * 0.12));
  const usableH = Math.max(1, height - padY * 2);
  const min = Math.min(...ordered);
  const max = Math.max(...ordered);
  const range = max - min || 1;

  const xs =
    ordered.length === 1
      ? [width / 2]
      : ordered.map((_, i) => (i / (ordered.length - 1)) * width);
  const ys = ordered.map((v) => padY + (1 - (v - min) / range) * usableH);

  const points = xs.map((x, i) => ({ x, y: ys[i] }));
  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angleRad = Math.atan2(dy, dx);
    segments.push({
      centerX: (a.x + b.x) / 2,
      centerY: (a.y + b.y) / 2,
      length,
      angleRad,
    });
  }
  const endpoint = points[points.length - 1] ?? null;
  return { points, segments, endpoint };
}

export function Sparkline({
  values,
  width,
  height,
  color,
  strokeWidth = 1.5,
  style,
  testID,
}: SparklineProps) {
  const theme = useTheme();
  const stroke = color ?? theme.colors.brand.primarySoft;
  const { segments, endpoint } = useMemo(
    () => plot(values, width, height),
    [values, width, height],
  );

  // Single point: draw just the endpoint dot. Zero points: nothing.
  if (segments.length === 0 && !endpoint) {
    return <View style={[{ width, height }, style]} testID={testID} />;
  }

  return (
    <View
      // accessible={false} keeps the sparkline out of the focus order
      // (the parent ReadingCard already announces the trend in words),
      // but we don't `accessibilityElementsHidden` so test queries +
      // layout inspectors can still find it.
      accessible={false}
      style={[{ width, height, position: 'relative' }, style]}
      testID={testID}
    >
      {segments.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: s.centerX - s.length / 2,
            top: s.centerY - strokeWidth / 2,
            width: s.length,
            height: strokeWidth,
            backgroundColor: stroke,
            borderRadius: strokeWidth,
            transform: [{ rotate: `${s.angleRad}rad` }],
          }}
        />
      ))}
      {endpoint ? (
        <View
          style={{
            position: 'absolute',
            left: endpoint.x - 3,
            top: endpoint.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: stroke,
          }}
        />
      ) : null}
    </View>
  );
}
