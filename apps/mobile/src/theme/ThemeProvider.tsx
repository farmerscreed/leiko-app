// D12 ThemeProvider — wires the colorMode + typeMode + reduceMotion
// dimensions into a single Theme object. Consumers read the theme via
// useTheme(). Consumers that need to *change* the persisted color-mode
// override (Settings screen, dev gallery) use useColorModeControl().
//
// colorMode resolution (D12 §12.6):
//   override = 'system' (default) → follow OS Appearance ('dark' | 'light')
//   override = 'dark' or 'light'  → force regardless of OS
//
// Persistence (MMKV key `themeColorMode`): the user's override choice
// survives reinstall? No — MMKV is wiped on uninstall, which matches the
// spec's "no behaviour escapes the device unless the user signs in."

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { buildTheme, type Theme, type ThemeMode } from './buildTheme';
import { resolveColorMode, type ColorModeOverride } from './resolveColorMode';
import { useReducedMotion } from './useReducedMotion';

export { resolveColorMode, type ColorModeOverride } from './resolveColorMode';

export interface ThemeContextValue {
  theme: Theme;
  colorModeOverride: ColorModeOverride;
  setColorModeOverride: (override: ColorModeOverride) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  // typeMode (caregiver / parent) — set by account_type once onboarding finishes.
  mode?: ThemeMode;
  // Optional forced override. Tests + dev gallery use this to lock a specific
  // colorMode without reading/writing MMKV. Production renders pass nothing
  // (provider reads MMKV → defaults to 'system').
  colorMode?: ColorModeOverride;
  children: ReactNode;
}

function readPersistedOverride(): ColorModeOverride {
  const raw = mmkv.getString(STORAGE_KEYS.themeColorMode);
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  // Sprint 16.6 — default to 'dark' on first launch. The Leiko design
  // language is dark-canonical for v1.0 (warm-charcoal canopy across
  // caregiver Home + every screen that consumes warmBase surfaces).
  // With the previous 'system' default, devices in OS light mode
  // resolved to semanticColorsLight whose text.primary is #0F121C
  // (near-black) and rendered nearly-black text on hardcoded warm-dark
  // surfaces — unreadable. Users can still opt into 'light' or
  // 'system' via Settings; the MMKV write from that flow takes
  // precedence over this default on subsequent launches.
  return 'dark';
}

export function ThemeProvider({
  mode = 'caregiver',
  colorMode: forcedColorMode,
  children,
}: ThemeProviderProps) {
  const reduceMotion = useReducedMotion();
  const osScheme = useColorScheme();

  const [override, setOverride] = useState<ColorModeOverride>(
    () => forcedColorMode ?? readPersistedOverride(),
  );

  // Keep the override in sync if the parent prop changes (dev gallery toggle).
  useEffect(() => {
    if (forcedColorMode) setOverride(forcedColorMode);
  }, [forcedColorMode]);

  const setColorModeOverride = useCallback((next: ColorModeOverride) => {
    setOverride(next);
    mmkv.set(STORAGE_KEYS.themeColorMode, next);
  }, []);

  const resolvedMode = resolveColorMode(override, osScheme);

  const theme = useMemo(
    () => buildTheme(resolvedMode, mode, reduceMotion),
    [resolvedMode, mode, reduceMotion],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, colorModeOverride: override, setColorModeOverride }),
    [theme, override, setColorModeOverride],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
