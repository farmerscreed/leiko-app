// ViewToggle — Sprint 7.7b (caregiver Family Constellation).
//
// Pill-shaped segmented control that flips the caregiver home between the
// bird's-eye constellation view and the editorial detailed-card view. The
// component is pure presentation: it accepts `value` + `onChange` from the
// consumer (`CaregiverHome`) which owns the persisted state via
// `useCaregiverViewMode` (MMKV-backed).
//
// Anatomy (from `leiko-caregiver-unified.html` → ViewToggle):
//   - Outer pill: borderRadius 999, padding 3pt, glass background. BlurView
//     intensity 50 + tinted floor of `surface.warmElevated` at ~70% alpha;
//     hairline border in `border.subtle`.
//   - Two buttons inside, each with glyph + label (gap 6pt), padding
//     7pt vertical / 11pt right / 9pt left, borderRadius 999.
//     - Active:   coral background ~18% alpha, coral border ~35%, coral text.
//     - Inactive: transparent background, transparent border (same width to
//                 keep layout stable), text.tertiary text. Glyph follows
//                 the same colour via `currentColor`-style stroke / fill.
//
// Glyphs:
//   - Bird's-eye: 3 SVG circles at varied positions/sizes (matches design
//     coordinates exactly: 7,9 r2.5 / 16,6 r1.8 / 14,16 r2.2 with
//     opacity 0.9 / 0.7 / 0.85).
//   - Detailed: 3 stacked SVG rectangles (16x4, 16x4, 16x2.5).
//
// Motion:
//   The cinematic moment in 7.7b is the screen-level zoom between views,
//   not the toggle itself. Per the brief's recommendation we keep the
//   toggle's state-flip instant — Pressable's pressed-opacity provides
//   tap feedback. This trims the file and avoids a Reanimated colour
//   interpolation that adds nothing the user notices.
//
// Accessibility:
//   - Outer pill: accessibilityRole="radiogroup" so AT announces single-
//     selection semantics.
//   - Each button: accessibilityRole="button" (radio role isn't supported
//     reliably on RN's accessibility layer; button + selected state is the
//     idiomatic compromise), accessibilityLabel "Bird's-eye view" /
//     "Detailed view", accessibilityState { selected }.
//
// Voice (docs/05-voice-and-claims.md):
//   "Bird's-eye" + "Detailed" + accessibilityLabel "Bird's-eye view" /
//   "Detailed view" — clean. No forbidden vocabulary.

import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme';
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
  label: string;
  a11yLabel: string;
  testIDSuffix: string;
}

const SEGMENTS: readonly SegmentDef[] = [
  {
    key: 'birds',
    label: "Bird's-eye",
    a11yLabel: "Bird's-eye view",
    testIDSuffix: 'birds',
  },
  {
    key: 'cards',
    label: 'Detailed',
    a11yLabel: 'Detailed view',
    testIDSuffix: 'cards',
  },
] as const;

// Hex helpers — RN doesn't accept oklch(), so the design's
//   oklch(72% 0.18 35 / .18)  → coral + alpha hex
//   oklch(72% 0.18 35 / .35)  → coral + alpha hex
// are pre-resolved here against `theme.colors.brand.coral`.
const ALPHA_ACTIVE_BG = '2E'; // ~18%
const ALPHA_ACTIVE_BORDER = '59'; // ~35%
const ALPHA_PILL_FILL = 'B3'; // ~70%

function BirdsGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Circle cx={7} cy={9} r={2.5} fill={color} opacity={0.9} />
      <Circle cx={16} cy={6} r={1.8} fill={color} opacity={0.7} />
      <Circle cx={14} cy={16} r={2.2} fill={color} opacity={0.85} />
    </Svg>
  );
}

function DetailedGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4}
        y={5}
        width={16}
        height={4}
        rx={1.2}
        stroke={color}
        strokeWidth={1.6}
      />
      <Rect
        x={4}
        y={11}
        width={16}
        height={4}
        rx={1.2}
        stroke={color}
        strokeWidth={1.6}
      />
      <Rect
        x={4}
        y={17}
        width={16}
        height={2.5}
        rx={1}
        stroke={color}
        strokeWidth={1.6}
      />
    </Svg>
  );
}

export function ViewToggle({ value, onChange, testID, style }: ViewToggleProps) {
  const theme = useTheme();

  const blurTint: 'dark' | 'light' = theme.colorMode === 'dark' ? 'dark' : 'light';

  const pillStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    backgroundColor: `${theme.colors.surface.warmElevated}${ALPHA_PILL_FILL}`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border.subtle,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  };

  return (
    <View
      accessibilityRole="radiogroup"
      style={[pillStyle, style]}
      testID={testID}
    >
      <BlurView
        intensity={50}
        tint={blurTint}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {SEGMENTS.map((segment) => {
        const active = value === segment.key;
        const tint = active
          ? theme.colors.brand.coral
          : theme.colors.text.tertiary;

        const buttonStyle: ViewStyle = {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 7,
          paddingBottom: 7,
          paddingLeft: 9,
          paddingRight: 11,
          borderRadius: 999,
          // Border width stays constant in both states so layout doesn't
          // shift on selection. Inactive is `transparent`.
          borderWidth: 0.5,
          borderColor: active
            ? `${theme.colors.brand.coral}${ALPHA_ACTIVE_BORDER}`
            : 'transparent',
          backgroundColor: active
            ? `${theme.colors.brand.coral}${ALPHA_ACTIVE_BG}`
            : 'transparent',
        };

        return (
          <Pressable
            key={segment.key}
            accessibilityRole="button"
            accessibilityLabel={segment.a11yLabel}
            accessibilityState={{ selected: active }}
            onPress={() => {
              // Only fire when the value actually changes — pressing the
              // already-active segment is a no-op. Keeps consumer state
              // diff-friendly and avoids needless MMKV writes.
              if (!active) onChange(segment.key);
            }}
            hitSlop={4}
            style={({ pressed }) => [
              buttonStyle,
              pressed ? { opacity: 0.7 } : null,
            ]}
            testID={testID ? `${testID}-${segment.testIDSuffix}` : undefined}
          >
            {segment.key === 'birds' ? (
              <BirdsGlyph color={tint} />
            ) : (
              <DetailedGlyph color={tint} />
            )}
            <Text
              style={{
                fontFamily: theme.fontFamilies.numeric,
                fontSize: 10.5,
                lineHeight: 14,
                letterSpacing: 0.6, // ~0.06em at 10.5pt
                color: tint,
                textTransform: 'uppercase',
                marginLeft: 6,
              }}
              allowFontScaling={false}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
