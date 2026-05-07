// Hook for components that need to *change* the persisted color-mode override
// (Settings screen, dev gallery). Components that only consume the resolved
// theme should use useTheme() instead.

import { useContext } from 'react';
import type { ColorMode } from './buildTheme';
import { ThemeContext, type ColorModeOverride } from './ThemeProvider';

export interface ColorModeControl {
  // The user's persisted choice — 'system' | 'dark' | 'light'.
  override: ColorModeOverride;
  // The actually-resolved value applied to the theme — always 'dark' | 'light'.
  resolved: ColorMode;
  setOverride: (next: ColorModeOverride) => void;
}

export function useColorModeControl(): ColorModeControl {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useColorModeControl must be used inside <ThemeProvider>');
  }
  return {
    override: ctx.colorModeOverride,
    resolved: ctx.theme.colorMode,
    setOverride: ctx.setColorModeOverride,
  };
}
