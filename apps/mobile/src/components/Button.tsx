// Sourced from docs/03-components/button.md (D8 §3.1). 5 variants × default /
// pressed / disabled / loading / focused. Container uses Pressable so we can
// drive the pressed-state visual through the render-prop style callback (same
// pattern as Pill).
//
// Sprint 1 deviation: the spec calls for a Phosphor `CircleNotch` spinner
// rotating over `motion.linear` 1s in the loading state. We don't ship an icon
// library in Sprint 1, so we substitute react-native's built-in
// <ActivityIndicator size="small" />. The colour is wired to each variant's
// text colour so the spinner reads as the same affordance as the label it
// replaces. Will be swapped for the Phosphor icon when the icon library lands.
//
// Pressed-darken strategy: the spec calls for "background darkens 8% (or
// lightens 8% for ghost/secondary)". We precompute the pressed shade per
// variant rather than applying an opacity overlay — overlays interact with
// transparent variants (ghost, secondary, destructive) in surprising ways
// (the cream surface bleeds through). Precomputed hex keeps the visual
// deterministic and matches the design tokens in spirit (navy.900 darkened
// 8% remains a navy; navy.700 lightened 8% remains a teal). The mix
// helper below is local to this file because it's a presentational concern.
//
// Loading visual: the label Text node is unmounted while loading and the
// spinner is rendered in its place. This satisfies the spec — "Label hidden;
// spinner replaces it" — and crucially keeps the label string out of the
// rendered tree so screen readers and tests do not pick up stale label
// content while the action is in flight (the accessibilityLabel — which
// gains a "loading" suffix — remains the source of truth for assistive
// tech). The container clamps to minTapTarget vertically and grows
// horizontally to fit either label or spinner; in practice the spinner is
// narrower than most CTAs, so the button may shrink slightly when entering
// loading state. Consumers that need stable width should set a fixed width
// via the `style` prop (typical for full-width primary CTAs).

import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps {
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /**
   * Reserved slot — Sprint 1 does not render the icon UI. Accepted on the
   * type so consumers can wire it up; rendering lands when the icon library
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
 * the pressed-state shade (mix toward black for filled, toward white for
 * transparent variants — matches D8 §3.1 "darkens 8% / lightens 8%").
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

const PRESS_AMOUNT = 0.08; // 8% per docs/03-components/button.md states table

function variantPaint(variant: ButtonVariant, theme: ReturnType<typeof useTheme>): VariantPaint {
  const black = '#000000';
  const white = '#FFFFFF';
  switch (variant) {
    case 'primary':
      return {
        background: theme.colors.brand.primary,
        pressedBackground: mixHex(theme.colors.brand.primary, black, PRESS_AMOUNT),
        text: theme.colors.text.onBrand,
      };
    case 'accent':
      return {
        background: theme.colors.brand.accent,
        pressedBackground: mixHex(theme.colors.brand.accent, black, PRESS_AMOUNT),
        text: theme.colors.text.primary,
      };
    case 'secondary':
      // Transparent fill — pressed state lightens by tinting the surface 8%
      // toward white (a subtle scrim behind the label/border).
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
        text: theme.colors.brand.primarySoft,
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
  // type.body-l in parent. The theme.type() helper resolves parent overrides
  // automatically for tokens that have one — but to honour the spec exactly
  // (different token names per mode), we branch here.
  const labelToken = theme.mode === 'parent' ? 'bodyL' : 'label';
  const labelStyle = theme.type(labelToken);

  const interactionDisabled = disabled || loading;

  // accessibilityLabel: visible label + state suffix when relevant
  // ("Sign in, button, loading"). When the consumer supplies an explicit
  // accessibilityLabel we honour it verbatim.
  const labelFromChildren = typeof children === 'string' ? children : undefined;
  const baseA11yLabel = accessibilityLabel ?? labelFromChildren;
  const a11yLabel =
    accessibilityLabel === undefined && loading && baseA11yLabel
      ? `${baseA11yLabel}, button, loading`
      : baseA11yLabel;

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
    <Pressable
      disabled={interactionDisabled}
      onPress={onPress}
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
            transform: [{ scale: pressed && !interactionDisabled ? 0.98 : 1 }],
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
  );
}
