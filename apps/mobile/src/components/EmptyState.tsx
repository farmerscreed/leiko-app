// EmptyState — Sprint 16 (offline + error states).
//
// Shared empty-state component. Used by every screen that can render
// with zero data: vital details, Trends, Family Members, Audit Log.
// Sprint 16 ships one component so the voice/visual treatment is
// identical across surfaces — earlier sprints wrote inline empty
// branches that drifted.
//
// Voice rules (docs/05-voice-and-claims.md + D11 §3): calm, never
// "you should", never prescriptive. The component itself is voice-
// neutral (only renders the props the consumer passes); consumers
// must lint their copy.

import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../theme';

export interface EmptyStateProps {
  /** Headline — one short sentence. Sentence-case. */
  title: string;
  /** Body — one or two sentences explaining when data will arrive. */
  body?: string;
  /** Optional CTA. Use sparingly — most empties are passive. */
  cta?: { label: string; onPress: () => void };
  /** Visual lead — an icon or illustration above the title. */
  icon?: ReactNode;
  /** Container padding override. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function EmptyState({
  title,
  body,
  cta,
  icon,
  style,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.root,
        { padding: theme.spacing.xl, gap: theme.spacing.s },
        style,
      ]}
      testID={testID}
      accessibilityRole="text"
    >
      {icon ? <View style={{ marginBottom: theme.spacing.xs }}>{icon}</View> : null}
      <Text
        style={[
          theme.type('headline'),
          { color: theme.colors.text.primary, textAlign: 'center' },
        ]}
        testID={testID ? `${testID}-title` : undefined}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={[
            theme.type('bodyM'),
            { color: theme.colors.text.secondary, textAlign: 'center' },
          ]}
          testID={testID ? `${testID}-body` : undefined}
        >
          {body}
        </Text>
      ) : null}
      {cta ? (
        <View style={{ marginTop: theme.spacing.s }}>
          <Button
            variant="ghost"
            onPress={cta.onPress}
            testID={testID ? `${testID}-cta` : undefined}
          >
            {cta.label}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
