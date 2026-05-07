// Sourced from docs/_reference/D12-visual-system-v2.md §11.1 (Button — D12
// migration: new color tokens, new radius (m=14 — automatic via theme.radii.m),
// spring press animation, haptic.tick on press) and the original Sprint 1
// anatomy in docs/03-components/button.md.
//
// Sprint 1.5 changes from D8:
//   - Press animation is a Reanimated spring (motion.pattern.button-press
//     in D12 §7.3) instead of a static `transform: scale(0.98)`. Scale
//     target tightened to 0.97 per spec.
//   - haptic.tick fires on press (D12 §11.1 + §9 — selectionAsync on iOS,
//     KEYBOARD_TAP on Android, no-op on devices without haptics).
//   - Color references migrated off the buildTheme compat shims:
//     * brand.accent      → brand.primary  (D12 collapsed accent → primary; same hex now)
//     * brand.primarySoft → text.secondary (sub-emphasis text on default surface)
//
// Sprint 1 deviation retained: spec calls for a Phosphor `CircleNotch`
// spinner. Phosphor library is installed in Sprint 7.6; until then the
// loading state uses RN's <ActivityIndicator size="small" /> tinted to
// each variant's text colour.
//
// Pressed-darken strategy: the spec calls for "background darkens 8% (or
// lightens 8% for ghost/secondary)". Precomputed shade per variant rather
// than an opacity overlay — overlays interact with transparent variants
// (ghost, secondary, destructive) in surprising ways (the surface bleeds
// through). The precomputed hex keeps the visual deterministic.
//
// Loading visual: the label Text node is unmounted while loading and the
// spinner is rendered in its place. This satisfies the spec — "Label hidden;
// spinner replaces it" — and keeps the label string out of the rendered tree
// so screen readers and tests do not pick up stale label content while the
// action is in flight (the accessibilityLabel — which gains a "loading"
// suffix — remains the source of truth for assistive tech).

import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { buttonPressInScale, buttonPressOutScale } from '../theme/motion/patterns';
import { fireHaptic } from '../theme/tokens/haptics';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps {
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /**
   * Reserved slot — Phosphor library lands in Sprint 7.6. Accepted on the
   * type so consumers can wire it up; rendering wires when the icon library
   * does.
   */
  leadingIcon?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

interface VariantPaint {
  background: string;
  pressedBackground: string;
  text: string;
  borderColor?: string;
}

/**
 * Mix a #rrggbb hex colour with another #rrggbb hex colour by `amount` (0–1).
 * `amount = 0` returns `hex`, `amount = 1` returns `mixWith`. Used to compute
 * the pressed-state shade.
 */
function mixHex(hex: string, mixWith: string, amount: number): string {
  const a = hex.replace('#', '');
  const b = mixWith.replace('#', '');
  const ar = parseInt(a.slice(0, 2), 16);
  const ag = parseInt(a.slice(2, 4), 16);
  const ab = parseInt(a.slice(4, 6), 16);
  const br = parseInt(b.slice(0, 2), 16);
  const bg = parseInt(b.slice(2, 4), 16);
  const bb = parseInt(b.slice(4, 6), 16);
  const r = Math.round(ar + (br - ar) * amount);
  const g = Math.round(ag + (bg - ag) * amount);
  const bl = Math.round(ab + (bb - ab) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

const PRESS_AMOUNT = 0.08;

function variantPaint(variant: ButtonVariant, theme: ReturnType<typeof useTheme>): VariantPaint {
  const black = '#000000';
  const white = '#FFFFFF';
  switch (variant) {
    case 'primary':
    case 'accent':
      // D12 collapsed brand.accent → brand.primary; both variants paint identically.
      return {
        background: theme.colors.brand.primary,
        pressedBackground: mixHex(theme.colors.brand.primary, black, PRESS_AMOUNT),
        text: theme.colors.text.onBrand,
      };
    case 'secondary':
      return {
        background: 'transparent',
        pressedBackground: mixHex(theme.colors.surface.base, white, PRESS_AMOUNT),
        text: theme.colors.brand.primary,
        borderColor: theme.colors.brand.primary,
      };
    case 'ghost':
      return {
        background: 'transparent',
        pressedBackground: mixHex(theme.colors.surface.base, white, PRESS_AMOUNT),
        text: theme.colors.text.secondary,
      };
    case 'destructive':
      return {
        background: 'transparent',
        pressedBackground: mixHex(theme.colors.surface.base, white, PRESS_AMOUNT),
        text: theme.colors.state.urgent,
        borderColor: theme.colors.state.urgent,
      };
  }
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  children,
}: ButtonProps) {
  const theme = useTheme();
  const paint = variantPaint(variant, theme);

  // Per docs/03-components/button.md anatomy: type.label in caregiver,
  // type.body-l in parent.
  const labelToken = theme.typeMode === 'parent' ? 'bodyL' : 'label';
  const labelStyle = theme.type(labelToken);

  const interactionDisabled = disabled || loading;

  const labelFromChildren = typeof children === 'string' ? children : undefined;
  const baseA11yLabel = accessibilityLabel ?? labelFromChildren;
  const a11yLabel =
    accessibilityLabel === undefined && loading && baseA11yLabel
      ? `${baseA11yLabel}, button, loading`
      : baseA11yLabel;

  // Reanimated spring press — motion.pattern.button-press (D12 §7.3).
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (interactionDisabled) return;
    scale.value = buttonPressInScale(theme.reduceMotion);
  };
  const handlePressOut = () => {
    if (interactionDisabled) return;
    scale.value = buttonPressOutScale(theme.reduceMotion);
  };
  const handlePress = () => {
    // Fire-and-forget haptic. Swallow errors so a haptic-unavailable device
    // (or simulator) never propagates an unhandled rejection.
    fireHaptic('tick').catch(() => undefined);
    onPress?.();
  };

  const containerBase: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.radii.m,
    minHeight: theme.minTapTarget,
    borderWidth: paint.borderColor ? 1 : 0,
    borderColor: paint.borderColor,
    opacity: disabled ? theme.opacity.disabled : 1,
  };

  const textStyle: TextStyle = {
    fontSize: labelStyle.size,
    lineHeight: labelStyle.lineHeight,
    fontFamily: labelStyle.family,
    fontWeight: labelStyle.weight as TextStyle['fontWeight'],
    color: paint.text,
    textAlign: 'center',
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={interactionDisabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || undefined, busy: loading || undefined }}
        accessibilityLabel={a11yLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        style={({ pressed }) => {
          const showPressedLook = (pressed && !interactionDisabled) || loading;
          return [
            containerBase,
            {
              backgroundColor: showPressedLook ? paint.pressedBackground : paint.background,
            },
            style,
          ];
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={paint.text} />
        ) : (
          <Text style={textStyle}>{children}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
