// Pure-Deno statistics helpers for compute-correlations.
//
// No external library — Pearson r is trivial; the p-value path uses
// the regularised incomplete beta function for the Student's t CDF
// and is small enough to inline. Tested against scipy.stats reference
// values across the n=14..30, r=0.0..0.9 grid (tolerance ±0.005).
//
// Per docs/15-correlation-engine.md §4.2 — Sprint 9.

/** Pearson correlation coefficient. Returns NaN when either input has
 *  zero variance (which the meaningful-test treats as "not meaningful"). */
export function pearsonR(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) {
    throw new Error(`pearsonR length mismatch: ${xs.length} vs ${ys.length}`);
  }
  const n = xs.length;
  if (n < 2) return NaN;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return NaN;
  return num / denom;
}

/** Slope of the simple linear regression of y on x — used for the
 *  user-relatable effect size (e.g., mmHg per hour of sleep). */
export function regressionSlope(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    num += dx * (ys[i] - yMean);
    den += dx * dx;
  }
  if (den === 0) return 0;
  return num / den;
}

/** Two-tailed p-value for a Pearson correlation, derived from the t
 *  distribution: t = r * sqrt((n-2) / (1 - r²)), df = n - 2. */
export function pearsonP(r: number, n: number): number {
  if (!Number.isFinite(r) || n < 3) return 1;
  if (Math.abs(r) >= 1) return 0;
  const df = n - 2;
  const t = r * Math.sqrt(df / Math.max(1 - r * r, 1e-12));
  return twoTailedTp(t, df);
}

/** Two-tailed p-value for a t-statistic with df degrees of freedom. */
export function twoTailedTp(t: number, df: number): number {
  // Use the regularised incomplete beta function: for the t distribution,
  // P(|T| > t) = I_{df / (df + t²)}(df/2, 1/2).
  const x = df / (df + t * t);
  return regularisedIncompleteBeta(x, df / 2, 0.5);
}

/** Regularised incomplete beta function I_x(a, b). Continued-fraction
 *  expansion via Lentz's algorithm; converges in <100 iterations for
 *  the (a, b) shapes we use. */
export function regularisedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Use the symmetry I_x(a,b) = 1 - I_{1-x}(b,a) for stability when x is
  // close to 1.
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularisedIncompleteBeta(1 - x, b, a);
  }
  // Pre-factor: x^a * (1-x)^b / (a * B(a, b))
  const lnPrefix =
    a * Math.log(x) + b * Math.log(1 - x) - Math.log(a) - lnBeta(a, b);
  const prefix = Math.exp(lnPrefix);
  return prefix * betaContinuedFraction(x, a, b);
}

function lnBeta(a: number, b: number): number {
  return lnGamma(a) + lnGamma(b) - lnGamma(a + b);
}

/** Lanczos approximation of ln(Γ(x)) for x > 0. */
function lnGamma(x: number): number {
  // Coefficients from "Numerical Recipes" 3rd ed.
  const coeffs = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -5.395239384953e-6,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < coeffs.length; j++) {
    y += 1;
    ser += coeffs[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  // Lentz's algorithm; converges quickly inside the symmetric region.
  const MAX_ITER = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
