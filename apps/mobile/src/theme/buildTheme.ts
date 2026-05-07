// Pure function: composes the runtime Theme object from a colorMode, a
// typeMode, and a reduceMotion flag. Exported separately from ThemeProvider
// so it can be tested without React or RN AccessibilityInfo.
//
// Source of truth for all token values: docs/_reference/D12-visual-system-v2.md.
// The `colors`, `elevation`, `fontFamily` aliases marked "compat shim" exist
// to support the Phase B per-component migration in Sprint 1.5 without forcing
// a single big-bang rename of ~20 consumers. They are removed in the Phase C
// cleanup once every consumer has migrated to the D12 field names.

import {
  type ColorMode,
  type DurationToken,
  type TypeMode,
  type TypeStyle,
  type TypeToken,
  duration as durationMap,
  easing,
  fontFamilies,
  getElevation,
  getSemanticColors,
  getTypeStyle,
  iconSize,
  opacity,
  paletteDark,
  paletteLight,
  phosphorIconName,
  radii,
  reducedMotionDuration,
  spacing,
  spring,
} from './tokens';
// `fireHaptic` is intentionally NOT placed on the Theme object — it pulls
// in expo-haptics (ESM) which breaks the pure ts-jest project. Components
// that need it import from `../theme/tokens/haptics` directly.

// `ThemeMode` was the D8 name for what D12 calls `TypeMode`. The alias avoids
// a sweep of every App.tsx / consumer in this one commit; it is removed in
// Phase C cleanup.
export type ThemeMode = TypeMode;
export type { ColorMode, TypeMode, TypeStyle };

const minTapTargetByMode = { caregiver: 48, parent: 64 } as const;
const listRowMinHeightByMode = { caregiver: 56, parent: 64 } as const;

export function buildTheme(
  colorMode: ColorMode,
  typeMode: TypeMode,
  reduceMotion: boolean,
) {
  const baseColors = getSemanticColors(colorMode);

  // Compat shim — D8 field names alias to closest D12 equivalents. Each
  // shim is annotated where it lives in this file; remove during Phase C.
  const colors = {
    ...baseColors,
    brand: {
      ...baseColors.brand,
      // D8 `accent` was amber-500. D12 promotes amber to brand.primary, so
      // this is a direct alias to the same hue.
      accent: baseColors.brand.primary,
      // D8 `primarySoft` was navy-700, used for sub-emphasis text and
      // muted accents. Closest D12 semantic is `text.secondary`.
      primarySoft: baseColors.text.secondary,
    },
    border: {
      ...baseColors.border,
      // D8 `border.default` was cream-300. D12 `border.subtle` plays the
      // same role (separator / divider line).
      default: baseColors.border.subtle,
    },
  };

  // D8 `theme.fontFamily.{body,display,numeric}` shape, mapped onto the
  // new expo-google-fonts package family names.
  const fontFamily = {
    body: fontFamilies.body,
    display: fontFamilies.display,
    numeric: fontFamilies.numeric,
  };

  return {
    // Mode dimensions — `mode` retained as alias for `typeMode` (D8 callsite name).
    colorMode,
    typeMode,
    mode: typeMode,
    reduceMotion,

    // Color
    colors,
    paletteDark,
    paletteLight,

    // Elevation (mode-resolved)
    elevation: getElevation(colorMode),

    // Static design tokens
    spacing,
    radii,
    opacity,

    // Typography
    fontFamilies,
    fontFamily, // compat shim

    type(token: TypeToken): TypeStyle {
      return getTypeStyle(typeMode, token);
    },

    // Motion
    easing,
    spring,
    duration(token: DurationToken): number {
      return reduceMotion ? reducedMotionDuration[token] : durationMap[token];
    },

    // Iconography (mapping table only — Phosphor library installed in Sprint 7.6)
    iconSize,
    phosphorIconName,

    // Tap targets / list row sizing — by typeMode
    minTapTarget: minTapTargetByMode[typeMode],
    listRowMinHeight: listRowMinHeightByMode[typeMode],
  };
}

export type Theme = ReturnType<typeof buildTheme>;
