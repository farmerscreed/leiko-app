// ErrorState — Sprint 16 (offline + error states).
//
// Shared error surface. Calm cause + suggested fix; never escalating
// language. Per the sprint card and D11 §3: error copy is friendly
// and reassuring. Never "Failure" or "Critical" or "Error" as a
// headline — phrase as a moment, not a verdict.
//
// Voice rules: this component is voice-neutral; consumers pass the
// strings. Defaults are deliberately benign.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { useTheme } from '../theme';

export interface ErrorStateProps {
  /** Calm headline. Default: "We couldn't load that just now." */
  title?: string;
  /** Body explaining the cause + suggested action. */
  body?: string;
  /** Retry CTA. Label defaults to "Try again". */
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_TITLE = "We couldn't load that just now.";
const DEFAULT_BODY = 'Check your connection and try again in a moment.';
const DEFAULT_RETRY_LABEL = 'Try again';

export function ErrorState({
  title = DEFAULT_TITLE,
  body = DEFAULT_BODY,
  onRetry,
  retryLabel = DEFAULT_RETRY_LABEL,
  style,
  testID,
}: ErrorStateProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.root,
        { padding: theme.spacing.xl, gap: theme.spacing.s },
        style,
      ]}
      testID={testID}
      accessibilityRole="alert"
    >
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
      {onRetry ? (
        <View style={{ marginTop: theme.spacing.s }}>
          <Button
            variant="ghost"
            onPress={onRetry}
            testID={testID ? `${testID}-retry` : undefined}
            accessibilityHint="Retries the last action."
          >
            {retryLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
