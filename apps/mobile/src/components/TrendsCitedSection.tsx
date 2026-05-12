// TrendsCitedSection — Trends v2 "The Letter".
//
// The "Cited" footnote rail under the evidence chart. Numbered cards
// presenting each meaningful correlation as evidence the narrative
// above cites. v1.0 doesn't yet wire the inline citation superscripts
// (the Tier-A engine isn't emitting structured spans), so cards are
// numbered 1..N in correlation-strength order — the user reads them
// as a footnote section.
//
// Inputs are the `CorrelationRow[]` from `useTrendsCorrelations`. The
// component computes the strength label + accent colour locally.
// Hidden entirely when the list is empty — per the spec, "restraint
// matters" (D13 §9.1).

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import type { CorrelationRow } from '../types/database';

export const TRENDS_CITED_LABEL = 'Cited';

const CORRELATION_HEADLINE: Record<CorrelationRow['correlation_type'], string> = {
  sleep_x_morning_bp: 'Sleep × morning BP',
  activity_x_resting_hr: 'Activity × resting HR',
  spo2_dip_x_sleep_score: 'SpO2 × sleep score',
};

function strengthLabel(r: number | null): 'Strong' | 'Moderate' | 'Gentle' {
  const abs = Math.abs(r ?? 0);
  if (abs >= 0.6) return 'Strong';
  if (abs >= 0.3) return 'Moderate';
  return 'Gentle';
}

export interface TrendsCitedSectionProps {
  rows: CorrelationRow[];
  /** Override row text body with a calm summary (the engine's
   *  narrative_long lives in correlations.narrative_long; the screen
   *  passes it through). */
  bodyFor?: (row: CorrelationRow) => string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function TrendsCitedSection({
  rows,
  bodyFor,
  style,
  testID,
}: TrendsCitedSectionProps) {
  const theme = useTheme();
  if (rows.length === 0) return null;

  const accentFor = (type: CorrelationRow['correlation_type']): string => {
    switch (type) {
      case 'sleep_x_morning_bp':
        return theme.colors.vital.sleep;
      case 'activity_x_resting_hr':
        return theme.colors.vital.hr;
      case 'spo2_dip_x_sleep_score':
        return theme.colors.vital.spo2;
      default:
        return theme.colors.brand.primary;
    }
  };

  return (
    <View style={[styles.root, style]} testID={testID}>
      <View
        style={[
          styles.eyebrowRow,
          { paddingHorizontal: theme.spacing.l, marginTop: theme.spacing.xl },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.numeric,
            fontSize: 10,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
            color: theme.colors.text.tertiary,
            marginRight: 8,
          }}
          testID={testID ? `${testID}-eyebrow` : undefined}
        >
          {TRENDS_CITED_LABEL}
        </Text>
        <View
          style={{
            flex: 1,
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.border.subtle,
          }}
        />
      </View>

      <View style={{ marginTop: theme.spacing.s }}>
        {rows.map((row, i) => {
          const accent = accentFor(row.correlation_type);
          const headline = CORRELATION_HEADLINE[row.correlation_type] ?? row.correlation_type;
          const body =
            bodyFor?.(row) ??
            row.narrative_long ??
            row.narrative_short ??
            '';
          return (
            <View
              key={row.id}
              style={[
                styles.card,
                {
                  marginHorizontal: theme.spacing.l,
                  marginTop: theme.spacing.s,
                  paddingVertical: theme.spacing.m,
                  paddingHorizontal: theme.spacing.m,
                  borderRadius: theme.radii.m,
                  borderLeftWidth: 2,
                  borderLeftColor: accent,
                  backgroundColor: theme.colors.surface.warmSubtle,
                },
              ]}
              testID={testID ? `${testID}-${i + 1}` : undefined}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fontFamilies.numeric,
                  fontSize: 18,
                  lineHeight: 20,
                  color: accent,
                  letterSpacing: -0.3,
                  marginRight: 14,
                }}
                testID={testID ? `${testID}-${i + 1}-numeral` : undefined}
              >
                {i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fontFamilies.numeric,
                    fontSize: 9,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: accent,
                    marginBottom: 4,
                  }}
                  testID={testID ? `${testID}-${i + 1}-strength` : undefined}
                >
                  {strengthLabel(row.pearson_r)}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fontFamilies.editorial,
                    fontSize: 15,
                    lineHeight: 20,
                    color: theme.colors.text.primary,
                    marginBottom: 4,
                  }}
                  testID={testID ? `${testID}-${i + 1}-headline` : undefined}
                >
                  {headline}
                </Text>
                {body ? (
                  <Text
                    style={[
                      theme.type('bodyM'),
                      { color: theme.colors.text.secondary },
                    ]}
                    testID={testID ? `${testID}-${i + 1}-body` : undefined}
                  >
                    {body}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
  eyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start' },
});
