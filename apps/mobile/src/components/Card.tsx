// Sourced from docs/03-components/card.md (D8 §3 — generic surface container).
// Anatomy: radii.m, spacing.l padding, color.surface.subtle on cream by default
// (no shadow). Elevated variants (low / medium / high) switch background to
// color.surface.elevated and apply navy-tinted shadows from theme.elevation.
//
// Sprint 1 deviations (per docs/03-components/card.md "Sprint 1 deliverables"):
//   - 'swipeable' behavioural variant is DEFERRED. Public API does not expose
//     it; reintroducing it later is additive (a new optional prop) and won't
//     break callers.
//   - 'loading' state (skeleton overlay, D8 §3.12) is DEFERRED. The API leaves
//     room: a future `loading?: boolean` prop can layer the overlay without
//     changing existing call sites. Not implemented now — we don't ship a
//     skeleton primitive yet.
//
// Elevation shape: theme.elevation[token] returns { ios: {...}, android: {...} }.
// We spread BOTH onto the style object — RN silently ignores the other
// platform's fields, so no Platform.OS branching is required.
//
// Accessibility: static cards intentionally have NO accessibilityRole (the spec
// says don't impose one — let the children speak). Tappable cards get
// accessibilityRole="button" plus an accessibilityLabel that describes the
// destination ("Mum's reading card, opens reading detail"). When onPress is
// set without an accessibilityLabel, we warn in development — silent screen
// readers are an a11y bug.

import { type ReactNode } from 'react';
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, type ElevationToken } from '../theme';

export type CardElevation = Extract<ElevationToken, 'none' | 'low' | 'medium' | 'high'> | 'default';

interface CardProps {
  /**
   * Visual elevation. 'default' is the cream-friendly variant (no shadow,
   * taupe surface). 'low' | 'medium' | 'high' switch to the white elevated
   * surface with navy-tinted shadow.
   */
  elevation?: 'default' | 'low' | 'medium' | 'high';
  /**
   * Presence of onPress flips the card from static (View, no role) to
   * tappable (Pressable, accessibilityRole="button"). When set,
   * `accessibilityLabel` should be provided — we warn at runtime when it
   * isn't.
   */
  onPress?: () => void;
  disabled?: boolean;
  /**
   * Required when `onPress` is set. Describes the destination
   * (e.g. "Mum's reading card, opens reading detail").
   */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function Card({
  elevation = 'default',
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
  children,
}: CardProps) {
  const theme = useTheme();

  // 'default' uses the taupe surface on cream and no shadow. Elevated tiers
  // (low / medium / high) switch to white with the matching tinted shadow.
  const isFlat = elevation === 'default';
  const elevationKey: ElevationToken = isFlat ? 'none' : elevation;
  const elevationStyle = theme.elevation[elevationKey];

  const containerStyle: ViewStyle = {
    backgroundColor: isFlat ? theme.colors.surface.subtle : theme.colors.surface.elevated,
    borderRadius: theme.radii.m,
    padding: theme.spacing.l,
    opacity: disabled ? theme.opacity.disabled : 1,
    // RN ignores platform-irrelevant shadow fields, so we spread both.
    ...elevationStyle.ios,
    ...elevationStyle.android,
  };

  if (onPress) {
    if (__DEV__ && !accessibilityLabel) {
      console.warn(
        'Card: tappable cards (cards with onPress) must supply an ' +
          'accessibilityLabel that describes the destination — e.g. ' +
          '"Mum\'s reading card, opens reading detail".',
      );
    }

    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          containerStyle,
          // Press feedback per spec: 0.98 scale over motion.fast. The duration
          // token is referenced for parity with the spec; the transform is
          // synchronous in RN's Pressable feedback loop.
          pressed && !disabled ? { transform: [{ scale: 0.98 }] } : null,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[containerStyle, style]}>
      {children}
    </View>
  );
}
