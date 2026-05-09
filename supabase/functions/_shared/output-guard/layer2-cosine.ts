// supabase/functions/_shared/output-guard/layer2-cosine.ts — Sprint 12.
//
// Layer 2 of the three-layer output guard per D14 §12.2. Embeds the
// LLM response and computes max cosine similarity against the
// diagnostic-leaning cluster (`diagnostic-cluster.ts`). If the max
// cosine ≥ 0.75 (D14 threshold) the response is rejected and the
// caller retries; second-rejection falls through to DEFER per
// `layer1-regex.ts` rules.
//
// Why max-cosine vs mean-cosine: a single semantic match is enough
// to fail. Average dilutes obvious hits ("you have hypertension")
// when most cluster phrases aren't relevant to the response.
//
// Cluster-embedding cache: the cluster is embedded ONCE per Edge
// Function isolate cold-start; subsequent calls reuse the cached
// matrix. ~15 small `gte-small` calls in parallel on first invocation
// — well under 200ms in practice. Exported `_resetClusterCache()` is
// test-only.

import { DIAGNOSTIC_CLUSTER_PHRASES } from "./diagnostic-cluster.ts";
import type { Embedder } from "./embedder.ts";

/** Cosine threshold per D14 §12.2 — at or above this fires retry. */
export const LAYER2_THRESHOLD = 0.75;

export interface Layer2Result {
  passes: boolean;
  /** Max cosine similarity to ANY phrase in the cluster. */
  maxCosine: number;
  /** Cluster phrase that produced maxCosine, or null if no match. */
  matchedPhrase: string | null;
  /** Wall-clock embedding+scoring time in ms — for telemetry. */
  durationMs: number;
}

/**
 * Cosine similarity between two equal-length vectors. Defensive
 * against unnormalized inputs and zero vectors.
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosine: vector length mismatch (${a.length} vs ${b.length})`,
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

let clusterEmbeddingsCache: number[][] | null = null;

async function getClusterEmbeddings(embedder: Embedder): Promise<number[][]> {
  if (clusterEmbeddingsCache) return clusterEmbeddingsCache;
  const matrix = await Promise.all(
    DIAGNOSTIC_CLUSTER_PHRASES.map((phrase) => embedder.embed(phrase)),
  );
  clusterEmbeddingsCache = matrix;
  return matrix;
}

/**
 * Score a candidate response against the diagnostic cluster.
 *
 * @param text the LLM response to score
 * @param embedder injected embedder (production uses Supabase.ai;
 *   tests stub this)
 * @param options.threshold override the default 0.75 threshold (test/A-B)
 */
export async function scanLayer2(
  text: string,
  embedder: Embedder,
  options: { threshold?: number } = {},
): Promise<Layer2Result> {
  const threshold = options.threshold ?? LAYER2_THRESHOLD;
  const t0 = performance.now();

  const cluster = await getClusterEmbeddings(embedder);
  const responseEmbedding = await embedder.embed(text);

  let maxCosine = -1;
  let matchedIdx = -1;
  for (let i = 0; i < cluster.length; i++) {
    const c = cosine(responseEmbedding, cluster[i]);
    if (c > maxCosine) {
      maxCosine = c;
      matchedIdx = i;
    }
  }

  const durationMs = performance.now() - t0;
  return {
    passes: maxCosine < threshold,
    maxCosine,
    matchedPhrase: matchedIdx >= 0
      ? DIAGNOSTIC_CLUSTER_PHRASES[matchedIdx]
      : null,
    durationMs,
  };
}

/**
 * Build the retry-prompt suffix for the second LLM call when Layer 2
 * fires. Tells the model the response leaned diagnostic without
 * naming the matched phrase (which would be a leakage vector).
 */
export function buildLayer2RetryAugment(matchedPhrase: string | null): string {
  return (
    `Your previous response leaned diagnostic. Regenerate without claiming, ` +
    `predicting, or implying any specific medical condition or treatment. ` +
    `Describe the data only — no diagnosis, no risk prediction, no medication ` +
    `or dose advice. If a clinical question is being asked, return ` +
    `"DEFER:symptom" instead.` +
    (matchedPhrase ? ` (hint: avoid framings like "${matchedPhrase}")` : "")
  );
}

/**
 * TEST-ONLY. Resets the in-memory cluster embeddings cache. Production
 * code should never call this — the cache is a per-isolate optimisation
 * and unit tests need to start clean for each scenario.
 */
export function _resetClusterCacheForTest(): void {
  clusterEmbeddingsCache = null;
}
