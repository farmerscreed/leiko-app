// Source of truth: docs/_reference/D12-visual-system-v2.md §5.
// Default raised from D8's 12 to 14 for slightly softer feel.

export const radii = {
  none: 0,
  s: 8,
  m: 14,
  l: 22,
  xl: 32,
  full: 999,
} as const;

export type RadiusToken = keyof typeof radii;
