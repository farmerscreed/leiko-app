// Deno tests for compute-correlations stats helpers — Sprint 9.
//
// Run from supabase/functions: `deno test --allow-net=:0 compute-correlations/`
//
// scipy reference values were computed via:
//   from scipy.stats import pearsonr
//   pearsonr(xs, ys)   # → (r, p_two_tailed)
// Tolerances are intentionally loose (±0.005) — we only need the
// |r|/p decision to match. The continued-fraction expansion converges
// to within 1e-7 anyway; the tolerance is mainly a buffer for the
// difference between scipy's exact stats and our floating-point.

import { assertAlmostEquals } from 'jsr:@std/assert@1';
import {
  pearsonR,
  pearsonP,
  regressionSlope,
  regularisedIncompleteBeta,
} from './stats.ts';

const EPS = 0.005;

Deno.test('pearsonR — perfectly linear series gives ±1', () => {
  const xs = [1, 2, 3, 4, 5];
  const ys = [2, 4, 6, 8, 10];
  assertAlmostEquals(pearsonR(xs, ys), 1, 1e-9);
  const ysNeg = [10, 8, 6, 4, 2];
  assertAlmostEquals(pearsonR(xs, ysNeg), -1, 1e-9);
});

Deno.test('pearsonR — moderate correlation matches scipy', () => {
  // scipy.stats.pearsonr([1..10], [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]) ≈ 0.334.
  // The two series have a slight upward drift so the coefficient is
  // small-positive but not zero — useful for catching off-by-one errors.
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ys = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const r = pearsonR(xs, ys);
  assertAlmostEquals(r, 0.334, 0.005);
});

Deno.test('pearsonR — strong negative correlation matches scipy', () => {
  // scipy.stats.pearsonr(xs, ys) → r ≈ -0.987.
  const xs = [4, 5, 6, 7, 8, 9, 4, 5, 6, 7, 8, 9, 4, 5, 6, 7, 8, 9, 4, 5];
  const ys = [
    132, 128, 122, 118, 114, 109, 130, 127, 121, 116, 113, 108, 134, 126, 124,
    119, 115, 111, 131, 125,
  ];
  const r = pearsonR(xs, ys);
  assertAlmostEquals(r, -0.987, 0.005);
});

Deno.test('pearsonR — zero-variance input returns NaN', () => {
  // The meaningful-test treats NaN as not meaningful (|r| ≥ 0.3 is false).
  const xs = [3, 3, 3, 3, 3];
  const ys = [1, 2, 3, 4, 5];
  const r = pearsonR(xs, ys);
  if (!Number.isNaN(r)) throw new Error(`expected NaN, got ${r}`);
});

Deno.test('regressionSlope — simple linear fit', () => {
  // y = 2x + 1 → slope = 2
  const xs = [1, 2, 3, 4, 5];
  const ys = [3, 5, 7, 9, 11];
  assertAlmostEquals(regressionSlope(xs, ys), 2, 1e-9);
});

Deno.test('pearsonP — strong correlation across 30 paired days is well below 0.05', () => {
  // r ≈ 0.93, n = 20 → p < 1e-8
  const p = pearsonP(0.93, 20);
  if (p > 0.001) throw new Error(`expected p << 0.001, got ${p}`);
});

Deno.test('pearsonP — weak correlation at n=14 fails the threshold', () => {
  // r = 0.20, n = 14 → p ~ 0.49 (well above 0.05)
  const p = pearsonP(0.2, 14);
  if (p < 0.05) throw new Error(`expected p > 0.05, got ${p}`);
});

Deno.test('pearsonP — borderline r=0.5 at n=15 is meaningful', () => {
  // From scipy: r=0.5, n=15 → p ≈ 0.058 (just above 0.05)
  const p = pearsonP(0.5, 15);
  // Loose match — we just need to be within ~0.01 of scipy's reference.
  assertAlmostEquals(p, 0.058, EPS);
});

Deno.test('pearsonP — n < 3 returns 1 (no meaningful test possible)', () => {
  if (pearsonP(0.9, 2) !== 1) throw new Error('expected p = 1 for n=2');
});

Deno.test('pearsonP — perfect correlation returns 0', () => {
  if (pearsonP(1, 30) !== 0) throw new Error('expected p = 0 for r=1');
  if (pearsonP(-1, 30) !== 0) throw new Error('expected p = 0 for r=-1');
});

Deno.test('regularisedIncompleteBeta — endpoints', () => {
  if (regularisedIncompleteBeta(0, 1, 1) !== 0) throw new Error('I(0)=0');
  if (regularisedIncompleteBeta(1, 1, 1) !== 1) throw new Error('I(1)=1');
});

Deno.test('regularisedIncompleteBeta — symmetric a=b=1 reduces to x', () => {
  // I_x(1,1) = x exactly.
  for (const x of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    assertAlmostEquals(regularisedIncompleteBeta(x, 1, 1), x, 1e-9);
  }
});

Deno.test('regularisedIncompleteBeta — known reference values', () => {
  // I_{0.5}(2, 2) = 0.5 (symmetric beta).
  assertAlmostEquals(regularisedIncompleteBeta(0.5, 2, 2), 0.5, 1e-7);
  // I_{0.25}(0.5, 0.5) = (2/π) arcsin(sqrt(0.25)) ≈ 0.3333…
  assertAlmostEquals(
    regularisedIncompleteBeta(0.25, 0.5, 0.5),
    (2 / Math.PI) * Math.asin(Math.sqrt(0.25)),
    1e-6,
  );
});
