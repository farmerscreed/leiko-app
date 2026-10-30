# ADR-0013: Output-guard Layer 2 — precomputed cluster vectors and a calibrated threshold

- **Status**: Accepted (founder approved the fixes and the merge, 2026-10-30)
- **Date**: 2026-10-30
- **Amends**: D14 §12.2 (`docs/_reference/D14-ambient-ai-architecture.md`),
  which set the Layer-2 similarity threshold at 0.75
- **PRs**: #32 (precompute), #33 (threshold)

## Context

Layer 2 of the AI output guard embeds the model's answer with gte-small
(`Supabase.ai.Session`) and compares it with 15 diagnostic-sounding
phrases (`_shared/output-guard/diagnostic-cluster.ts`). Two problems
surfaced in the 2026-10-30 release audit — the first time the guard was
exercised end-to-end in production:

1. **CPU budget.** Every cold isolate embedded all 15 phrases before
   scoring. Inference counts against the Edge Function CPU limit, so
   `ai-tier-b` (Ask Leiko) and `generate-doctor-prep-ai` returned 546
   "CPU Time exceeded". Ask Leiko showed "I'm not sure I can answer that
   one" for every question; the doctor PDF lost its AI paragraphs.
2. **Threshold.** With the CPU fixed, Layer 2 ran — and blocked every
   ordinary answer. gte-small embeddings are anisotropic: any sentence
   about blood pressure scores 0.78–0.88 against the cluster, so 0.75
   flagged everything twice → DEFER ("That's outside what I can help
   with").

## Decision

1. **Precompute the cluster.** `_shared/output-guard/cluster-embeddings.ts`
   holds the 15 vectors (Supabase/gte-small, mean-pooled, L2-normalised,
   384 dims). Layer 2 uses them only when their phrase list matches
   `DIAGNOSTIC_CLUSTER_PHRASES` exactly (same text, same order); otherwise
   it falls back to runtime embedding, which is slower but never wrong. A
   request now embeds only the answer.
2. **Threshold 0.885.** Measured with the same model
   (`tools/guard-embeddings/guard-calibration.json`):

   | set | n | max-similarity range |
   |---|---|---|
   | voice-compliant answers | 12 | 0.786 – 0.878 |
   | diagnostic / prescriptive / urgent sentences | 10 | 0.888 – 0.955 |

   0.885 separates them. `layer2-cosine.test.ts` asserts the threshold
   against the committed set, so a future change can't silently undo it.

## Consequences

- Ask Leiko answers ordinary questions; the doctor PDF gets its AI
  paragraphs back. Five functions use Layer 2 and must be redeployed when
  this changes: ai-tier-b, ai-daily-narration, compute-monthly-baseline,
  compute-weekly-summary, generate-doctor-prep-ai.
- **The margin is thin (0.878 vs 0.888).** Layer 2 is one of three
  guards; Layer 1 (literal vocabulary) and the prompt constraints carry
  most of the load. A long answer with one diagnostic sentence averages
  lower and may pass Layer 2 — Layer 1 still catches the literal words.
- **Follow-up:** grow the calibration set from real outputs (the sampling
  review queue, `ai_clinical_review_queue`) and re-run
  `calibrate.html`; consider sentence-level scoring if the margin
  doesn't widen.

## How to regenerate

Both pages run in Chrome on any machine that can reach jsdelivr and
huggingface.co (the dev container and the Cowork VM cannot;
`onnxruntime-node` failed to load on the founder's Windows PC, so
`gen.mjs` is the fallback for machines where it does):

- Cluster vectors: open `tools/guard-embeddings/gen.html` → saves
  `cluster-embeddings.json` → convert into `cluster-embeddings.ts`
  (header kept, `PRECOMPUTED_CLUSTER = {model, phrases, vectors}`).
- Calibration: open `tools/guard-embeddings/calibrate.html` → saves
  `guard-calibration.json`. Edit the sample sentences in the page first.
