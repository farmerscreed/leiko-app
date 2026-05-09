// Deno tests for output-guard Layer 2 — Sprint 12.
//
// We DON'T pull a real ML model into the test runner — that would
// turn unit tests into integration tests that hit network. Instead
// each test stubs the Embedder to return deterministic vectors, and
// the assertions are about cosine math + threshold behaviour +
// cluster-cache lifecycle.
//
// The integration test (real Supabase.ai.gte-small embedding the real
// cluster) lives separately and runs against `supabase functions
// serve` — not in this file.

import { assertAlmostEquals, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  cosine,
  scanLayer2,
  buildLayer2RetryAugment,
  LAYER2_THRESHOLD,
  _resetClusterCacheForTest,
} from './layer2-cosine.ts';
import { DIAGNOSTIC_CLUSTER_PHRASES } from './diagnostic-cluster.ts';
import type { Embedder } from './embedder.ts';

// ── Cosine math ───────────────────────────────────────────────────────

Deno.test('cosine: identical vectors return 1', () => {
  assertAlmostEquals(cosine([1, 2, 3], [1, 2, 3]), 1, 1e-9);
});

Deno.test('cosine: opposite vectors return -1', () => {
  assertAlmostEquals(cosine([1, 2, 3], [-1, -2, -3]), -1, 1e-9);
});

Deno.test('cosine: orthogonal vectors return 0', () => {
  assertAlmostEquals(cosine([1, 0, 0], [0, 1, 0]), 0, 1e-9);
});

Deno.test('cosine: scale-invariant (normalised vs unnormalised)', () => {
  assertAlmostEquals(cosine([3, 4], [6, 8]), 1, 1e-9);
});

Deno.test('cosine: zero vector returns 0 without dividing by zero', () => {
  assertEquals(cosine([0, 0, 0], [1, 1, 1]), 0);
  assertEquals(cosine([1, 1, 1], [0, 0, 0]), 0);
});

Deno.test('cosine: rejects mismatched length', () => {
  assertThrows(() => cosine([1, 2], [1, 2, 3]));
});

// ── Stub embedder helpers ─────────────────────────────────────────────

/**
 * Build a stub Embedder that returns a unit vector along a single axis
 * picked by the input string. Cluster phrases get axes 0..N-1; queries
 * map to whichever axis their `mapToAxis` function returns.
 *
 * This gives us deterministic, controllable similarity:
 *   - same axis as a cluster phrase => cosine = 1
 *   - orthogonal axis              => cosine = 0
 *   - linear combination           => cosine in (0, 1)
 */
function makeAxisStubEmbedder(opts: {
  /** Length of the embedding vector. Defaults to cluster size + 4. */
  dim?: number;
  /** Map a query string to a unit vector. */
  mapToAxis: (text: string) => number[];
}): Embedder {
  const dim = opts.dim ?? DIAGNOSTIC_CLUSTER_PHRASES.length + 4;
  return {
    embed(text: string): Promise<number[]> {
      const axis = opts.mapToAxis(text);
      if (axis.length !== dim) {
        throw new Error(
          `axis stub: vector length ${axis.length} != expected dim ${dim}`,
        );
      }
      return Promise.resolve(axis);
    },
  };
}

/** Build a unit vector of length `dim` with 1.0 at index `i`. */
function unit(dim: number, i: number): number[] {
  const v = new Array<number>(dim).fill(0);
  v[i] = 1;
  return v;
}

// ── scanLayer2 — happy paths ──────────────────────────────────────────

