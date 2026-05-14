// ConstellationField — Sprint 7.7a (caregiver Family Constellation).
//
// The bird's-eye field that anchors the caregiver home. Renders a 360x360
// canvas containing:
//   - A radial-gradient halo centred behind the field (coral 14% → 0%).
//   - Two dashed orbital rings (r=130, r=80) at 6–8% opacity — soft,
//     decorative, no semantic load.
//   - Three faint connection threads from the centre to each occupied orb
//     position, drawn in that person's accent at 18% opacity. The threads
//     trace the relational geometry — "you" at the centre, family in
//     orbit.
//   - A small white centre dot (3pt) labelled "You" with a soft pulsing
//     ring around it (3s cycle, fades opacity 0.3 ↔ 0). Disabled under
//     reduced motion.
//   - Up to three positioned `PersonOrb` instances on top of the SVG.
//
// Layout positions are FIXED in v1 — the design uses a deliberate
// asymmetry where the second slot is the largest (64pt), reading as
// "needs attention is biggest." We accept the geometry as data-blind for
// v1; Sprint 7.7b's discussion covers caregivers with > 3 family members
// and dynamic sizing.
//
// Why SVG for the field decoration but Views for the orbs:
//   - The rings, lines, and gradient are pure decoration — SVG is the
//     idiomatic primitive (matches VitalRing's pattern).
//   - The PersonOrb already composes Pressable + halo + Portrait + label,
//     and lives in the View tree so it can fire `onPress` + own its own
//     reanimated entrance. Stacking it absolutely over the SVG keeps both
//     concerns clean.
//
// Voice rules: the only authored string here is "You" — passes the calm,
// dignified, plain-language bar. All person-facing text (names, BPs)
// flows in via the `people` prop.
//
// Reduced motion (D12 §7.4): the centre-dot pulse is the ONLY animation
// this component owns (PersonOrbs handle their own internally). Under
// reduced motion the pulse ring renders at its rest opacity (0).

import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { PersonOrb } from './PersonOrb';
import { type Status } from './StatusPill';
import { useTheme } from '../theme';
import { useReducedMotion } from '../theme/useReducedMotion';

export interface ConstellationPerson {
  id: string;
  initial: string;
  fullName: string;
  /** Hex from `theme.colors.person.{1|2|3}`. */
  accent: string;
  status: Status;
  /** Pre-formatted BP string, e.g. "122/78". */
  bpLabel: string;
}

