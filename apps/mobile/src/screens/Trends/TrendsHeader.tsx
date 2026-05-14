// TrendsHeader — Sprint 9 / refactored 16.5g.
//
// Big editorial title; mirrors the inline component that used to live
// in `Trends.tsx`. Extracted so the screen body reads cleaner now that
// 16.5g added the lock-aware chips, Tier-B Ask handler, and several
// hooks.

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export function Header({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.root,
        {
          paddingHorizontal: theme.spacing.l,
          paddingTop: theme.spacing.l,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: theme.fontFamilies.editorial,
          fontSize: 30,
          lineHeight: 34,
          color: theme.colors.text.primary,
          letterSpacing: -0.4,
        }}
        testID="trends-header-title"
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {},
});
