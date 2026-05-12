// TrendsWeeklySummaryCard — Trends v2 "The Letter".
//
// Dashed-border placeholder card for the Tier-C weekly summary slot.
// Copy comes from the design brief; the engine that generates the
// real summary is deferred (Sprint 12.5 follow-up). When the engine
// lands, this component gets swapped for the real renderer; the
// layout slot on Trends stays put so nothing else moves.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export const TRENDS_WEEKLY_EYEBROW = 'Weekly summary · coming soon';
export const TRENDS_WEEKLY_BODY =
  'A short letter, every Sunday, of what your week did.';

export interface TrendsWeeklySummaryCardProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function TrendsWeeklySummaryCard({
  style,
  testID,
}: TrendsWeeklySummaryCardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.root,
        {
          marginHorizontal: theme.spacing.l,
          marginTop: theme.spacing.l,
          padding: theme.spacing.l,
          borderRadius: theme.radii.m,
          borderColor: theme.colors.border.subtle,
        },
        style,
      ]}
      testID={testID}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fontFamilies.numeric,
          fontSize: 9,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: theme.colors.text.tertiary,
          marginBottom: 6,
        }}
        testID={testID ? `${testID}-eyebrow` : undefined}
      >
        {TRENDS_WEEKLY_EYEBROW}
      </Text>
      <Text
        style={[
          theme.type('bodyM'),
          { color: theme.colors.text.secondary },
        ]}
        testID={testID ? `${testID}-body` : undefined}
      >
        {TRENDS_WEEKLY_BODY}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderStyle: 'dashed',
    borderWidth: 1,
    // Subtle wash — the dashed border carries the "placeholder" cue.
  },
});
