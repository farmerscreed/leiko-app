// VitalTile — D12 §11.2.2 (Sprint 7.6).
//
// A tappable summary card for one vital. Used in the vital tile strip on the
// Daily Pulse hero. Composes VitalRing (size='sm') + a Phosphor duotone icon
// in the top-left, the vital name uppercase top-right, the pre-formatted
// value at the center (numericL), and an optional secondary line at the
// bottom (caption).
//
// The component is presentational — the consumer pre-formats `value`
// ("128/82", "62 bpm", "97%", "7h 24m", "8,432") and computes `ringFill`
// (0..1) per the D13 §7.1 per-vital formulas. Tile renders what it's given.
//
// Pragmatic deviation from D12 §11.2.2: VitalRing requires a `fill` prop
// but D12 §11.2.2 doesn't list one for the tile. Added `ringFill?: number`
// (default 0) — the composer (DailyPulseHero / future detail screens) will
// pass a meaningful value through. Tile stays presentational.
//
// Motion (D12 §11.2.2):
//   - Tap: motion.pattern.button-press (scale 0.97 spring) — implemented
//     locally with useSharedValue + buttonPressInScale/buttonPressOutScale.
//   - Long-press (>500ms): the destination vital-detail screen ships in
//     Sprint 8.5; for v1.0 the prop is wired but the visual `tile-expand`
//     scale-to-fullscreen is performed by the navigator on the call site.
//     This component just calls the callback.

import { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  DropIcon,
  FootprintsIcon,
  HeartStraightIcon,
  MoonIcon,
  WindIcon,
  type Icon as PhosphorIcon,
} from 'phosphor-react-native';
import { VitalRing, type VitalRingState, type VitalType } from './VitalRing';
import { useTheme } from '../theme';
import { useReducedMotion } from '../theme/useReducedMotion';
import {
  buttonPressInScale,
  buttonPressOutScale,
} from '../theme/motion/patterns';

export type VitalTileState = 'normal' | 'live' | 'stale' | 'no-data';

