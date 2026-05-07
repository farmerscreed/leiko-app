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

// Re-exports from the new D12 token surface. Components can import these
// directly when they need raw tokens (rare — most code goes through useTheme()).
export {
  paletteDark,
  paletteLight,
  semanticColorsDark,
  semanticColorsLight,
  fontFamilies,
  spacing,
  radii,
  opacity,
  iconSize,
  phosphorIconName,
  type ColorMode as TokenColorMode,
  type SpacingToken,
  type RadiusToken,
  type OpacityToken,
  type DurationToken,
  type EasingToken,
  type ElevationToken,
  type TypeToken,
  type IconSizeToken,
} from './tokens';
