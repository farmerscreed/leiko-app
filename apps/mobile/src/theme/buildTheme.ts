// Pure function: composes the runtime Theme object from a mode and a
// reduceMotion flag. Exported separately from ThemeProvider so it can be
// tested without React or RN AccessibilityInfo.

import {
  colors,
  elevation,
  fontFamily,
  listRowMinHeight,
  minTapTarget,
  motion,
  opacity,
  palette,
  radii,
  reducedMotionDuration,
  spacing,
  typeScale,
  type DurationToken,
  type TypeToken,
} from './tokens';

export type ThemeMode = 'caregiver' | 'parent';

export interface TypeStyle {
  size: number;
  lineHeight: number;
  weight: string;
  family: string;
}

export function buildTheme(mode: ThemeMode, reduceMotion: boolean) {
  return {
    mode,
    reduceMotion,
    palette,
    colors,
    spacing,
    radii,
    opacity,
    elevation,
    fontFamily,
    easing: motion.easing,
    minTapTarget: minTapTarget[mode],
    listRowMinHeight: listRowMinHeight[mode],

    type(token: TypeToken): TypeStyle {
      const override =
        mode === 'parent'
          ? (typeScale.parent as Partial<Record<TypeToken, TypeStyle>>)[token]
          : undefined;
      return override ?? typeScale.caregiver[token];
    },

    duration(token: DurationToken): number {
      return reduceMotion ? reducedMotionDuration[token] : motion.duration[token];
    },
  };
}

export type Theme = ReturnType<typeof buildTheme>;
