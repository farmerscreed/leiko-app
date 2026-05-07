// Source of truth: docs/_reference/D12-visual-system-v2.md §4.
// 4pt base scale. All padding, margin, gap values resolve to one of these.
// No raw pixel values in component code.

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
  xxxxxl: 64,
  xxxxxxl: 96,
} as const;

export type SpacingToken = keyof typeof spacing;
