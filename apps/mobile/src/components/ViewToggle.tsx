// ViewToggle — Sprint 16.6 redesign (caregiver Family Constellation).
//
// Premium-tactile segmented control that flips the caregiver home between
// the bird's-eye constellation view and the editorial detailed-card view.
// Built to feel like a considered hardware switch, not a label-strip:
//
//   · Glass-blurred warm-dark pill with hairline rim + drop shadow so it
//     reads as a control floating above the canopy.
//   · Icon-only — labels were noise. The constellation-dot + stacked-card
//     glyphs are universal at a glance.
//   · An animated coral "thumb" sits behind the icons and slides between
//     positions on selection via Reanimated withSpring (mass 0.8, mild
//     bounce) so the state change feels physical, not abrupt.
//   · Active icon: pure white over the coral thumb (high contrast,
//     reads as "pressed in"). Inactive icon: same white at 55% opacity
//     (visibly tappable, recessive).
//   · Press feedback: per-button scale-down to 0.92 with spring-back on
//     release. Reduced-motion users skip the animation; thumb still
//     snaps to position.
//
// Layout: total pill 96 × 36pt (88pt inner content area). Each tap target
// is 44 × 28pt visually + 4pt hitSlop, comfortably above the iOS 44pt
// guideline.
//
// Voice (docs/05-voice-and-claims.md): the only authored strings are the
// accessibility labels "Bird's-eye view" / "Detailed view" — plain
// language, voice-rule clean.

import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme';
import { useReducedMotion } from '../theme/useReducedMotion';
import type { CaregiverViewMode } from '../hooks/useCaregiverViewMode';

export interface ViewToggleProps {
  /** Current value — usually wired to useCaregiverViewMode().viewMode. */
  value: CaregiverViewMode;
  onChange: (next: CaregiverViewMode) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface SegmentDef {
  key: CaregiverViewMode;
  a11yLabel: string;
  testIDSuffix: string;
}

const SEGMENTS: readonly SegmentDef[] = [
  { key: 'birds', a11yLabel: "Bird's-eye view", testIDSuffix: 'birds' },
  { key: 'cards', a11yLabel: 'Detailed view', testIDSuffix: 'cards' },
] as const;

// Geometry. Total pill: BUTTON_WIDTH*2 + PILL_PADDING*2 = 96pt wide,
// PILL_HEIGHT tall. The thumb sits inside the padded area.
const PILL_HEIGHT = 36;
const PILL_PADDING = 4;
const BUTTON_WIDTH = 44;
const THUMB_HEIGHT = PILL_HEIGHT - PILL_PADDING * 2;

// Alpha suffixes pre-resolved against the relevant base hexes. RN doesn't
// accept oklch() so the design's tone values are converted to sRGB +
// alpha here.
const ALPHA_THUMB_BG = '3D'; // ~24%
const ALPHA_THUMB_BORDER = '80'; // ~50%
const ALPHA_GLASS_FILL = 'D9'; // ~85% — denser than the previous 70% so
//                                the pill reads as a definite surface.
const ALPHA_RIM = '26'; // ~15% — warm-near-white hairline rim.

// Spring config — perceptibly bouncy but settles fast. Mass < 1 makes
// the thumb feel "lively" without overshooting noticeably.
const THUMB_SPRING = { stiffness: 220, damping: 22, mass: 0.8 } as const;
const PRESS_SPRING = { stiffness: 400, damping: 22, mass: 0.6 } as const;
const PRESS_SCALE = 0.92;

function BirdsGlyph({ color, opacity }: { color: string; opacity: number }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" opacity={opacity}>
      <Circle cx={7} cy={9} r={2.5} fill={color} opacity={0.9} />
      <Circle cx={16} cy={6} r={1.8} fill={color} opacity={0.7} />
      <Circle cx={14} cy={16} r={2.2} fill={color} opacity={0.85} />
    </Svg>
  );
}

