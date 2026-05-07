// AmbientPulse — D12 §11.2.4 (Sprint 7.6).
//
// Wraps any element in the live-pulse animation (D12 §7.5). Used by
// VitalRing internally for state='pulsing'; exposed here for cases where
// another element needs the same treatment — e.g. the central hero number
// when a BP cuff is inflating.
//
// When `active` is false, the wrapper is transparent: it passes children
// through unchanged with no animation driver mounted. Under OS reduced
// motion the same transparent path applies regardless of `active` —
// consumers render a static "live" indicator dot per D12 §7.4.

import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  LIVE_PULSE_BPM_DEFAULT,
  livePulseOpacity,
  livePulseScale,
} from '../theme/motion/patterns';
import { useReducedMotion } from '../theme/useReducedMotion';

export interface AmbientPulseProps {
  /** Whether to drive the heartbeat animation. */
  active: boolean;
  /** Heart rate in bpm; clamped to 50–120 visually. Defaults to 50. */
  bpm?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AmbientPulse({
  active,
  bpm = LIVE_PULSE_BPM_DEFAULT,
  children,
  style,
  testID,
}: AmbientPulseProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = active && !reduceMotion;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (shouldAnimate) {
      scale.value = livePulseScale(false, bpm);
      opacity.value = livePulseOpacity(false, bpm);
    } else {
      scale.value = 1;
      opacity.value = 1;
    }
  }, [shouldAnimate, bpm, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, style]} testID={testID}>
      {children}
    </Animated.View>
  );
}
