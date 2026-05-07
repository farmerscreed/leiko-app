// Source of truth: docs/_reference/D12-visual-system-v2.md §7.3.
//
// Reusable Reanimated animation builders for the six named motion patterns
// in D12. Each pattern returns an animation node (or a raw value for the
// reduced-motion hard-cut path) that the consumer assigns to a SharedValue.
//
// Sprint 1.5 scope:
//   - buttonPress      — fully implemented (Button consumer in Task 6)
//   - sheetRise        — fully implemented (BottomSheet consumer in Task 8)
//   - skeletonShimmer  — fully implemented (no current consumer; cheap to ship)
//   - dailyPulseReveal — stub (consumer ships in Sprint 7.6 alongside DailyPulseHero)
//   - livePulse        — stub (consumer ships in Sprint 7.6 alongside VitalRing)
//   - tileExpand       — stub (consumer ships in Sprint 7.6 alongside VitalTile)
//
// Reduced motion (D12 §7.4) is honoured by every pattern: when the
// reduceMotion flag is true, animations either hard-cut to the target value
// or collapse to motion.fast (120ms). The flag is read by the consumer via
// theme.reduceMotion and passed in.

import {
  Easing,
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

// ─────────────────────────────────────────────────────────────────────
// motion.pattern.daily-pulse-reveal — STUB (Sprint 7.6 / DailyPulseHero)
// motion.pattern.live-pulse        — STUB (Sprint 7.6 / VitalRing)
// motion.pattern.tile-expand       — STUB (Sprint 7.6 / VitalTile)
// ─────────────────────────────────────────────────────────────────────

// These three patterns drive multi-shared-value choreography (5-ring fill
// stagger, multi-keyframe heartbeat curve, origin-based scale-to-fullscreen)
// that has no current consumer in Sprint 1.5. Implementing them now would be
// dead code; the contracts in D12 §7.3 + §7.5 + §11 define the visual
// behaviour. Build alongside the consuming component in Sprint 7.6.