function DetailedGlyph({ color, opacity }: { color: string; opacity: number }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      opacity={opacity}
    >
      <Rect
        x={4}
        y={5}
        width={16}
        height={4}
        rx={1.2}
        stroke={color}
        strokeWidth={1.8}
      />
      <Rect
        x={4}
        y={11}
        width={16}
        height={4}
        rx={1.2}
        stroke={color}
        strokeWidth={1.8}
      />
      <Rect
        x={4}
        y={17}
        width={16}
        height={2.5}
        rx={1}
        stroke={color}
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function ViewToggle({
  value,
  onChange,
  testID,
  style,
}: ViewToggleProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const blurTint: 'dark' | 'light' =
    theme.colorMode === 'dark' ? 'dark' : 'light';
  const activeIndex = value === 'cards' ? 1 : 0;

  // Thumb position: 0 = birds (left slot), 1 = cards (right slot). A
  // single shared value drives translateX so the spring lands the thumb
  // at exactly BUTTON_WIDTH px when active = cards.
  const thumbPosition = useSharedValue(activeIndex);

  useEffect(() => {
    if (reduceMotion) {
      thumbPosition.value = activeIndex;
    } else {
      thumbPosition.value = withSpring(activeIndex, THUMB_SPRING);
    }
  }, [activeIndex, reduceMotion, thumbPosition]);

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbPosition.value * BUTTON_WIDTH }],
  }));

  const pillStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    width: BUTTON_WIDTH * 2 + PILL_PADDING * 2,
    height: PILL_HEIGHT,
    padding: PILL_PADDING,
    borderRadius: 999,
    backgroundColor: `#140E0A${ALPHA_GLASS_FILL}`, // warm-dark glass
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `#FFFFFF${ALPHA_RIM}`,
    overflow: 'hidden',
    // Drop shadow — makes the pill float above the canopy so it reads
    // as an interactive surface, not flat type.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  };

  const thumbStyle: ViewStyle = {
    position: 'absolute',
    top: PILL_PADDING,
    left: PILL_PADDING,
    width: BUTTON_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 999,
    backgroundColor: `${theme.colors.brand.coral}${ALPHA_THUMB_BG}`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${theme.colors.brand.coral}${ALPHA_THUMB_BORDER}`,
    // Subtle coral glow on the thumb itself — gives the active state a
    // touch of warmth without going neon.
    shadowColor: theme.colors.brand.coral,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  };

  return (
    <View accessibilityRole="radiogroup" style={[pillStyle, style]} testID={testID}>
      <BlurView
        intensity={60}
        tint={blurTint}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Animated thumb — sits behind the icons, slides on selection. */}
      <Animated.View
        pointerEvents="none"
        style={[thumbStyle, thumbAnimatedStyle]}
      />
      {SEGMENTS.map((segment) => {
        const active = value === segment.key;
        return (
          <SegmentButton
            key={segment.key}
            segment={segment}
            active={active}
            reduceMotion={reduceMotion}
            iconColor={theme.colors.text.primary}
            onPress={() => {
              // No-op on tap of the already-active segment — avoids a
              // spring trigger that produces a small visible "settle"
              // when the thumb is already at the target.
              if (!active) onChange(segment.key);
            }}
            testID={testID ? `${testID}-${segment.testIDSuffix}` : undefined}
          />
        );
      })}
    </View>
  );
}

interface SegmentButtonProps {
  segment: SegmentDef;
  active: boolean;
  reduceMotion: boolean;
  iconColor: string;
  onPress: () => void;
  testID?: string;
}

function SegmentButton({
  segment,
  active,
  reduceMotion,
  iconColor,
  onPress,
  testID,
}: SegmentButtonProps) {
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    if (!reduceMotion) {
      pressScale.value = withSpring(PRESS_SCALE, PRESS_SPRING);
    }
  };
  const handlePressOut = () => {
    if (!reduceMotion) {
      pressScale.value = withSpring(1, PRESS_SPRING);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={segment.a11yLabel}
      accessibilityState={{ selected: active }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      hitSlop={4}
      testID={testID}
      style={{
        width: BUTTON_WIDTH,
        height: THUMB_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          { alignItems: 'center', justifyContent: 'center' },
          animatedStyle,
        ]}
      >
        {segment.key === 'birds' ? (
          <BirdsGlyph color={iconColor} opacity={active ? 1 : 0.55} />
        ) : (
          <DetailedGlyph color={iconColor} opacity={active ? 1 : 0.55} />
        )}
      </Animated.View>
    </Pressable>
  );
}
