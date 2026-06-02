// OnboardingEyebrow — Sprint 19 Block 9 UX-D.
//
// Small uppercase persona breadcrumb shown at the top of each
// onboarding FORM screen so the user always knows which path they're
// on. Pre-Block-9 a user who hesitated mid-flow had no signal whether
// they were setting up as a caregiver or a self-buyer.
//
// Voice rules: short, factual, sentence-uppercase, no fear language.
// Examples: "CAREGIVER · STEP 2 OF 3", "MYSELF · STEP 1 OF 2".

import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export interface OnboardingEyebrowProps {
  /** Persona label, uppercase. e.g. "CAREGIVER" or "MYSELF". */
  persona: string;
  /** 1-indexed step number in the form sequence. */
  step: number;
  /** Total form-step count. */
  total: number;
  testID?: string;
}

export function OnboardingEyebrow({
  persona,
  step,
  total,
  testID = 'onboarding-eyebrow',
}: OnboardingEyebrowProps) {
  const theme = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <Text
        accessibilityLabel={`${persona}, step ${step} of ${total}`}
        style={{
          color: theme.colors.text.tertiary,
          fontSize: 11,
          letterSpacing: 1.4,
          fontFamily: theme.fontFamily.numeric,
          textTransform: 'uppercase',
        }}
      >
        {persona} · STEP {step} OF {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
});
