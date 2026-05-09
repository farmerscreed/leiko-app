// supabase/functions/_shared/output-guard/embedder.ts — Sprint 12.
//
// Embedding-provider interface for the output guard. Production uses
// Supabase Edge Functions' built-in `Supabase.ai.Session('gte-small')`
// (384-dim, hot in the runtime, no cold-start model download). Unit
// tests pass a stub.
//
// We do NOT use @xenova/transformers — that pulls an 80MB ONNX model
// at first call which is unacceptable Edge Function latency. We do
// NOT use OpenAI text-embedding-3-small — that's the cards_embeddings
// path (Sprint 13) and would reintroduce the OpenAI key dependency
// Sprint 12 is gating off.
//
// Output is L2-normalized — `Supabase.ai.Session.run(text, { mean_pool:
// true, normalize: true })` returns a normalized vector. For
// normalized vectors, cosine similarity equals dot product, but
// `cosine()` in layer2-cosine.ts handles the unnormalized case too
// (defence-in-depth).

export interface Embedder {
  /** Returns a numeric vector for the input text. Length is impl-defined. */
  embed(text: string): Promise<number[]>;
}

/**
 * Production embedder that delegates to the Supabase Edge Function
 * runtime's built-in `Supabase.ai.Session`. Throws if invoked outside
 * the runtime — the Supabase global isn't defined under plain `deno
 * run` / `deno test`. Unit tests should NOT call this; pass a stub
 * embedder instead.
 */
export function createSupabaseEmbedder(): Embedder {
  // The Supabase global is provided by Edge Function runtime.
  // deno-lint-ignore no-explicit-any
  const Sb = (globalThis as any).Supabase;
  if (!Sb || !Sb.ai || !Sb.ai.Session) {
    throw new Error(
      "createSupabaseEmbedder: Supabase.ai.Session is not available — this " +
        "embedder only runs inside Supabase Edge Functions. Use a stub in tests.",
    );
  }
  // gte-small: 384-dim, English, suitable for short-text similarity.
  const session = new Sb.ai.Session("gte-small");
  return {
    async embed(text: string): Promise<number[]> {
      const out = await session.run(text, {
        mean_pool: true,
        normalize: true,
      });
      // Supabase.ai returns either number[] directly or a tensor-shaped
      // object depending on the runtime version. Normalise both shapes.
      if (Array.isArray(out)) return out as number[];
      // deno-lint-ignore no-explicit-any
      const t = out as any;
      if (t && Array.isArray(t.data)) return t.data as number[];
      throw new Error(
        "createSupabaseEmbedder: unexpected Supabase.ai output shape: " +
          JSON.stringify(out).slice(0, 120),
      );
    },
  };
}
