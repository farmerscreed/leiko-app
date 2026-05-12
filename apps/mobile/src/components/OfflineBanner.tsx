// OfflineBanner — Sprint 16 (offline + error states).
//
// Mounted globally in RootNavigator. Renders a calm one-line bar at
// the top of the safe area when the network status hook reports an
// unambiguous offline state (debounced 5s in the hook itself so a
// flicker doesn't flash the banner).
//
// Voice rules (docs/05 + D11 §3): the banner is reassurance, not
// warning. It tells the user their captured data is safe and will
// sync — never "Connection lost" or "Error".

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const OFFLINE_BANNER_COPY = "You're offline. We'll sync when you're back.";

export interface OfflineBannerProps {
  /** Override the network-status hook for tests. */
  forceOffline?: boolean;
  testID?: string;
}

export function OfflineBanner({
  forceOffline,
  testID,
}: OfflineBannerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { offline } = useNetworkStatus();
  const visible = forceOffline ?? offline;

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        {
          paddingTop: insets.top + theme.spacing.xs,
          paddingBottom: theme.spacing.xs,
          paddingHorizontal: theme.spacing.l,
          backgroundColor: theme.colors.surface.elevated,
          borderBottomColor: theme.colors.border.subtle,
        },
      ]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[
          theme.type('bodyM'),
          { color: theme.colors.text.secondary, textAlign: 'center' },
        ]}
        testID={testID ? `${testID}-label` : undefined}
      >
        {OFFLINE_BANNER_COPY}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 100,
  },
});
