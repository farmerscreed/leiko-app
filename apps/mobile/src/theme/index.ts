export {
  ThemeProvider,
  resolveColorMode,
  type ColorModeOverride,
  type ThemeContextValue,
} from './ThemeProvider';
export { useTheme } from './useTheme';
export { useColorModeControl, type ColorModeControl } from './useColorModeControl';
export { useReducedMotion } from './useReducedMotion';
export {
  buildTheme,
  type Theme,
  type ThemeMode,
  type TypeMode,
  type ColorMode,
  type TypeStyle,
} from './buildTheme';

// Legacy D8 token re-exports — consumed by the few sites that still import
// raw tokens directly (ListRow.test palette assertion, etc). These come from
// `./legacy-tokens` (the renamed D8 tokens.ts) and are removed in Phase C
// cleanup once every consumer migrates to the D12 token surface via useTheme().
export {
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
  type EasingToken,
  type ElevationToken,
  type OpacityToken,
  type RadiusToken,
  type SpacingToken,
  type TypeToken,
} from './legacy-tokens';
