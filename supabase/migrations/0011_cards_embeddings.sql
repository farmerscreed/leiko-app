-- 0011_cards_embeddings.sql — Sprint 13 task 1.
--
-- Card-discovery helper backing storage per docs/07-ai-assistant.md §6.
-- Holds 256-dim embeddings (text-embedding-3-small via OpenAI) for every
-- published Learn card, written once at build-time by
-- scripts/build-embeddings.ts. The Tier-A intent router (Sprint 11) and
-- Tier-B card-matcher (Sprint 12) read this table to find the closest
-- card for an EDUCATE response.
--
-- The card body itself is NOT stored here. Articles live as MDX in the
-- bundle (apps/mobile/src/learn/articles/{id}.mdx); only the embedding
-- and small metadata for the matcher lives server-side.
--
-- Sourced from:
--   docs/_reference/D14-ambient-ai-architecture.md §10 (multi-vital cluster IDs)
--   docs/07-ai-assistant.md §6 (matchCard contract, 0.78 cosine threshold)
--   docs/08-learn-module.md §5 (frontmatter schema)

-- 1. Extension --------------------------------------------------------------

create extension if not exists vector;

-- 2. Table ------------------------------------------------------------------

create table if not exists public.cards_embeddings (
  card_id text primary key,
  -- 256 chosen to match text-embedding-3-small's reduced-dim mode
  -- (cheaper at the cost of some recall; D14 §10 deems acceptable for
  -- a ~30-card library where keyword stage handles most matches).
  embedding vector(256) not null,
  -- Mirrored from frontmatter so the matcher can filter without a
  -- second client-side article fetch.
  category text not null,
  audience text[] not null default '{}',
  -- True for Cluster A (clinical-tone) cards. The matcher must never
  -- return a clinical-review-required card to a production caller
  -- unless clinical_reviewed_at is set. Defence-in-depth — the client
  -- also filters at render time per docs/08-learn-module.md.
  clinical_review_required boolean not null default false,
  clinical_reviewed_at timestamptz,
  -- Build provenance — which CI run wrote this row.
  source_commit_sha text,
  -- Schema version for the embedding model. Bumping this invalidates
  -- the row and forces a regeneration on the next build.
  embedding_model text not null default 'text-embedding-3-small@256',
  updated_at timestamptz not null default now()
);

-- HNSW index for approximate nearest-neighbour search at small library
-- size; switch to ivfflat if the library grows past ~1000 cards.
create index if not exists cards_embeddings_embedding_hnsw
  on public.cards_embeddings
  using hnsw (embedding vector_cosine_ops);

create index if not exists cards_embeddings_category
  on public.cards_embeddings (category);

-- 3. RLS --------------------------------------------------------------------

alter table public.cards_embeddings enable row level security;

-- Authenticated users can read every embedding row that has either
-- (a) clinical_review_required = false, or (b) a clinical_reviewed_at
-- timestamp set. Unreviewed Cluster A rows are hidden from app callers
-- so the matcher cannot surface them in production.
create policy "anyone can read reviewed cards"
  on public.cards_embeddings
  for select
  using (
    auth.role() = 'authenticated'
    and (
      clinical_review_required = false
      or clinical_reviewed_at is not null
    )
  );

-- Writes happen via service-role only (the build-embeddings script
-- uses the service-role key in CI). No INSERT/UPDATE/DELETE policy for
-- authenticated users.

-- 4. Notes ------------------------------------------------------------------

-- The embedding writer (scripts/build-embeddings.ts, Sprint 13 task 12)
-- runs an upsert keyed on card_id with on conflict do update set
-- embedding = excluded.embedding, updated_at = now(). The embedding
-- model field gates regeneration: if a build runs against a different
-- model name, the script clears + reinserts.
