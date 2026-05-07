// DailyPulseHero — D12 §11.2.3 + D13 §7 (Sprint 7.6).
//
// The signature component of the app. Five concentric VitalRing instances
// (BP outermost → Activity innermost) plus the central value, central
// label, and AI narration line. Two modes: `immersive` fills the screen
// (Self-Buyer Home), `card` is the scaled-down version inside each
// parent's card on Caregiver Home (the Family Circle pattern).
//
// Composition: 5 VitalRing instances stacked concentrically using the
// extended `diameter` + `strokeWidth` props. The signature
// daily-pulse-reveal choreography (D12 §7.3) is split:
//   - Each ring fades in (opacity 0→1) over 200ms, staggered 80ms per
//     ring (BP→HR→SpO2→Sleep→Activity). DailyPulseHero drives the
//     opacity wrapper.
//   - Each ring's arc fills (0→target) over 720ms cinematic, beginning
//     after that ring's opacity completes. VitalRing's `fillDelayMs`
//     prop receives the per-ring delay and runs the existing internal
//     fill animation.
//   - The narration line fades in 200ms after the last ring starts
//     filling (per D12 §7.3 / dailyPulseRevealNarrationOpacity).
//
// Reduced motion (D12 §7.4): rings render at idle state with their final
// fill, opacity 1 immediately. No staggered animation. Narration opacity
// 1 immediately.
//
// Accessibility (D12 §11.2.3): single tappable region with a composed
// accessibilityLabel that reads the central value + every vital ring +
// the narration. The component is passed `parentName` (for caregiver
// mode) so the label can address the right person.
//
// D13 §7.1 fill formulas: each ring's `fill` is computed by the consumer
// from per-vital data. DailyPulseHero accepts pre-computed
// `RingState { fill: number; state: VitalRingState }` per vital so the
// composition stays presentational.
//
// D12 §11.2.3 visual ambiguity: the spec says "five concentric arcs,
// each occupying ~60° of arc... arranged like a flower or atom" but
// D13 §7.1 describes them as outer → inner concentric rings with
// 0–100% fill formulas. We render full-circle concentric rings at
// progressively smaller diameters per D13's "outer → inner" language.
// The "60° of arc" wording in D12 reads as a designer-level Figma cue
// for how the arc fills LOOK at typical fill levels, not a literal
// 60° per ring constraint. Designer's Figma is the tiebreaker.

