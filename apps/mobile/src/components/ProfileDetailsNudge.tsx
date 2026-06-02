// ProfileDetailsNudge — ADR-0006 follow-up.
//
// Calm home banner shown to a WEARER whose profile is missing the
// demographics the watch needs for accurate step + calorie counts
// (gender / height / weight). Onboarding keeps signup short, so this
// nudges the values afterward.
//
// Copy rule (founder note): name the BENEFIT concretely, not a generic
// "complete your profile". People fill it in when they understand WHY —
// the watch uses height/weight/age to count steps and calories
// accurately. Voice rules: plain, calm, no fear, no "patient".
//
// Dismissible. The consumer persists dismissal so it doesn't nag, and
// hides it entirely once the fields are filled.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export interface ProfileDetailsNudgeProps {
  /** Open Settings → Profile so the user can fill the missing fields. */
  onAddDetails: () => void;
  /** Dismiss for now (consumer persists so it doesn't reappear constantly). */
  onDismiss: () => void;
  testID?: string;
}

export function ProfileDetailsNudge({
  onAddDetails,
  onDismiss,
  testID,
}: ProfileDetailsNudgeProps) {
  const theme = useTheme();
  const bodyStyle = theme.type('bodyM');
  const labelStyle = theme.type('label');

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
        style={{
          fontFamily: bodyStyle.family,
          fontSize: bodyStyle.size,
          lineHeight: bodyStyle.lineHeight,
          color: theme.colors.text.primary,
          marginBottom: theme.spacing.s,
        }}
        testID={testID ? `${testID}-title` : undefined}
      >
        Add a few details for accurate step and calorie counts.
      </Text>
      <Text
        style={{
          fontFamily: bodyStyle.family,
          fontSize: bodyStyle.size,
          lineHeight: bodyStyle.lineHeight,
          color: theme.colors.text.secondary,
          marginBottom: theme.spacing.m,
        }}
      >
        Your watch uses your height, weight, and age to turn movement into
        real numbers. Without them, steps and calories are rough estimates.
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.l }}>
        <Pressable
          onPress={onAddDetails}
          accessibilityRole="button"
          accessibilityLabel="Add my details"
          hitSlop={8}
          testID={testID ? `${testID}-add` : undefined}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <Text
            style={{
              fontFamily: labelStyle.family,
              fontSize: labelStyle.size,
              color: theme.colors.brand.coral,
            }}
          >
            Add my details
          </Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          hitSlop={8}
          testID={testID ? `${testID}-dismiss` : undefined}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <Text
            style={{
              fontFamily: labelStyle.family,
              fontSize: labelStyle.size,
              color: theme.colors.text.secondary,
            }}
          >
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 0.5 },
});
