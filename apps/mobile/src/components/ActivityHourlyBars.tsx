// ActivityHourlyBars — today's steps, hour by hour (2026-11-18).
//
// The watch only reports a running daily total, so the hours come from
// the difference between successive reads
// (services/activity/stepTimeline.ts). Steps before the first read of
// the day can't be placed; we say so in a caption rather than inventing
// a time for them.
//
// Visual language follows ActivityWeeklyBars (same card, same vital
// colour), without the entry animation: 24 thin bars, labels at 00/06/
// 12/18. One composed accessibility sentence; the bars are decorative.
//
// Voice (docs/05-voice-and-claims.md): factual, no gamification.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

const CHART_HEIGHT = 96;
const LABEL_HOURS = [0, 6, 12, 18];

export interface ActivityHourlyBarsProps {
  /** Length 24, steps per local hour. */
  hourly: number[];
  /** The day's running total, to work out how many steps aren't placed. */
  totalSteps: number;
  /** Local hour now (0–23); bars after it are left out. */
  currentHour: number;
  title?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function composeHourlyAccessibilityLabel(
  hourly: number[],
  totalSteps: number,
  title: string,
): string {
  const placed = hourly.reduce((a, b) => a + b, 0);
  if (placed === 0) return `${title}. No steps placed in an hour yet today.`;
  let peak = 0;
  for (let h = 1; h < 24; h++) if (hourly[h] > hourly[peak]) peak = h;
  const unplaced = Math.max(0, totalSteps - placed);
  const tail = unplaced > 0 ? ` ${unplaced.toLocaleString()} earlier steps aren't placed in an hour.` : '';
  return `${title}. Busiest hour ${hourLabel(peak)} with ${hourly[peak].toLocaleString()} steps.${tail}`;
}

export function ActivityHourlyBars({
  hourly,
  totalSteps,
  currentHour,
  title = 'Today by hour',
  style,
  testID,
}: ActivityHourlyBarsProps) {
  const theme = useTheme();
  const labelStyle = theme.type('labelUppercase');
  const captionStyle = theme.type('caption');
  const vitalColor = theme.colors.vital.activity;
  const max = Math.max(1, ...hourly);
  const placed = hourly.reduce((a, b) => a + b, 0);
  const unplaced = Math.max(0, totalSteps - placed);

  return (
    <View
      style={style}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={composeHourlyAccessibilityLabel(hourly, totalSteps, title)}
    >
      <Text
        style={{
          fontFamily: labelStyle.family,
          fontSize: labelStyle.size,
          lineHeight: labelStyle.lineHeight,
          letterSpacing: labelStyle.letterSpacing,
          color: theme.colors.text.tertiary,
          textTransform: 'uppercase',
          marginHorizontal: 20,
          marginBottom: theme.spacing.s,
        }}
      >
        {title}
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface.warmSubtle,
            borderColor: theme.colors.border.rim,
            borderRadius: theme.radii.l,
            marginHorizontal: 20,
            padding: theme.spacing.l,
          },
        ]}
      >
        <View
          style={[styles.bars, { height: CHART_HEIGHT }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {hourly.map((v, h) => {
            const future = h > currentHour;
            const ratio = v / max;
            return (
              <View key={h} style={styles.col} testID={testID ? `${testID}-bar-${h}` : undefined}>
                <View
                  style={{
                    height: future ? 2 : Math.max(2, Math.round(ratio * CHART_HEIGHT)),
                    backgroundColor: future || v === 0 ? theme.colors.border.subtle : vitalColor,
                    borderRadius: 2,
                    opacity: h === currentHour ? 1 : 0.85,
                  }}
                />
              </View>
            );
          })}
        </View>
        <View
          style={styles.labels}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {LABEL_HOURS.map((h) => (
            <Text
              key={h}
              style={{
                fontFamily: theme.fontFamilies.numeric,
                fontSize: labelStyle.size,
                color: theme.colors.text.tertiary,
              }}
            >
              {hourLabel(h)}
            </Text>
          ))}
        </View>
        {unplaced > 0 ? (
          <Text
            style={{
              fontFamily: captionStyle.family,
              fontSize: captionStyle.size,
              lineHeight: captionStyle.lineHeight,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.s,
            }}
            testID={testID ? `${testID}-unplaced` : undefined}
          >
            {`${unplaced.toLocaleString()} steps from before the watch's first sync today aren't placed in an hour.`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  col: { flex: 1, justifyContent: 'flex-end' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