Deno.test('scanLayer2: response identical to a cluster phrase fails the gate', async () => {
  _resetClusterCacheForTest();
  const dim = DIAGNOSTIC_CLUSTER_PHRASES.length + 4;
  const embedder = makeAxisStubEmbedder({
    dim,
    mapToAxis: (text) => {
      // Cluster phrase i maps to axis i; the test response also maps to
      // axis 0 (i.e., cosine 1.0 against cluster[0]).
      const idx = DIAGNOSTIC_CLUSTER_PHRASES.indexOf(text);
      if (idx >= 0) return unit(dim, idx);
      return unit(dim, 0); // simulate a perfect-match response
    },
  });
  const result = await scanLayer2('synthetic diagnostic-leaning response', embedder);
  assertEquals(result.passes, false);
  assertAlmostEquals(result.maxCosine, 1, 1e-9);
  assertEquals(result.matchedPhrase, DIAGNOSTIC_CLUSTER_PHRASES[0]);
});

Deno.test('scanLayer2: response orthogonal to every cluster phrase passes', async () => {
  _resetClusterCacheForTest();
  const dim = DIAGNOSTIC_CLUSTER_PHRASES.length + 4;
  const safeAxis = DIAGNOSTIC_CLUSTER_PHRASES.length; // unused by cluster
  const embedder = makeAxisStubEmbedder({
    dim,
    mapToAxis: (text) => {
      const idx = DIAGNOSTIC_CLUSTER_PHRASES.indexOf(text);
      if (idx >= 0) return unit(dim, idx);
      return unit(dim, safeAxis); // orthogonal to every cluster axis
    },
  });
  const result = await scanLayer2(
    'Mum is in pattern. 124 over 79 this morning.',
    embedder,
  );
  assertEquals(result.passes, true);
  assertEquals(result.maxCosine, 0);
});

Deno.test('scanLayer2: cosine just below threshold passes; just above fails', async () => {
  _resetClusterCacheForTest();
  const dim = DIAGNOSTIC_CLUSTER_PHRASES.length + 4;
  const idx0 = 0;

  // We construct a query that is a linear combination of cluster axis 0
  // and a "safe" axis, with a tunable knob. cos(theta) between
  // (alpha, beta, 0,0,...) and (1, 0, 0,...) is alpha / sqrt(alpha^2 + beta^2).
  // To get cosine = 0.74, pick alpha=0.74, beta=sqrt(1-0.74^2) ≈ 0.6726
  // Then maxCosine should be 0.74 (passes since < threshold 0.75).
  const tuneVec = (cosineTarget: number): number[] => {
    const alpha = cosineTarget;
    const beta = Math.sqrt(1 - cosineTarget * cosineTarget);
    const v = new Array<number>(dim).fill(0);
    v[idx0] = alpha;
    v[DIAGNOSTIC_CLUSTER_PHRASES.length] = beta;
    return v;
  };

  // Below threshold (0.74): passes
  let queryAxis: number[] = tuneVec(0.74);
  let embedder = makeAxisStubEmbedder({
    dim,
    mapToAxis: (text) => {
      const idx = DIAGNOSTIC_CLUSTER_PHRASES.indexOf(text);
      if (idx >= 0) return unit(dim, idx);
      return queryAxis;
    },
  });
  let result = await scanLayer2('borderline-low response', embedder);
  assertEquals(result.passes, true);
  assertAlmostEquals(result.maxCosine, 0.74, 1e-6);

  // Above threshold (0.76): fails. Reset cache because the embedder changed.
  _resetClusterCacheForTest();
  queryAxis = tuneVec(0.76);
  embedder = makeAxisStubEmbedder({
    dim,
    mapToAxis: (text) => {
      const idx = DIAGNOSTIC_CLUSTER_PHRASES.indexOf(text);
      if (idx >= 0) return unit(dim, idx);
      return queryAxis;
    },
  });
  result = await scanLayer2('borderline-high response', embedder);
  assertEquals(result.passes, false);
  assertAlmostEquals(result.maxCosine, 0.76, 1e-6);
});

Deno.test('scanLayer2: durationMs is recorded and non-negative', async () => {
  _resetClusterCacheForTest();
  const dim = DIAGNOSTIC_CLUSTER_PHRASES.length + 4;
  const embedder = makeAxisStubEmbedder({
    dim,
    mapToAxis: () => unit(dim, dim - 1),
  });
  const result = await scanLayer2('whatever', embedder);
  if (result.durationMs < 0) {
    throw new Error(`durationMs must be >= 0, got ${result.durationMs}`);
  }
});

