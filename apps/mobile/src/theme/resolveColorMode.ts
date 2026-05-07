// Pure colorMode resolution rule per D12 §12.6. Extracted from ThemeProvider
// so the pure ts-jest project can unit-test it without loading JSX.

import type { ColorMode } from './buildTheme';

export type ColorModeOverride = 'system' | 'dark' | 'light';

export function resolveColorMode(
  override: ColorModeOverride,
  osScheme: 'light' | 'dark' | null | undefined,
): ColorMode {
  if (override !== 'system') return override;
  // Default to dark canonical when the OS hasn't reported a scheme yet
  // (early init, jest test env on some setups, certain Android devices).
  return osScheme === 'light' ? 'light' : 'dark';
}
