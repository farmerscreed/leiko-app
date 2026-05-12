// TrendsDoctorInlineLink — Trends v2 "The Letter".
//
// The soft, centred inline link at the bottom of Trends. Replaces the
// v1 "Share with your doctor" / "Save as PDF for my doctor" primary
// CTA. Per the brief, Trends does not surface a PDF affordance —
// only this one-line link that deep-links to "For your doctor" with
// the current range pre-selected.
//
// Mode-aware copy: self-buyer → "your doctor"; caregiver → "their
// doctor". Voice-rule clean.

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import type { AccountType } from '../types/database';

export function trendsDoctorInlineLinkCopy(accountType: AccountType): string {
  return accountType === 'caregiver'
    ? 'Want to put this together for their doctor?'
    : 'Want to put this together for your doctor?';
}

export interface TrendsDoctorInlineLinkProps {
  accountType: AccountType;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function TrendsDoctorInlineLink({
  accountType,
  onPress,
  style,
  testID,
}: TrendsDoctorInlineLinkProps) {
  const theme = useTheme();
  const copy = trendsDoctorInlineLinkCopy(accountType);
  return (
    <View
      style={[
        styles.root,
        {
          paddingHorizontal: theme.spacing.l,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.m,
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={copy}
        testID={testID}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text
          style={{
            fontFamily: theme.fontFamilies.body,
            fontSize: 13,
            lineHeight: 20,
            color: theme.colors.text.secondary,
            textAlign: 'center',
            textDecorationLine: 'underline',
            textDecorationColor: theme.colors.text.tertiary,
          }}
          testID={testID ? `${testID}-label` : undefined}
        >
          {copy}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
});
