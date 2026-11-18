// RestPeriodsCard — daytime rest / nap estimates (2026-11-18).
//
// The watch never reports naps; services/sleep/detectRestPeriods.ts
// estimates them from heart rate staying near the wearer's own sleeping
// level, plus the hourly step timeline when we have it. Every row says
// "estimated" — sitting very still can look the same as a nap.
//
// Voice (docs/05-voice-and-claims.md): descriptive, calm; no claims
// about what the rest means.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { monthDayInZone, timeInZone } from '../utils/timeInZone';
import type { RestPeriod } from '../types/vitals';

export interface RestPeriodsCardProps {
  periods: RestPeriod[];
  timeZone: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const REST_PERIODS_FOOTNOTE =
  'Estimated from your heart rate settling close to its sleeping level during the day. Sitting very still can look the same, so treat these as a guide.';

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function restPeriodRowLabel(p: RestPeriod, timeZone: string): string {
  const day = monthDayInZone(p.startSec * 1000, timeZone);
  const from = timeInZone(p.startSec * 1000, timeZone);
  const to = timeInZone(p.endSec * 1000, timeZone);
  return `${day}, ${from}–${to}`;
}

export function RestPeriodsCard({ periods, timeZone, style, testID }: RestPeriodsCardProps) {
  const theme = useTheme();
  const label = theme.type('labelUppercase');
  const body = theme.type('bodyM');
  const caption = theme.type('caption');

  return (
    <View style={style} testID={testID}>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: label.family,
          fontSize: label.size,
          lineHeight: label.lineHeight,
          letterSpacing: label.letterSpacing,
          color: theme.colors.text.tertiary,
          textTransform: 'uppercase',
          marginHorizontal: 20,
          marginBottom: theme.spacing.s,
        }}
      >
        Daytime rest · estimated
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
            gap: theme.spacing.s,
          },
        ]}
      >
        {periods.map((p) => (
          <View
            key={p.startSec}
            style={styles.row}
            accessible
            accessibilityLabel={`${restPeriodRowLabel(p, timeZone)}, ${durationLabel(p.durationMinutes)}, estimated`}
            testID={testID ? `${testID}-row-${p.startSec}` : undefined}
          >
            <Text
              style={{ flex: 1, fontFamily: body.family, fontSize: body.size, lineHeight: body.lineHeight, color: theme.colors.text.primary }}
            >
              {restPeriodRowLabel(p, timeZone)}
            </Text>
            <Text
              style={{ fontFamily: theme.fontFamilies.numeric, fontSize: body.size, color: theme.colors.text.secondary }}
            >
              {durationLabel(p.durationMinutes)}
            </Text>
          </View>
        ))}
        <Text
          style={{
            fontFamily: caption.family,
            fontSize: caption.size,
            lineHeight: caption.lineHeight,
            color: theme.colors.text.tertiary,
            marginTop: theme.spacing.xs,
          }}
        >
          {REST_PERIODS_FOOTNOTE}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
