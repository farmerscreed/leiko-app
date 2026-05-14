// PersonOrb — Sprint 7.7a (caregiver Family Constellation).
//
// A glowing orb representing one loved one in the caregiver bird's-eye
// view. Composes Portrait inside a halo + status-driven pulse + status
// overlay (attention dot OR sleeping moon glyph), with a name + BP label
// rendered beneath the orb.
//
// Status drives every motion + glow decision:
//   clear / watch     → halo pulses gently (4s cycle)
//   attention / urgent → halo pulses faster + warmer (1.6s cycle)
//   sleeping          → halo static, faded (25% opacity), moon glyph
//   offline           → halo static, dim, no overlay (the StatusPill in
//                        the legend below carries the explicit label)
//
// Reduced motion (D12 §7.4): the halo pulse is DISABLED entirely. Orb
// renders at the static "rest" state. The orb-in entrance also collapses
// to instant.
//
// Accessibility: the orb is a button (per D13 §7.4 Family Circle pattern
// — "Tap → opens immersive Daily Pulse for that parent"). The composed
// label includes name + status + BP so a screen-reader user gets the
// same at-a-glance signal a sighted user does.

import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Portrait } from './Portrait';
import { useTheme } from '../theme';
import { useReducedMotion } from '../theme/useReducedMotion';
import { STATUS_LABEL_FOR, type Status } from './StatusPill';

