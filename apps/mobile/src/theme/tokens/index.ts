// D12 token re-exports. ThemeProvider + buildTheme consume these to assemble
// the runtime Theme object. Components consume the resolved Theme via
// useTheme() — they should NOT import from here directly except in rare
// cases (raw palette access for one-off chromatics).

export {
  paletteDark,
  paletteLight,
  semanticColorsDark,
  semanticColorsLight,
  getSemanticColors,
  type ColorMode,
  type SemanticColors,
} from './color';

export {
  fontFamilies,
  typeScale,
  getTypeStyle,
  type TypeStyle,
  type TypeToken,
  type TypeMode,
} from './typography';

export { spacing, type SpacingToken } from './spacing';
export { radii, type RadiusToken } from './radii';

export {
  elevationDark,
  elevationLight,
  getElevation,
  type ElevationStyle,
  type ElevationToken,
} from './elevation';

export {
  duration,
  reducedMotionDuration,
  easing,
  spring,
  type DurationToken,
  type EasingToken,
} from './motion';

export { opacity, type OpacityToken } from './opacity';

// `./haptics` is intentionally NOT re-exported here. It depends on
// `expo-haptics`, which ships ESM and breaks under the pure ts-jest project
// (see jest.config.js). Components that fire haptics import the helper
// directly: `import { fireHaptic } from '../theme/tokens/haptics'`.
export type { HapticToken } from './haptics';

export {
  iconSize,
  phosphorIconName,
  type IconSizeToken,
  type PhosphorIconKey,
} from './icon';
