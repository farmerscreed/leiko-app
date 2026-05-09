// SettingsSection — Sprint 10b.1, premium polish.
//
// Card-grouped Settings rows in the Apple/iOS pattern, dialed up for
// the brand's "premium-precise" voice (D11 §3.5 Aesop test): generous
// section gaps, refined uppercase labels with the labelUppercase token
// (D12 §3.4 — purpose-built for this), card lifted with a 1px subtle
// rim + medium elevation so it reads as a discrete object on the
// warm-base background.
//
// Sourced from D12 §3 (typography), §4 (spacing), §5 (radii), §6
// (surfaces + elevation).

import { Platform, Text, View, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { useTheme } from '../theme';

export interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  /** Trims the top spacing — used for the first section so it doesn't
   *  stack a full inter-section gap on top of the screen header. */
  first?: boolean;
  testID?: string;
}

export function SettingsSection({
  title,
  children,
  first = false,
  testID,
}: SettingsSectionProps) {
  const theme = useTheme();
  const labelStyle = theme.type('labelUppercase');

  // Cards lift with HIGH elevation — heavy cast shadow gives a strong
  // "floating slab" presence. Combined with the top rim highlight
  // (light catching the upper edge), the card reads as a 3D object on
  // the warm-base background. Per D12 §6.1 — shadows go below + rim
  // light goes above.
  const cardElevation =
    Platform.OS === 'ios'
      ? theme.elevation.high.ios
      : theme.elevation.high.android;

  const cardStyle: ViewStyle = {
    marginHorizontal: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface.warmElevated,
    // Top-edge rim catches the light. Sides + bottom intentionally
    // borderless so the cast shadow does the lifting alone.
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopColor: theme.colors.border.rim,
    overflow: 'hidden',
    paddingVertical: theme.spacing.xs,
    ...cardElevation,
  };

  // The shadow needs space to breathe — without an outer container
  // with margin the shadow on Android gets clipped by the parent
  // ScrollView's content bounds. The shadow-friendly outer wraps the
  // card with vertical headroom so the cast shadow renders fully.
  return (
    <View
      style={{
        marginTop: first ? theme.spacing.l : theme.spacing.xxxl,
        // Bottom margin matches the elevation's shadow radius so the
        // soft fall-off doesn't overlap the next section's header.
        paddingBottom: theme.spacing.s,
      }}
      testID={testID}
    >
      <View
        accessibilityRole="header"
        style={{
          paddingHorizontal: theme.spacing.xl,
          marginBottom: theme.spacing.s,
        }}
      >
        <Text
          style={{
            color: theme.colors.text.tertiary,
            fontSize: labelStyle.size,
            lineHeight: labelStyle.lineHeight,
            fontFamily: labelStyle.family,
            fontWeight: labelStyle.weight as '500',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>
      </View>
      <View style={cardStyle}>{children}</View>
    </View>
  );
}