export interface PersonOrbProps {
  initial: string;
  accent: string;
  status: Status;
  fullName: string;
  /** Pre-formatted BP string, e.g. "122/78". */
  bpLabel: string;
  /** Outer orb diameter in pt. Defaults to 56. */
  diameter?: number;
  /** Position in the constellation (0..N). Drives the entrance stagger. */
  staggerIndex?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const ENTRANCE_BASE_DELAY_MS = 300;
const ENTRANCE_STEP_MS = 150;
const ENTRANCE_DURATION_MS = 800;
const ENTRANCE_EASING = Easing.bezier(0.22, 1, 0.36, 1);

const PULSE_NORMAL_MS = 4000;
const PULSE_ATTENTION_MS = 1600;

const HALO_INSET = -16; // halo bleeds 16pt outside the orb body
const LABEL_GAP = 4;

function isAttentionStatus(s: Status): boolean {
  return s === 'attention' || s === 'urgent' || s === 'watch';
}

function pulseDuration(s: Status): number {
  return isAttentionStatus(s) ? PULSE_ATTENTION_MS : PULSE_NORMAL_MS;
}

function composeAccessibilityLabel(
  fullName: string,
  status: Status,
  bpLabel: string,
): string {
  const firstName = fullName.split(' ')[0];
  const statusLabel = STATUS_LABEL_FOR[status];
  return `${firstName}, ${statusLabel}, blood pressure ${bpLabel}`;
}

export function PersonOrb({
  initial,
  accent,
  status,
  fullName,
  bpLabel,
  diameter = 56,
  staggerIndex = 0,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: PersonOrbProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const isSleeping = status === 'sleeping';
  const isAttention = isAttentionStatus(status);

  // Orb-in entrance: opacity 0→1 + scale 0.7→1, with a per-orb stagger.
  const entranceOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const entranceScale = useSharedValue(reduceMotion ? 1 : 0.7);

  // Halo pulse: opacity oscillates between 0.55 and 0.95, scale between
  // 1 and 1.08. Mirrors the design's `cg-orb-pulse` keyframes.
  const haloOpacity = useSharedValue(isSleeping ? 0.25 : 0.55);
  const haloScale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      entranceOpacity.value = 1;
      entranceScale.value = 1;
      return;
    }
    const delay = ENTRANCE_BASE_DELAY_MS + staggerIndex * ENTRANCE_STEP_MS;
    entranceOpacity.value = withDelay(
      delay,
      withTiming(1, { duration: ENTRANCE_DURATION_MS, easing: ENTRANCE_EASING }),
    );
    entranceScale.value = withDelay(
      delay,
      withTiming(1, { duration: ENTRANCE_DURATION_MS, easing: ENTRANCE_EASING }),
    );
  }, [reduceMotion, staggerIndex, entranceOpacity, entranceScale]);

  useEffect(() => {
    if (reduceMotion || isSleeping) {
      haloOpacity.value = isSleeping ? 0.25 : 0.55;
      haloScale.value = 1;
      return;
    }
    const dur = pulseDuration(status);
    // Sequence: rest → peak → rest, then withRepeat keeps it going.
    haloOpacity.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: dur / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: dur / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: dur / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: dur / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, isSleeping, status, haloOpacity, haloScale]);

  const wrapperAnimatedStyle = useAnimatedStyle(() => ({
    opacity: entranceOpacity.value,
    transform: [{ scale: entranceScale.value }],
  }));

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  // Glow shadow on the orb body. Sleeping = dim; otherwise = bright.
  const orbShadow = isSleeping
    ? {
        shadowColor: accent,
        shadowOpacity: 0.25,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 0 },
      }
    : {
        shadowColor: accent,
        shadowOpacity: 0.55,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
      };

  const composedA11yLabel =
    accessibilityLabel ?? composeAccessibilityLabel(fullName, status, bpLabel);

  const orbBodyOpacity = isSleeping ? 0.65 : 1;
  const overlayBgColor = theme.colors.surface.warmBase;

  return (
    <Animated.View
      style={[styles.root, wrapperAnimatedStyle, style]}
      testID={testID}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={composedA11yLabel}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ width: diameter, height: diameter }}>
          {/* Halo — sits behind the orb, animated opacity/scale */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: HALO_INSET,
                left: HALO_INSET,
                right: HALO_INSET,
                bottom: HALO_INSET,
                borderRadius: 9999,
                backgroundColor: accent + '59', // 35% — radial gradient stand-in
              },
              haloAnimatedStyle,
            ]}
          />

          {/* Orb body — composes Portrait + glow + status overlay */}
          <View style={[orbShadow, { opacity: orbBodyOpacity }]}>
            <Portrait
              initial={initial}
              accent={accent}
              size={diameter <= 44 ? 'sm' : diameter <= 56 ? 'md' : 'lg'}
              style={{ width: diameter, height: diameter, borderRadius: diameter / 2 }}
            />
          </View>

          {/* Attention dot (top-right) — inset slightly from the orb edge */}
          {isAttention ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 8,
                height: 8,
                borderRadius: 99,
                backgroundColor: theme.colors.status[status],
                borderWidth: 1.5,
                borderColor: overlayBgColor,
              }}
            />
          ) : null}

          {/* Sleeping moon (top-right) */}
          {isSleeping ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 14,
                height: 14,
                borderRadius: 99,
                backgroundColor: overlayBgColor,
                borderWidth: 1,
                borderColor: accent + '80',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                allowFontScaling={false}
                style={{ fontSize: 9, color: accent, lineHeight: 11 }}
              >
                {'☾' /* ☾ */}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Name + BP label below the orb */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: diameter + LABEL_GAP,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fontFamilies.editorial,
              // Sprint 16.6 — 14pt editorial serif was rendering too
              // thin against the dark canopy to be readable at a
              // glance. 17pt + 500 weight gives the name presence
              // without breaking the editorial typographic register.
              fontSize: 17,
              lineHeight: 20,
              fontWeight: '500',
              color: theme.colors.text.primary,
            }}
          >
            {fullName.split(' ')[0]}
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: theme.fontFamilies.numeric,
              // Sprint 16.6 — bump 10→12 so BP under the portrait
              // ("147/93", "—") is actually readable.
              fontSize: 12,
              lineHeight: 14,
              fontWeight: '500',
              color: accent,
              letterSpacing: 0.4,
              marginTop: 2,
            }}
          >
            {bpLabel}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
});
