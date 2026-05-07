// Source of truth: docs/_reference/D12-visual-system-v2.md §7.
//
// Durations + easing curves + spring config. Choreography patterns
// (button-press, sheet-rise, daily-pulse-reveal, live-pulse, tile-expand,
// skeleton-shimmer) live in motion/patterns.ts as Reanimated worklet helpers.

export const duration = {
  instant: 0,
  fast: 120,
  normal: 200,
  slow: 320,
  deliberate: 480,
  cinematic: 720,
  cinematicExtended: 1200,
} as const;

export type DurationToken = keyof typeof duration;

// D12 §7.4: under OS Reduce Motion, cinematic/deliberate/slow collapse to
// fast (120); normal collapses to instant (0) so transitions become hard
// cuts. Easing curves apply unchanged over the reduced duration.
export const reducedMotionDuration: Record<DurationToken, number> = {
  instant: 0,
  fast: 120,
  normal: 0,
  slow: 120,
  deliberate: 120,
  cinematic: 120,
  cinematicExtended: 120,
};

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  linear: 'linear',
  cinematic: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export type EasingToken = keyof typeof easing;

// Reanimated `withSpring` config. D12 §7.2 spec: stiffness 180, damping 22,
// mass 1. Used by sheet rise, ring fill, FAB press, vital tile expand.
export const spring = {
  default: { stiffness: 180, damping: 22, mass: 1 },
} as const;

// `ease.heartbeat` is a multi-keyframe curve (rapid grow → pause at peak →
// rapid shrink → longer pause at trough) that cannot be expressed as a
// single cubic-bezier. Implemented as a `withSequence` of timings inside
// motion/patterns.ts §live-pulse, not as a CSS easing.
