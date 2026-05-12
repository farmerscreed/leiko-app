// SyncReassuranceBanner — Sprint 16.
//
// The "you've been offline a while" banner. Renders ONLY when the
// failure-streak hook reports > 24h since the last successful sync.
// Mounted on Home (both modes) per the sprint card.
//
// Voice rules (docs/05 + D11 §3): the copy is calm reassurance,
// never warning. Verbatim from the sprint card:
//   "Your readings are saved. They'll sync when you're back online."

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { useSyncReassurance } from '../hooks/useSyncReassurance';

export const SYNC_REASSURANCE_COPY =
  "Your readings are saved. They'll sync when you're back online.";

export interface SyncReassuranceBannerProps {
  /** Test seam — bypasses the 24h hook check. */
  forceVisible?: boolean;
  /** Override Date.now for tests. */
  nowProvider?: () => number;
  testID?: string;
}

export function SyncReassuranceBanner({
  forceVisible,
  nowProvider,
  testID,
}: SyncReassuranceBannerProps) {
  const theme = useTheme();
  const fromHook = useSyncReassurance(nowProvider);
  const visible = forceVisible ?? fromHook;

  if (!visible) return null;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.surface.elevated,
          borderColor: theme.colors.border.subtle,
          padding: theme.spacing.l,
          borderRadius: theme.radii.m,
          marginHorizontal: theme.spacing.l,
          marginTop: theme.spacing.m,
        },
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[
          theme.type('bodyM'),
          { color: theme.colors.text.secondary, textAlign: 'center' },
        ]}
        testID={testID ? `${testID}-label` : undefined}
      >
        {SYNC_REASSURANCE_COPY}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: StyleSheet.hairlineWidth },
});
