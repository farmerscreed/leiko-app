// SleepNightlyBars — Sprint 16.5c.
//
// A range-aware bar chart for the Sleep detail screen. One bar per
// night in the selected window (7d / 30d / 90d). Bar height encodes
// total sleep duration; the bar internally stacks Deep / Light /
// Other so the user sees both how much they slept AND the shape of
// the composition at a glance.
//
// Why bars not lines: the underlying data is discrete per night
// (one summary, not a time series). A line implies continuity between
// points; bars are the honest visualisation.
//
// Sources of truth:
//   - `sessions` is the full slice (newest-first). The chart filters
//     to the selected range (7d/30d/90d) by counting back from "now".
//   - Nights with no recorded session show as a grey gap so the user
//     can see watch-was-off / no-data days at a glance.
//
// Range semantics:
//   - 7d: render 7 day columns, bar per recorded night
//   - 30d: render 30 day columns; bar widths shrink to fit
//   - 90d: render 90 day columns; bars become thin lines
//
// Voice rules: descriptive only.

import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import type { SleepSession } from '../types/vitals';
import type { TrendRange } from './TimeRangePills';

const RANGE_DAYS: Record<TrendRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

// Y-axis reference. 9 hours is the "healthy adult target" — bars
// taller than this scale to the chart's full height. 9h matches the
// design's score-band assumption.
const Y_REFERENCE_MINUTES = 9 * 60;

const CHART_HEIGHT = 132;
const MIN_BAR_WIDTH = 2;
const MAX_BAR_WIDTH = 28;

