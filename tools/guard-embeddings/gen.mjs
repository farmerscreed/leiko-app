// Generates the precomputed Layer-2 cluster vectors.
//
// Run (needs huggingface.co, ~35 MB model download once):
//   cd tools/guard-embeddings && npm install && npm run gen
//
// Uses Supabase/gte-small — the same ONNX model Supabase.ai.Session
// ('gte-small') runs in Edge Functions — with mean pooling + L2
// normalisation, matching embedder.ts.
import { pipeline } from '@huggingface/transformers';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const guardDir = join(here, '..', '..', 'supabase', 'functions', '_shared', 'output-guard');
const src = readFileSync(join(guardDir, 'diagnostic-cluster.ts'), 'utf8');
const block = src.slice(src.indexOf('DIAGNOSTIC_CLUSTER_PHRASES'));
const arr = block.slice(block.indexOf('['), block.indexOf('];') + 1);
const phrases = [...arr.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((m) => m[1]);
if (phrases.length < 10) throw new Error(`parsed only ${phrases.length} phrases`);

const extract = await pipeline('feature-extraction', 'Supabase/gte-small');
const vectors = [];
for (const p of phrases) {
  const out = await extract(p, { pooling: 'mean', normalize: true });
  vectors.push(Array.from(out.data).map((x) => Number(x.toFixed(6))));
}

const header = readFileSync(join(guardDir, 'cluster-embeddings.ts'), 'utf8').split('export const PRECOMPUTED_CLUSTER')[0];
const body =
  'export const PRECOMPUTED_CLUSTER: PrecomputedCluster | null = ' +
  JSON.stringify({ model: 'Supabase/gte-small', phrases, vectors }) +
  ';\n';
writeFileSync(join(guardDir, 'cluster-embeddings.ts'), header + body);
console.log(`wrote ${phrases.length} vectors of ${vectors[0].length} dims`);
