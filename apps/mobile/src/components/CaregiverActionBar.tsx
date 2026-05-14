// CaregiverActionBar — Sprint 7.7a (caregiver Family Constellation).
//
// Pill-shaped, glass-blurred horizontal action bar designed to sit at the
// bottom of the caregiver home. The consumer (CaregiverHome) is responsible
// for absolute positioning + safe-area insets; this component renders only
// the pill itself so it can be composed into other layouts unchanged.
//
// Anatomy (from `leiko-caregiver-unified.html` → CaregiverActionBar):
//   - Left:  "{count} · all in your circle" — JetBrainsMono Medium 9.5pt,
//            uppercase, text.tertiary, 0.14em letterspacing.
//   - Right: "+ Add someone" — coral, JetBrainsMono Medium 11.5pt, only
//            rendered when `canInvite={true}` (consumer gates this on
//            family_owner + capacity remaining per Sprint 7.7 card).
//
// Voice rules (docs/05-voice-and-claims.md):
//   "all in your circle" — calm, in-voice. "+ Add someone" — verb+object
//   CTA, sentence-cased. No "loved one", no "patient", no fear language.
//
// Glass material follows the existing Card 'glass' elevation pattern: a
// surface.glassMedium floor (so Android < 12 still reads as intentional
// translucency when blur doesn't render) + a BlurView overlay tinted to
// the current colorMode. Hairline border in border.subtle.
//
// No motion lives in this component. The consumer supplies any fade-up /
// safe-area animation; the only press feedback is Pressable's default
// opacity-on-pressed for the invite button.

import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';

export interface CaregiverActionBarProps {
  /** Number of people in the family circle. */
  count: number;
  /** Whether the "+ Add someone" affordance shows. Defaults to false. */
  canInvite?: boolean;
  onInvitePress?: () => void;
  testID?: string;
}

export function CaregiverActionBar({
  count,
  canInvite = false,
  onInvitePress,
  testID,
}: CaregiverActionBarProps) {
  const theme = useTheme();

  const blurTint: 'dark' | 'light' = theme.colorMode === 'dark' ? 'dark' : 'light';

  // Pill container — borderRadius 999, 10/18 padding (per design HTML).
  // Background floor uses glassMedium so the pill is visible when the
  // BlurView falls back (Android < 12) and as a tint when it doesn't.
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: theme.colors.surface.glassMedium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
  };

  // Count label — JetBrainsMono Medium 9.5pt uppercase, text.tertiary.
  const countText = `${count} · all in your circle`;

  return (
    <View style={containerStyle} testID={testID}>
      <BlurView
        intensity={50}
        tint={blurTint}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Text
        style={{
          fontFamily: theme.fontFamilies.numeric,
          // Sprint 16.6 — 9.5pt tertiary read as illegible against the
          // glass-blurred background. 11pt secondary keeps the chip
          // tone but lets the caregiver actually read it.
          fontSize: 11,
          lineHeight: 15,
          letterSpacing: 1,
          color: theme.colors.text.secondary,
          textTransform: 'uppercase',
        }}
        allowFontScaling={false}
      >
        {countText}
      </Text>
      {canInvite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add someone"
          onPress={onInvitePress}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          testID={testID ? `${testID}-invite` : undefined}
        >
          <Text
            style={{
              fontFamily: theme.fontFamilies.numeric,
              fontSize: 11.5,
              lineHeight: 16,
              letterSpacing: 0.46, // ~0.04em at 11.5pt
              color: theme.colors.brand.coral,
            }}
            allowFontScaling={false}
          >
            + Add someone
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
