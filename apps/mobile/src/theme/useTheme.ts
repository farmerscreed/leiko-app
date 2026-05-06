import { useContext } from 'react';
import type { Theme } from './buildTheme';
import { ThemeContext } from './ThemeProvider';

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
