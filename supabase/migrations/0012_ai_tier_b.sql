-- 0012_ai_tier_b.sql — Sprint 12.
--
-- Tier-B (Haiku 4.5 via LiteLLM gateway) lands in this sprint. Two
-- schema changes are needed:
--
--   1. ai_conversations.context CHECK constraint gains 'user_question' so
--      Tier-B Q&A flows (D14 §9 conversational surface) can persist.
--      Existing values ('home','reading_detail','weekly_summary',
--      'onboarding') stay — Sprint 12.5 will add 'daily_narration',
--      'monthly_baseline', 'doctor_prep'.
--
--   2. New table ai_clinical_review_queue per D14 §12.3 — Layer 3 of the
--      output guard. The Edge Function samples 10% of Tier-B/C responses
--      AFTER they've passed Layer 1 (regex) and Layer 2 (cosine). The
--      sampled rows here go to a clinical advisor queue; their feedback
--      is the long-loop signal for voice/claim drift.
--
-- Sprint 12 deliberately does NOT add:
--   * ai_quota_usage — quota counting derives from audit_log row counts
--     (action='ai.tier_b_call', occurred_at > month_start). Counter
--     table would be premature optimisation; audit_log is the truth.
--   * Per-context fields on ai_messages — Sprint 12.5 introduces the
--     ambient surfaces and will reshape ai_messages then if needed.
--   * Sonnet 4.6 / Tier-C scaffolding — Sprint 12.5.
--
-- Sourced from:
--   docs/_reference/D14-ambient-ai-architecture.md §9, §12, §15
--   docs/_reference/D11-brand-repositioning.md §3 (voice)
--   docs/00-tech-stack.md (AI Layer, Compliance)

-- 1. ai_conversations.context — add 'user_question' --------------------------

-- The CHECK constraint in 0001_initial.sql is anonymous; Postgres named
-- it ai_conversations_context_check. Drop + re-add with the extended
-- allowed set. Existing rows are unaffected (none in production at
-- Sprint 12 time — Sprint 11 Ask Leiko is client-only).
alter table public.ai_conversations
  drop constraint ai_conversations_context_check;

alter table public.ai_conversations
  add constraint ai_conversations_context_check
  check (context in (
    'home',
    'reading_detail',
    'weekly_summary',
    'onboarding',
    'user_question'
  ));

-- 2. ai_clinical_review_queue ------------------------------------------------

create table public.ai_clinical_review_queue (
  id              uuid primary key default gen_random_uuid(),
  -- The ai_messages row this sample reviews (the assistant response).
  message_id      uuid not null references public.ai_messages(id) on delete cascade,
  -- Denormalised for advisor-side filtering without a join.
  family_id       uuid not null references public.families(id) on delete cascade,
  actor_user_id   uuid not null references public.users(id) on delete cascade,
  -- Routing context — which surface produced the response.
  surface         text not null check (surface in (
    'user_question',
    'daily_narration',
    'reading_detail',
    'weekly_summary',
    'monthly_baseline',
    'doctor_prep_cover',
    'doctor_prep_observations'
  )),
  tier            text not null check (tier in ('B','C')),
  model           text not null,
  -- The user prompt as sent to the LLM AFTER PHI scrub. Useful context
  -- for the advisor reviewing whether the response is appropriate.
  -- Capped at 8KB at insert time by the Edge Function.
  scrubbed_prompt text not null,
  -- The response as delivered to the user. Already passed Layer 1+2.
  response_body   text not null,
  -- Layer 2 cosine against the diagnostic-leaning cluster. Below 0.75
  -- (else Layer 2 would have rejected the response). Stored so the
  -- advisor can sort by "closest to the line" first.
  layer2_cosine   numeric(4,3),
  sampled_at      timestamptz not null default now(),
  -- Review state. Pending until a clinical advisor adjudicates.
  review_status   text not null default 'pending'
    check (review_status in (
      'pending',
      'pass',
      'fail_voice',
      'fail_claim',
      'fail_other'
    )),
  reviewed_at     timestamptz,
  reviewer_user_id uuid references public.users(id) on delete set null,
  review_note     text
);

-- Pending queue = the working surface. Index covers the common query.
create index ai_clinical_review_queue_pending_idx
  on public.ai_clinical_review_queue (sampled_at desc)
  where review_status = 'pending';

-- Family-scoped follow-up (e.g. all reviewed responses for a family).
create index ai_clinical_review_queue_family_idx
  on public.ai_clinical_review_queue (family_id, sampled_at desc);

-- 3. RLS ---------------------------------------------------------------------

alter table public.ai_clinical_review_queue enable row level security;

-- Inserts are service-role only — the ai-tier-b Edge Function writes
-- here when the 10% sample lands.
-- (No INSERT policy needed; RLS denies by default for non-service-role.)

-- Reads: the actor (the user who asked the question) can read their own
-- queued rows. This keeps the data accessible for delete-account and
-- export-data flows that already enumerate per-user records.
create policy "self reads own review rows"
  on public.ai_clinical_review_queue
  for select
  using (actor_user_id = auth.uid());

-- The clinical-advisor admin surface lives behind the service-role key
-- per D14 §12.3 + §20 (advisor role TBD). No app-side write/update
-- policies in this migration; advisor tooling uses service-role.

-- 4. Notes -------------------------------------------------------------------

-- Sampling rate (10% per D14 §12.3) is enforced at the Edge Function,
-- not in the database. The function runs Math.random() < 0.10 after the
-- response passes Layer 1+2 and inserts when the dice roll says so.
-- Doing it server-side rather than DB-side means we never insert rows
-- we'll discard — keeps the queue table small and review-friendly.

-- The audit_log row (action='ai.tier_b_call' or 'ai.tier_c_*') is
-- written for EVERY egress; the review queue is for the 10% deeper-look
-- subset. The two complement each other: audit_log is volumetric truth
-- (used for quota counting + cost tracking), review queue is the
-- voice/claim long-loop.
