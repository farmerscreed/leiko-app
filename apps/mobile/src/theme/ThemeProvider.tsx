import { createContext, useMemo, type ReactNode } from 'react';
import { buildTheme, type Theme, type ThemeMode } from './buildTheme';
import { useReducedMotion } from './useReducedMotion';

export const ThemeContext = createContext<Theme | null>(null);

interface ThemeProviderProps {
  mode?: ThemeMode;
  children: ReactNode;
}

export function ThemeProvider({ mode = 'caregiver', children }: ThemeProviderProps) {
  const reduceMotion = useReducedMotion();
  const theme = useMemo(() => buildTheme(mode, reduceMotion), [mode, reduceMotion]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
