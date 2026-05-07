// Source of truth: docs/_reference/D12-visual-system-v2.md §7.3.
//
// Reusable Reanimated animation builders for the six named motion patterns
// in D12. Each pattern returns an animation node (or a raw value for the
// reduced-motion hard-cut path) that the consumer assigns to a SharedValue.
//
// Reduced motion (D12 §7.4) is honoured by every pattern: when the
// reduceMotion flag is true, animations either hard-cut to the target value
// or collapse to motion.fast (120ms). The flag is read by the consumer via
// theme.reduceMotion and passed in.

import {
  Easing,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { duration, spring } from '../tokens';

const SPRING_CONFIG: WithSpringConfig = spring.default;

// ─────────────────────────────────────────────────────────────────────
// motion.pattern.button-press (D12 §7.3)
// Scale 1.0 → 0.97 over fast (120ms) ease.spring. Reverses on release.
// ─────────────────────────────────────────────────────────────────────

export function buttonPressInScale(reduceMotion: boolean): number {
  if (reduceMotion) return 0.97;
  return withSpring(0.97, SPRING_CONFIG);
}

export function buttonPressOutScale(reduceMotion: boolean): number {
  if (reduceMotion) return 1.0;
  return withSpring(1.0, SPRING_CONFIG);
}

// ─────────────────────────────────────────────────────────────────────
// motion.pattern.sheet-rise (D12 §7.3)
// Sheet content translates from full-height to resting position over
// motion.slow ease.spring. Backdrop opacity 0 → scrim over motion.normal
// ease.standard. Dismiss reverses with ease.accelerate.
// ─────────────────────────────────────────────────────────────────────

const STANDARD_EASE = Easing.bezier(0.2, 0, 0, 1);
const ACCELERATE_EASE = Easing.bezier(0.3, 0, 1, 1);

export function sheetRiseInTranslate(reduceMotion: boolean, restingY: number): number {
  if (reduceMotion) return restingY;
  return withSpring(restingY, SPRING_CONFIG);
}

export function sheetRiseOutTranslate(reduceMotion: boolean, fullHeight: number): number {
  if (reduceMotion) return fullHeight;
  return withTiming(fullHeight, {
    duration: reduceMotion ? duration.fast : duration.normal,
    easing: ACCELERATE_EASE,
  });
}

export function sheetRiseInBackdropOpacity(reduceMotion: boolean, scrim: number): number {
  if (reduceMotion) return scrim;
  return withTiming(scrim, {
    duration: duration.normal,
    easing: STANDARD_EASE,
  });
}

export function sheetRiseOutBackdropOpacity(reduceMotion: boolean): number {
  if (reduceMotion) return 0;
  return withTiming(0, {
    duration: duration.normal,
    easing: ACCELERATE_EASE,
  });
}

// ─────────────────────────────────────────────────────────────────────
// motion.pattern.skeleton-shimmer (D12 §7.3)
// Linear horizontal gradient sweep, 1400ms cycle, ease.linear.
// Disabled when reduced motion is on (consumer renders a static placeholder).
// ─────────────────────────────────────────────────────────────────────

export function skeletonShimmer(reduceMotion: boolean): number {
  if (reduceMotion) return 0; // consumer should render a static placeholder instead
  return withRepeat(
    withSequence(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      withTiming(0, { duration: 0 }),
    ),
    -1,
    false,
  );
}

const DECELERATE_EASE = Easing.bezier(0, 0, 0, 1);
const CINEMATIC_EASE = Easing.bezier(0.16, 1, 0.3, 1);

// ─────────────────────────────────────────────────────────────────────
// motion.pattern.daily-pulse-reveal (D12 §7.3, §11.2.3)
//
// Five rings (BP→HR→SpO2→Sleep→Activity, indices 0..4) reveal in sequence:
//   per ring: opacity 0→1 over normal (200ms), then arc fill 0→target over
//   cinematic (720ms) ease.cinematic.
// Stagger between rings: 80ms.
// AI narration line fades in 200ms after the LAST ring starts filling.
// Total choreography ≈ 1240ms. Plays once per session.
// ─────────────────────────────────────────────────────────────────────

export const DAILY_PULSE_REVEAL_STAGGER_MS = 80;
export const DAILY_PULSE_REVEAL_RING_COUNT = 5;

export function dailyPulseRevealOpacity(reduceMotion: boolean, ringIndex: number): number {
  if (reduceMotion) return 1;
  const delay = ringIndex * DAILY_PULSE_REVEAL_STAGGER_MS;
  return withDelay(
    delay,
    withTiming(1, {
      duration: duration.normal,
      easing: DECELERATE_EASE,
    }),
  );
}

export function dailyPulseRevealFill(
  reduceMotion: boolean,
  ringIndex: number,
  targetFill: number,
): number {
  if (reduceMotion) return targetFill;
  // Fill begins after this ring's opacity finishes (delay + normal).
  const delay = ringIndex * DAILY_PULSE_REVEAL_STAGGER_MS + duration.normal;
  return withDelay(
    delay,
    withTiming(targetFill, {
      duration: duration.cinematic,
      easing: CINEMATIC_EASE,
    }),
  );
}

export function dailyPulseRevealNarrationOpacity(reduceMotion: boolean): number {
  if (reduceMotion) return 1;
  // 200ms after the last ring starts filling.
  const lastRingFillStart =
    (DAILY_PULSE_REVEAL_RING_COUNT - 1) * DAILY_PULSE_REVEAL_STAGGER_MS + duration.normal;
  const delay = lastRingFillStart + duration.normal;
  return withDelay(
    delay,
    withTiming(1, {
      duration: duration.normal,
      easing: DECELERATE_EASE,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────
// motion.pattern.live-pulse (D12 §7.5)
//
// Continuous heartbeat-curve loop on a vital ring whose underlying signal
// is currently being captured. Scale 1.0 ↔ 1.04, opacity 1.0 ↔ 0.85.
// Cycle 1200ms at 50bpm baseline; bpm clamped to 50–120 visually.
// Multi-keyframe shape (D12 §7.5):
//   0–25%: rapid grow
//   25–35%: pause at peak
//   35–60%: rapid shrink
//   60–100%: longer pause at trough
// Reduced motion: returns the static rest value (consumer renders a static
// "live" indicator dot instead — D12 §7.4).
// ─────────────────────────────────────────────────────────────────────

export const LIVE_PULSE_BPM_DEFAULT = 50;
export const LIVE_PULSE_BPM_MIN = 50;
export const LIVE_PULSE_BPM_MAX = 120;
export const LIVE_PULSE_SCALE_PEAK = 1.04;
export const LIVE_PULSE_SCALE_REST = 1.0;
export const LIVE_PULSE_OPACITY_TROUGH = 0.85;
export const LIVE_PULSE_OPACITY_REST = 1.0;

export function livePulseCycleMs(bpm: number): number {
  const clamped = Math.max(LIVE_PULSE_BPM_MIN, Math.min(LIVE_PULSE_BPM_MAX, bpm));
  return Math.round(60000 / clamped);
}

function livePulseSegments(bpm: number): {
  grow: number;
  peak: number;
  shrink: number;
  trough: number;
} {
  const cycle = livePulseCycleMs(bpm);
  return {
    grow: Math.round(cycle * 0.25),
    peak: Math.round(cycle * 0.1),
    shrink: Math.round(cycle * 0.25),
    trough: Math.round(cycle * 0.4),
  };
}

export function livePulseScale(reduceMotion: boolean, bpm: number = LIVE_PULSE_BPM_DEFAULT): number {
  if (reduceMotion) return LIVE_PULSE_SCALE_REST;
  const seg = livePulseSegments(bpm);
  return withRepeat(
    withSequence(
      withTiming(LIVE_PULSE_SCALE_PEAK, { duration: seg.grow, easing: DECELERATE_EASE }),
      withTiming(LIVE_PULSE_SCALE_PEAK, { duration: seg.peak, easing: Easing.linear }),
      withTiming(LIVE_PULSE_SCALE_REST, { duration: seg.shrink, easing: ACCELERATE_EASE }),
      withTiming(LIVE_PULSE_SCALE_REST, { duration: seg.trough, easing: Easing.linear }),
    ),
    -1,
    false,
  );
}

export function livePulseOpacity(
  reduceMotion: boolean,
  bpm: number = LIVE_PULSE_BPM_DEFAULT,
): number {
  if (reduceMotion) return LIVE_PULSE_OPACITY_REST;
  const seg = livePulseSegments(bpm);
  return withRepeat(
    withSequence(
      withTiming(LIVE_PULSE_OPACITY_TROUGH, { duration: seg.grow, easing: DECELERATE_EASE }),
      withTiming(LIVE_PULSE_OPACITY_TROUGH, { duration: seg.peak, easing: Easing.linear }),
      withTiming(LIVE_PULSE_OPACITY_REST, { duration: seg.shrink, easing: ACCELERATE_EASE }),
      withTiming(LIVE_PULSE_OPACITY_REST, { duration: seg.trough, easing: Easing.linear }),
    ),
    -1,
    false,
  );
}

// ─────────────────────────────────────────────────────────────────────
// motion.pattern.tile-expand (D12 §11.2.2)
//
// VitalTile press-and-hold → expands toward a vital detail screen. The
// destination screen ships in a later sprint; the primitive provides the
// scale worklet so the call site is wired today.
// Scale 1.0 → targetScale over slow (320ms) ease.spring. Underlying content
// fades out at normal (200ms) ease.accelerate.
// ─────────────────────────────────────────────────────────────────────

export function tileExpandScale(reduceMotion: boolean, targetScale: number): number {
  if (reduceMotion) return targetScale;
  return withSpring(targetScale, SPRING_CONFIG);
}

export function tileExpandUnderlayOpacity(reduceMotion: boolean): number {
  if (reduceMotion) return 0;
  return withTiming(0, { duration: duration.normal, easing: ACCELERATE_EASE });
}