export interface ConstellationFieldProps {
  /** Up to 3 supported in v1 — extras are dropped with a dev warning. */
  people: ConstellationPerson[];
  onSelectPerson?: (id: string) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const FIELD_W = 360;
const FIELD_H = 360;
const CX = FIELD_W / 2;
const CY = FIELD_H / 2;
const MAX_PEOPLE = 3;

// Fixed slot positions — see the doc-block above for the rationale.
// Each entry is the orb's CENTRE in field coordinates plus its diameter.
const ORB_SLOTS = [
  { cx: CX - 88, cy: CY - 60, diameter: 56 }, // slot 0 — "mom"
  { cx: CX + 92, cy: CY - 14, diameter: 64 }, // slot 1 — "dad" (biggest)
  { cx: CX - 30, cy: CY + 100, diameter: 44 }, // slot 2 — "aunt"
] as const;

const CENTER_DOT_RADIUS = 3;
const CENTER_PULSE_DURATION_MS = 3000;
const CENTER_PULSE_PEAK_OPACITY = 0.3;

const RING_OUTER_R = 130;
const RING_INNER_R = 80;
const HALO_R = 160;

// 18% as a 2-digit hex alpha — matches the design's `.replace(')', ' / .18)')`
// pattern. Used on the connection threads.
const THREAD_ALPHA = '2E';

// Opacity for the dashed orbital rings — design uses `.08` and `.06`.
const RING_OUTER_OPACITY = 0.08;
const RING_INNER_OPACITY = 0.06;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clampPeople(people: ConstellationPerson[]): ConstellationPerson[] {
  if (people.length <= MAX_PEOPLE) return people;
  if (__DEV__) {
    console.warn(
      `[ConstellationField] received ${people.length} people; only the first ${MAX_PEOPLE} are rendered in v1.`,
    );
  }
  return people.slice(0, MAX_PEOPLE);
}

export function ConstellationField({
  people,
  onSelectPerson,
  testID,
  style,
}: ConstellationFieldProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const visible = clampPeople(people);

  // Centre dot pulse — opacity oscillates 0 → peak → 0 forever. Sequenced
  // so each cycle starts and ends at rest, which is also the reduced-
  // motion freeze state.
  const pulseOpacity = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      pulseOpacity.value = 0;
      return;
    }
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(CENTER_PULSE_PEAK_OPACITY, {
          duration: CENTER_PULSE_DURATION_MS / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, {
          duration: CENTER_PULSE_DURATION_MS / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, pulseOpacity]);

  const pulseAnimatedProps = useAnimatedProps(() => ({
    opacity: pulseOpacity.value,
  }));

  // Sprint 16.6 — "YOU" label was 9pt text.tertiary, effectively
  // invisible against the dark canopy. Lift to text.secondary; the
  // size bump happens in the Text style below.
  const youLabelColor = theme.colors.text.secondary;
  const centerDotColor = theme.colors.text.primary;

  return (
    <View
      testID={testID}
      style={[styles.root, style]}
      accessibilityRole="summary"
    >
      <Svg
        width={FIELD_W}
        height={FIELD_H}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        testID={testID ? `${testID}-svg` : undefined}
      >
        <Defs>
          <RadialGradient
            id="cg-fieldglow"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <Stop
              offset="0%"
              stopColor={theme.colors.brand.coral}
              stopOpacity={0.14}
            />
            <Stop
              offset="100%"
              stopColor={theme.colors.brand.coral}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>

        {/* Radial halo — coral glow, fades to transparent */}
        <Circle cx={CX} cy={CY} r={HALO_R} fill="url(#cg-fieldglow)" />

        {/* Dashed orbital rings */}
        <Circle
          cx={CX}
          cy={CY}
          r={RING_OUTER_R}
          fill="none"
          stroke={theme.colors.text.primary}
          strokeOpacity={RING_OUTER_OPACITY}
          strokeWidth={0.5}
          strokeDasharray="2 4"
        />
        <Circle
          cx={CX}
          cy={CY}
          r={RING_INNER_R}
          fill="none"
          stroke={theme.colors.text.primary}
          strokeOpacity={RING_INNER_OPACITY}
          strokeWidth={0.5}
          strokeDasharray="2 4"
        />

        {/* Faint connection threads from centre to each occupied orb */}
        {visible.map((person, i) => {
          const slot = ORB_SLOTS[i];
          return (
            <Line
              key={`thread-${person.id}`}
              x1={CX}
              y1={CY}
              x2={slot.cx}
              y2={slot.cy}
              stroke={person.accent + THREAD_ALPHA}
              strokeWidth={0.5}
            />
          );
        })}

        {/* Centre dot — solid white "You" mark */}
        <Circle cx={CX} cy={CY} r={CENTER_DOT_RADIUS} fill={centerDotColor} />

        {/* Pulsing ring around the centre dot — opacity is animated */}
        <AnimatedCircle
          cx={CX}
          cy={CY}
          r={CENTER_DOT_RADIUS}
          fill="none"
          stroke={centerDotColor}
          strokeWidth={0.5}
          animatedProps={pulseAnimatedProps}
          testID={testID ? `${testID}-pulse` : undefined}
        />
      </Svg>

      {/* "You" label — sits just below the centre dot in mono uppercase */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: CX,
          top: CY + 10,
          transform: [{ translateX: -16 }],
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fontFamilies.numeric,
            fontSize: 11,
            lineHeight: 13,
            letterSpacing: 2.2,
            fontWeight: '500',
            color: youLabelColor,
            textTransform: 'uppercase',
          }}
        >
          You
        </Text>
      </View>

      {/* Person orbs — absolutely positioned over the SVG */}
      {visible.map((person, i) => {
        const slot = ORB_SLOTS[i];
        // Position the orb's *centre* at the slot. PersonOrb roots from
        // its top-left, so we offset by half the diameter both ways.
        // The label that hangs below the orb is laid out absolutely
        // inside PersonOrb itself — it doesn't shift the anchor.
        const left = slot.cx - slot.diameter / 2;
        const top = slot.cy - slot.diameter / 2;
        return (
          <View
            key={person.id}
            style={{ position: 'absolute', left, top }}
            testID={testID ? `${testID}-orb-${person.id}` : undefined}
          >
            <PersonOrb
              initial={person.initial}
              accent={person.accent}
              status={person.status}
              fullName={person.fullName}
              bpLabel={person.bpLabel}
              diameter={slot.diameter}
              staggerIndex={i}
              onPress={
                onSelectPerson ? () => onSelectPerson(person.id) : undefined
              }
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: FIELD_W,
    height: FIELD_H,
    alignSelf: 'center',
    position: 'relative',
  },
});