import { Fragment, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';
import { VitalRing, type VitalType, type VitalRingState } from './VitalRing';
import { useTheme } from '../theme';
import { useReducedMotion } from '../theme/useReducedMotion';
import {
  dailyPulseRevealNarrationOpacity,
  dailyPulseRevealOpacity,
} from '../theme/motion/patterns';

export type DailyPulseHeroMode = 'immersive' | 'card';

export interface VitalRingState_ {
  fill: number;
  state?: VitalRingState;
}

export interface DailyPulseHeroVitals {
  bp: VitalRingState_;
  hr: VitalRingState_;
  spo2: VitalRingState_;
  sleep: VitalRingState_;
  activity: VitalRingState_;
}

export interface DailyPulseHeroProps {
  vitals: DailyPulseHeroVitals;
  /** The hero number — pre-computed by `computeDailyPulseCentral` per D13 §7.2. */
  centralValue: string;
  /** Short label under the central value ("morning BP", "resting HR", "last night"). */
  centralLabel: string;
  /** AI-generated daily readiness sentence. Voice rules apply at the source. */
  aiNarration?: string;
  mode?: DailyPulseHeroMode;
  /** Used in the composed accessibilityLabel ("Daily pulse for {parentName}"). */
  parentName?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface RingDef {
  vitalType: VitalType;
  diameter: number;
  strokeWidth: number;
}

// Five concentric ring sizes, outer → inner. Picked so each ring's stroke
// has at least 8pt of gap to the next ring's outer edge — the constellation
// reads as five distinct rings, not a single thick stroke band.
const IMMERSIVE_RINGS: RingDef[] = [
  { vitalType: 'bp', diameter: 280, strokeWidth: 14 },
  { vitalType: 'hr', diameter: 232, strokeWidth: 12 },
  { vitalType: 'spo2', diameter: 188, strokeWidth: 10 },
  { vitalType: 'sleep', diameter: 148, strokeWidth: 8 },
  { vitalType: 'activity', diameter: 112, strokeWidth: 8 },
];

const CARD_RINGS: RingDef[] = [
  { vitalType: 'bp', diameter: 192, strokeWidth: 10 },
  { vitalType: 'hr', diameter: 160, strokeWidth: 8 },
  { vitalType: 'spo2', diameter: 130, strokeWidth: 7 },
  { vitalType: 'sleep', diameter: 102, strokeWidth: 6 },
  { vitalType: 'activity', diameter: 76, strokeWidth: 5 },
];

const STAGGER_MS = 80;
const OPACITY_REVEAL_MS = 200; // duration.normal — see motion/patterns.ts

const VITAL_HUMAN_NAME: Record<VitalType, string> = {
  bp: 'Blood pressure',
  hr: 'Heart rate',
  spo2: 'Oxygen',
  sleep: 'Sleep',
  activity: 'Activity',
};

function ringIndexForVital(vitalType: VitalType): number {
  switch (vitalType) {
    case 'bp':
      return 0;
    case 'hr':
      return 1;
    case 'spo2':
      return 2;
    case 'sleep':
      return 3;
    case 'activity':
      return 4;
  }
}

function composeAccessibilityLabel(
  vitals: DailyPulseHeroVitals,
  centralValue: string,
  centralLabel: string,
  aiNarration: string | undefined,
  parentName: string | undefined,
): string {
  const subject = parentName ? `Daily pulse for ${parentName}` : 'Daily pulse';
  const parts: string[] = [subject];
  parts.push(`${centralLabel} ${centralValue}`);
  // Read each vital's fill as a percentage so screen-reader users hear
  // the same trend information as visual users.
  const vitalEntries: Array<[VitalType, VitalRingState_]> = [
    ['bp', vitals.bp],
    ['hr', vitals.hr],
    ['spo2', vitals.spo2],
    ['sleep', vitals.sleep],
    ['activity', vitals.activity],
  ];
  for (const [type, ring] of vitalEntries) {
    const pct = Math.round(Math.max(0, Math.min(1, ring.fill)) * 100);
    parts.push(`${VITAL_HUMAN_NAME[type]} ${pct} percent`);
  }
  if (aiNarration) parts.push(aiNarration);
  return parts.join('. ');
}

interface RingWrapperProps {
  index: number;
  reduceMotion: boolean;
  children: ReactNode;
}

// Drives a per-ring opacity 0→1 staggered reveal via the daily-pulse-reveal
// motion pattern. Each ring's wrapper hooks the pattern at its own index.
function RingWrapper({ index, reduceMotion, children }: RingWrapperProps) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = dailyPulseRevealOpacity(false, index);
  }, [index, reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.ringStackPosition, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

interface NarrationProps {
  text: string;
  reduceMotion: boolean;
}

function NarrationLine({ text, reduceMotion }: NarrationProps) {
  const theme = useTheme();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = dailyPulseRevealNarrationOpacity(false);
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const displayMStyle = theme.type('displayM');

  return (
    <Animated.Text
      style={[
        animatedStyle,
        {
          fontFamily: displayMStyle.family,
          fontSize: displayMStyle.size,
          lineHeight: displayMStyle.lineHeight,
          fontStyle: 'italic',
          fontWeight: '600',
          color: theme.colors.brand.primary,
          textAlign: 'center',
          marginTop: theme.spacing.l,
        },
      ]}
    >
      {text}
    </Animated.Text>
  );
}

export function DailyPulseHero({
  vitals,
  centralValue,
  centralLabel,
  aiNarration,
  mode = 'immersive',
  parentName,
  testID,
  style,
}: DailyPulseHeroProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const rings = mode === 'card' ? CARD_RINGS : IMMERSIVE_RINGS;
  const outerDiameter = rings[0].diameter;

  const numericStyle =
    mode === 'card' ? theme.type('numericXl') : theme.type('numericHero');
  const labelStyle = theme.type('labelUppercase');

  const composedA11yLabel = composeAccessibilityLabel(
    vitals,
    centralValue,
    centralLabel,
    aiNarration,
    parentName,
  );

  return (
    <View
      style={[styles.root, style]}
      accessibilityRole="text"
      accessibilityLabel={composedA11yLabel}
      testID={testID}
    >
      <View
        style={{
          width: outerDiameter,
          height: outerDiameter,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {rings.map((ring, idx) => {
          const ringState = vitals[ring.vitalType];
          const fillDelayMs =
            ringIndexForVital(ring.vitalType) * STAGGER_MS + OPACITY_REVEAL_MS;
          // If the consumer asked for state='pulsing' we honour it; otherwise
          // the reveal kicks the ring into 'filling' for a one-shot draw.
          // Under reduced motion every ring is forced to 'idle' so it
          // renders statically at its target fill — no animation drivers.
          const ringRenderState: VitalRingState = reduceMotion
            ? 'idle'
            : (ringState.state ?? 'filling');

          return (
            <Fragment key={ring.vitalType}>
              <RingWrapper index={idx} reduceMotion={reduceMotion}>
                <VitalRing
                  vitalType={ring.vitalType}
                  fill={ringState.fill}
                  diameter={ring.diameter}
                  strokeWidth={ring.strokeWidth}
                  state={ringRenderState}
                  fillDelayMs={
                    ringRenderState === 'filling' ? fillDelayMs : 0
                  }
                />
              </RingWrapper>
            </Fragment>
          );
        })}
        <View pointerEvents="none" style={styles.center}>
          <Text
            style={{
              fontFamily: numericStyle.family,
              fontSize: numericStyle.size,
              lineHeight: numericStyle.lineHeight,
              color: theme.colors.text.primary,
              textAlign: 'center',
            }}
          >
            {centralValue}
          </Text>
          <Text
            style={{
              fontFamily: labelStyle.family,
              fontSize: labelStyle.size,
              lineHeight: labelStyle.lineHeight,
              letterSpacing: labelStyle.letterSpacing,
              color: theme.colors.text.tertiary,
              textAlign: 'center',
              marginTop: theme.spacing.xs,
            }}
          >
            {centralLabel}
          </Text>
        </View>
      </View>
      {aiNarration ? (
        <NarrationLine text={aiNarration} reduceMotion={reduceMotion} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  ringStackPosition: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
