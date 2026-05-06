// Sourced from docs/03-components/pill.md (D8 §3.13). 6 variants × default /
// pressed / selected / disabled. Static pills render as <View accessibilityRole="text">;
// pills with onPress render as <Pressable accessibilityRole="button"> with a hitSlop
// large enough that the touch target meets 48pt (caregiver) / 64pt (parent).
//
// Sprint 1 deviation: the spec calls for a 12pt Phosphor `Check` icon when the
// `selected` state is active. We don't ship an icon library in Sprint 1, so the
// `selected` flip is a colour change only. Color is normally not the sole signal,
// per docs/02-design-tokens.md §1.3 — the visible text on a filter chip provides
// the secondary signal until the icon lands in a later sprint.

import { type ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

export type PillVariant = 'neutral' | 'info' | 'accent' | 'urgent' | 'success' | 'outline';

interface PillProps {
  variant?: PillVariant;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  leadingIcon?: ReactNode;
  children: ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface VariantStyle {
  background: string;
  text: string;
  borderColor?: string;
}

function variantStyle(
  variant: PillVariant,
  theme: ReturnType<typeof useTheme>,
): VariantStyle {
  switch (variant) {
    case 'neutral':
      return { background: theme.colors.surface.subtle, text: theme.colors.text.primary };
    case 'info':
      return { background: theme.colors.surface.subtle, text: theme.colors.brand.primarySoft };
    case 'accent':
      return { background: theme.colors.brand.accent, text: theme.colors.text.primary };
    case 'urgent':
      return { background: theme.colors.state.urgent, text: theme.colors.text.onBrand };
    case 'success':
      // color.state.success at 15% on cream — composited via rgba so the cream
      // surface shows through. Keeps the green legible without darkening to
      // urgent levels (D8 §3.13 success row).
      return { background: 'rgba(47, 122, 63, 0.15)', text: theme.colors.state.success };
    case 'outline':
      return {
        background: 'transparent',
        text: theme.colors.text.primary,
        borderColor: theme.colors.border.default,
      };
  }
}

export function Pill({
  variant = 'neutral',
  selected = false,
  disabled = false,
  onPress,
  leadingIcon,
  children,
  accessibilityLabel,
  style,
  testID,
}: PillProps) {
  const theme = useTheme();
  const palette = variantStyle(selected ? 'accent' : variant, theme);
  const labelStyle = theme.type('caption');

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: palette.background,
    borderWidth: palette.borderColor ? 1 : 0,
    borderColor: palette.borderColor,
    opacity: disabled ? theme.opacity.disabled : 1,
    alignSelf: 'flex-start',
  };

  const textStyle: TextStyle = {
    fontSize: labelStyle.size,
    lineHeight: labelStyle.lineHeight,
    fontFamily: labelStyle.family,
    fontWeight: '700',
    color: palette.text,
  };

  const labelFromChildren = typeof children === 'string' ? children : undefined;
  const a11yLabel = accessibilityLabel ?? labelFromChildren;

  // Hit-slop large enough to clear the 48pt (caregiver) / 64pt (parent) tap
  // target. Caption is 12–13pt + spacing.xs vertical padding (4pt each side)
  // ≈ 24pt tall; 20pt slop top+bottom puts us at 64pt which clears both modes.
  const hitSlop = { top: 20, bottom: 20, left: 12, right: 12 };

  if (onPress) {
    return (
      <Pressable
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={a11yLabel}
        hitSlop={hitSlop}
        testID={testID}
        style={({ pressed }) => [
          containerStyle,
          pressed && !disabled ? { opacity: 0.92 } : null,
          style,
        ]}
      >
        {leadingIcon ? <View style={{ marginRight: theme.spacing.xs }}>{leadingIcon}</View> : null}
        <Text style={textStyle}>{children}</Text>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      testID={testID}
      style={[containerStyle, style]}
    >
      {leadingIcon ? <View style={{ marginRight: theme.spacing.xs }}>{leadingIcon}</View> : null}
      <Text style={textStyle}>{children}</Text>
    </View>
  );
}