export interface SleepNightlyBarsProps {
  sessions: ReadonlyArray<SleepSession>;
  range: TrendRange;
  /** Sprint 18 — explicit chart-area width. The chart computes per-bar
   *  width from this; without it the component used to hardcode 360 and
   *  cluster bars to the left on wider phones (Pixel 8 = 412dp). When
   *  omitted, falls back to 360 for back-compat. Callers should pass
   *  `useWindowDimensions().width` (or a horizontally-padded slice of
   *  it) so the chart fills its container. */
  width?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface DaySlot {
  dayKey: string;        // YYYY-MM-DD in user-local time
  session: SleepSession | null;
  isToday: boolean;
}

// Build the day-grid for the range. Days are anchored to the user's
// local calendar (the session's `sessionEndSec` falls into the day it
// completed — typically "this morning" → today).
function buildDayGrid(
  sessions: ReadonlyArray<SleepSession>,
  range: TrendRange,
  nowMs: number,
): DaySlot[] {
  const days = RANGE_DAYS[range];
  const grid: DaySlot[] = [];
  // dayKey from a Date (user-local).
  const dayKeyFor = (ms: number): string => {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const todayKey = dayKeyFor(nowMs);
  const byDay = new Map<string, SleepSession>();
  for (const s of sessions) {
    const key = dayKeyFor(s.sessionEndSec * 1000);
    const existing = byDay.get(key);
    // Most recent per day wins (in case the watch reports the same
    // night twice across syncs).
    if (!existing || s.sessionEndSec > existing.sessionEndSec) {
      byDay.set(key, s);
    }
  }
  for (let i = days - 1; i >= 0; i--) {
    const slotMs = nowMs - i * 24 * 60 * 60 * 1000;
    const key = dayKeyFor(slotMs);
    grid.push({
      dayKey: key,
      session: byDay.get(key) ?? null,
      isToday: key === todayKey,
    });
  }
  return grid;
}

export function SleepNightlyBars({ sessions, range, width, testID, style }: SleepNightlyBarsProps) {
  const theme = useTheme();
  const sleepColor = theme.colors.vital.sleep;
  const labelStyle = theme.type('labelUppercase');
  const captionStyle = theme.type('caption');

  const grid = useMemo(() => buildDayGrid(sessions, range, Date.now()), [sessions, range]);

  // Width per bar — shrinks with range so 90d fits.
  const slotCount = grid.length;
  // Sprint 18 — Y-axis labels + chart frame + card padding consume the
  // leading horizontal space. The y-axis column is ~28px (22px label +
  // 6px gap), the card has spacing.l (~16px) padding each side, plus a
  // small inner safe margin. Subtract conservatively so bars don't
  // hug the right edge.
  const Y_AXIS_GUTTER = 28;
  const CARD_PADDING = 32; // sum of left+right padding
  const horizontalPad = Y_AXIS_GUTTER + CARD_PADDING;
  const baseWidth = typeof width === 'number' && width > 0 ? width : 360;
  const usableWidth = Math.max(120, baseWidth - horizontalPad);
  const gap = range === '7d' ? 6 : range === '30d' ? 2 : 1;
  const bw = Math.max(
    MIN_BAR_WIDTH,
    Math.min(MAX_BAR_WIDTH, Math.floor((usableWidth - gap * (slotCount - 1)) / slotCount)),
  );

  // Count of nights with actual sleep data in the window — surfaced as
  // a caption so the user can see at a glance "5 of 7 nights tracked".
  const trackedCount = grid.filter((d) => d.session !== null).length;

  // First / last day labels for the axis.
  const firstLabel = formatAxisLabel(grid[0]?.dayKey ?? '');
  const lastLabel = grid[grid.length - 1]?.isToday
    ? 'today'
    : formatAxisLabel(grid[grid.length - 1]?.dayKey ?? '');

  return (
    <View
      style={[
        {
          marginHorizontal: theme.spacing.xl,
          padding: theme.spacing.l,
          borderRadius: theme.radii.l,
          backgroundColor: theme.colors.surface.warmSubtle,
          borderWidth: 0.5,
          borderColor: theme.colors.border.rim,
          gap: theme.spacing.s,
        },
        style,
      ]}
      testID={testID}
    >
      <View style={styles.headerRow}>
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
          {`Nightly sleep · ${range}`}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.numeric,
            fontSize: captionStyle.size,
            lineHeight: captionStyle.lineHeight,
            color: theme.colors.text.tertiary,
            letterSpacing: 0.3,
          }}
        >
          {`${trackedCount} of ${slotCount} tracked`}
        </Text>
      </View>

      {/* Chart with y-axis hour ticks on the left + bar grid on the
          right. The ticks reference 0/3/6/9 hours so the user can read
          each bar's height at a glance regardless of range. */}
      <View style={[styles.chartFrame, { height: CHART_HEIGHT }]}>
        {/* Y-axis labels + dashed grid lines. */}
        <View style={styles.yAxis}>
          {[9, 6, 3, 0].map((h) => (
            <Text
              key={h}
              allowFontScaling={false}
              style={{
                fontFamily: captionStyle.family,
                fontSize: 10,
                lineHeight: 12,
                color: theme.colors.text.tertiary,
                width: 22,
                textAlign: 'right',
              }}
            >
              {`${h}h`}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {/* Horizontal grid lines under the bars. */}
          {[9, 6, 3].map((h) => (
            <View
              key={`grid-${h}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: ((Y_REFERENCE_MINUTES - h * 60) / Y_REFERENCE_MINUTES) * CHART_HEIGHT,
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.text.tertiary,
                opacity: 0.15,
              }}
            />
          ))}
          <View
            style={[styles.chart, { height: CHART_HEIGHT, gap }]}
            accessibilityRole="image"
          >
            {grid.map((slot, idx) => {
          if (slot.session === null) {
            return (
              <View
                key={`${slot.dayKey}-${idx}`}
                style={{
                  width: bw,
                  height: 3,
                  backgroundColor: theme.colors.text.tertiary,
                  opacity: 0.2,
                  alignSelf: 'flex-end',
                  borderRadius: 1.5,
                }}
              />
            );
          }
          const total = slot.session.totalMinutes;
          const deep = slot.session.deepMinutes;
          const light = slot.session.lightMinutes;
          const barH = Math.max(2, Math.round((total / Y_REFERENCE_MINUTES) * CHART_HEIGHT));
          const deepH = Math.round((deep / total) * barH);
          const lightH = Math.round((light / total) * barH);
          // "Other" minutes (REM + brief wakings) fills the remaining
          // height. We derive otherH from the rounded deep/light so
          // the segments always sum to barH without rounding gaps.
          const otherH = Math.max(0, barH - deepH - lightH);
          return (
            <View
              key={`${slot.dayKey}-${idx}`}
              style={{
                width: bw,
                height: barH,
                alignSelf: 'flex-end',
                borderRadius: 2,
                overflow: 'hidden',
                opacity: slot.isToday ? 1 : 0.85,
              }}
              testID={testID ? `${testID}-bar-${slot.dayKey}` : undefined}
            >
              {/* Stack: other (top) / light / deep (bottom). */}
              <View style={{ height: otherH, backgroundColor: sleepColor, opacity: 0.4 }} />
              <View style={{ height: lightH, backgroundColor: sleepColor, opacity: 0.7 }} />
              <View style={{ height: deepH, backgroundColor: sleepColor, opacity: 1.0 }} />
            </View>
          );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.axisRow, { paddingLeft: 28 }]}>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: captionStyle.family,
            fontSize: captionStyle.size,
            lineHeight: captionStyle.lineHeight,
            color: theme.colors.text.tertiary,
          }}
        >
          {firstLabel}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: captionStyle.family,
            fontSize: captionStyle.size,
            lineHeight: captionStyle.lineHeight,
            color: theme.colors.text.tertiary,
          }}
        >
          {lastLabel}
        </Text>
      </View>
    </View>
  );
}

function formatAxisLabel(dayKey: string): string {
  if (!dayKey) return '';
  const ms = new Date(`${dayKey}T00:00:00`).getTime();
  if (!Number.isFinite(ms)) return dayKey;
  const d = new Date(ms);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartFrame: {
    flexDirection: 'row',
    gap: 6,
  },
  yAxis: {
    justifyContent: 'space-between',
    paddingTop: 0,
    paddingBottom: 0,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 4,
    paddingBottom: 4,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