export interface VitalTileProps {
  vitalType: VitalType;
  /** Pre-formatted display string ("128/82", "62 bpm", "97%", "7h 24m", "8,432"). */
  value: string;
  /** Optional sub-line ("morning", "resting", "last night"). */
  secondary?: string;
  state?: VitalTileState;
  /** Arc fraction 0..1 for the inner VitalRing. Computed by the consumer. */
  ringFill?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const LONG_PRESS_DELAY_MS = 500;
const AMBIENT_GLOW_OPACITY = 0.2; // D12 §11.2.2: live state ambient glow at 20%

const VITAL_ICON: Record<VitalType, PhosphorIcon> = {
  bp: DropIcon,
  hr: HeartStraightIcon,
  spo2: WindIcon,
  sleep: MoonIcon,
  activity: FootprintsIcon,
};

const VITAL_HUMAN_NAME: Record<VitalType, string> = {
  bp: 'Blood pressure',
  hr: 'Heart rate',
  spo2: 'Oxygen',
  sleep: 'Sleep',
  activity: 'Activity',
};

const VITAL_LABEL_UPPERCASE: Record<VitalType, string> = {
  bp: 'BP',
  hr: 'HR',
  spo2: 'SPO2',
  sleep: 'SLEEP',
  activity: 'ACTIVITY',
};

const NO_DATA_FALLBACK = 'No reading yet today';

function tileStateToRingState(state: VitalTileState): VitalRingState {
  switch (state) {
    case 'live':
      return 'pulsing';
    case 'stale':
      return 'stale';
    case 'no-data':
    case 'normal':
    default:
      return 'idle';
  }
}

function composeAccessibilityLabel(
  vitalType: VitalType,
  value: string,
  secondary: string | undefined,
): string {
  const human = VITAL_HUMAN_NAME[vitalType];
  const base = `${human} tile, ${value}`;
  return secondary ? `${base}, ${secondary}` : base;
}

export function VitalTile({
  vitalType,
  value,
  secondary,
  state = 'normal',
  ringFill = 0,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  style,
}: VitalTileProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const ringState = tileStateToRingState(state);
  const isLive = state === 'live';
  const isNoData = state === 'no-data';

  // Resolve secondary line — empty fallback for stale (consumer supplies the
  // real elapsed time string), explicit "No reading yet today" for no-data.
  const resolvedSecondary =
    secondary !== undefined
      ? secondary
      : isNoData
        ? NO_DATA_FALLBACK
        : '';

  // For no-data the ring sits at 0 fill regardless of what was passed.
  const effectiveRingFill = isNoData ? 0 : ringFill;

  const vitalColor = theme.colors.vital[vitalType];
  const IconComponent = VITAL_ICON[vitalType];
  const labelStyle = theme.type('labelUppercase');
  const valueStyle = theme.type('numericL');
  const captionStyle = theme.type('caption');

  // motion.pattern.button-press — shared value driven scale spring.
  const pressScale = useSharedValue(1);
  const pressedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = useCallback(() => {
    pressScale.value = buttonPressInScale(reduceMotion);
  }, [pressScale, reduceMotion]);

  const handlePressOut = useCallback(() => {
    pressScale.value = buttonPressOutScale(reduceMotion);
  }, [pressScale, reduceMotion]);

  const elevation = theme.elevation.low;

  const containerStyle: ViewStyle = {
    backgroundColor: theme.colors.surface.subtle,
    borderRadius: theme.radii.m,
    padding: theme.spacing.l,
    // Rim light on dark mode (matches Card pattern).
    ...(elevation.rimLight
      ? { borderTopWidth: 1, borderTopColor: theme.colors.border.rim }
      : {}),
    // Live-state ambient glow uses the brand accent at 20% (D12 §11.2.2).
    // We render this as a tinted border + iOS shadow tint so it reads on
    // both modes without needing an extra layer.
    ...(isLive
      ? {
          borderWidth: 1,
          borderColor: vitalColor + Math.round(AMBIENT_GLOW_OPACITY * 255).toString(16).padStart(2, '0'),
          shadowColor: vitalColor,
          shadowOffset: elevation.ios.shadowOffset,
          shadowOpacity: AMBIENT_GLOW_OPACITY,
          shadowRadius: elevation.ios.shadowRadius,
        }
      : {
          ...elevation.ios,
          ...elevation.android,
        }),
  };

  const composedA11yLabel =
    accessibilityLabel ?? composeAccessibilityLabel(vitalType, value, secondary);

  const interactive = Boolean(onPress || onLongPress);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={interactive ? handlePressIn : undefined}
      onPressOut={interactive ? handlePressOut : undefined}
      delayLongPress={LONG_PRESS_DELAY_MS}
      accessibilityRole="button"
      accessibilityLabel={composedA11yLabel}
      accessibilityState={{ disabled: !onPress }}
      testID={testID}
      style={style}
    >
      <Animated.View style={[containerStyle, pressedStyle]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <VitalRing
              vitalType={vitalType}
              fill={effectiveRingFill}
              size="sm"
              state={ringState}
            />
            <View style={{ width: theme.spacing.xs }} />
            <IconComponent
              size={theme.iconSize.s}
              color={vitalColor}
              weight="duotone"
              duotoneColor={vitalColor}
              duotoneOpacity={0.5}
            />
          </View>
          <Text
            style={{
              fontFamily: labelStyle.family,
              fontSize: labelStyle.size,
              lineHeight: labelStyle.lineHeight,
              letterSpacing: labelStyle.letterSpacing,
              color: theme.colors.text.tertiary,
            }}
          >
            {VITAL_LABEL_UPPERCASE[vitalType]}
          </Text>
        </View>

        <View style={{ height: theme.spacing.m }} />

        <Text
          style={{
            fontFamily: valueStyle.family,
            fontSize: valueStyle.size,
            lineHeight: valueStyle.lineHeight,
            color: theme.colors.text.primary,
          }}
        >
          {value}
        </Text>

        {resolvedSecondary ? (
          <>
            <View style={{ height: theme.spacing.xs }} />
            <Text
              style={{
                fontFamily: captionStyle.family,
                fontSize: captionStyle.size,
                lineHeight: captionStyle.lineHeight,
                color: theme.colors.text.tertiary,
              }}
            >
              {resolvedSecondary}
            </Text>
          </>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
