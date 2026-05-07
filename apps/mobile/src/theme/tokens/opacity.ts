// Source of truth: docs/_reference/D12-visual-system-v2.md §8.

export const opacity = {
  disabled: 0.4,
  scrim: 0.55,
  muted: 0.7,
  ringBackground: 0.12,
  glassBase: 0.04,
  full: 1,
} as const;

export type OpacityToken = keyof typeof opacity;
