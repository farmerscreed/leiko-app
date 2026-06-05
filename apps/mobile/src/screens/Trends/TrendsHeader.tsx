// TrendsHeader — Sprint 9 / refactored 16.5g.
//
// Big editorial title; mirrors the inline component that used to live
// in `Trends.tsx`. Extracted so the screen body reads cleaner now that
// 16.5g added the lock-aware chips, Tier-B Ask handler, and several
// hooks.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export function Header({
  title,
  onBack,
}: {
  title: string;
  /** 2026-06-05 — the screen previously had NO on-screen way back
   *  (hardware back only); the original design comment promised one. */
  onBack?: () => void;
}) {
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
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={theme.spacing.m}
          testID="trends-back"
          style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.m }}
        >
          <Text
            style={{
              color: theme.colors.brand.primary,
              fontSize: theme.type('bodyM').size,
              fontFamily: theme.type('bodyM').family,
              fontWeight: '500',
            }}
          >
            Back
          </Text>
        </Pressable>
      ) : null}
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