Deno.test('scanLayer2: caches cluster embeddings across invocations in same isolate', async () => {
  _resetClusterCacheForTest();
  const dim = DIAGNOSTIC_CLUSTER_PHRASES.length + 4;
  let embedCalls = 0;
  const embedder: Embedder = {
    embed(text: string) {
      embedCalls++;
      const idx = DIAGNOSTIC_CLUSTER_PHRASES.indexOf(text);
      if (idx >= 0) return Promise.resolve(unit(dim, idx));
      return Promise.resolve(unit(dim, dim - 1));
    },
  };
  await scanLayer2('first response', embedder);
  const callsAfterFirst = embedCalls;
  // Second call should NOT re-embed the cluster (15 phrases) — only the
  // new response (1 call). So total grows by exactly 1.
  await scanLayer2('second response', embedder);
  assertEquals(embedCalls, callsAfterFirst + 1);
});

// ── Threshold + retry augment ─────────────────────────────────────────

Deno.test('LAYER2_THRESHOLD matches D14 §12.2 specification', () => {
  assertEquals(LAYER2_THRESHOLD, 0.75);
});

Deno.test('scanLayer2: custom threshold overrides default', async () => {
  _resetClusterCacheForTest();
  const dim = DIAGNOSTIC_CLUSTER_PHRASES.length + 4;
  // Construct cosine = 0.5: alpha=0.5, beta=sqrt(0.75)
  const queryAxis = (() => {
    const v = new Array<number>(dim).fill(0);
    v[0] = 0.5;
    v[DIAGNOSTIC_CLUSTER_PHRASES.length] = Math.sqrt(0.75);
    return v;
  })();
  const embedder = makeAxisStubEmbedder({
    dim,
    mapToAxis: (text) => {
      const idx = DIAGNOSTIC_CLUSTER_PHRASES.indexOf(text);
      if (idx >= 0) return unit(dim, idx);
      return queryAxis;
    },
  });
  // Default 0.75 → 0.5 passes
  let r = await scanLayer2('q', embedder);
  assertEquals(r.passes, true);
  // Custom 0.4 → 0.5 fails
  r = await scanLayer2('q', embedder, { threshold: 0.4 });
  assertEquals(r.passes, false);
});

Deno.test('buildLayer2RetryAugment names the avoid-framings hint when matched', () => {
  const aug = buildLayer2RetryAugment('this indicates sleep apnea');
  assertEquals(aug.includes('avoid framings'), true);
  assertEquals(aug.includes('this indicates sleep apnea'), true);
  assertEquals(aug.includes('DEFER:symptom'), true);
});

Deno.test('buildLayer2RetryAugment omits the hint when no match given', () => {
  const aug = buildLayer2RetryAugment(null);
  assertEquals(aug.includes('avoid framings'), false);
  assertEquals(aug.includes('DEFER:symptom'), true);
});

// ── Cluster sanity ────────────────────────────────────────────────────

Deno.test('Diagnostic cluster has 10–15 phrases per D14 §12.2', () => {
  const n = DIAGNOSTIC_CLUSTER_PHRASES.length;
  if (n < 10 || n > 15) {
    throw new Error(
      `DIAGNOSTIC_CLUSTER_PHRASES has ${n} entries; D14 §12.2 specifies 10–15`,
    );
  }
});

Deno.test('Diagnostic cluster does NOT contain the permitted "talk to your doctor" framing', () => {
  // D11 §3.4 marks this as PREFERRED. It must not be in the cluster
  // — false positives on permitted speech would silently DEFER all
  // legitimate responses that nudge users toward their doctor.
  const lc = DIAGNOSTIC_CLUSTER_PHRASES.map((p) => p.toLowerCase());
  for (const phrase of lc) {
    if (phrase.includes('talk to your doctor')) {
      throw new Error('cluster must not contain "talk to your doctor"');
    }
  }
});
