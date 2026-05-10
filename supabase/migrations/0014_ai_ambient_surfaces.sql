-- 0014_ai_ambient_surfaces.sql — Sprint 12.5 session 1.
--
-- Sprint 12 shipped Tier-B Q&A as a discrete user-initiated surface
-- (`ai_conversations.context = 'user_question'`) plus the multi-vital
-- foundation. Sprint 12.5 adds the AMBIENT surfaces — narrations the
-- user never asks for explicitly (D14 §2 — five of the six AI
-- surfaces are ambient).
--
-- Two schema changes:
--
--   1. Extend `ai_conversations.context` CHECK to allow the new
--      ambient context strings the cron / mobile callers will use.
--      'reading_detail' and 'weekly_summary' were already in the
--      0001 enum (carry-overs from D7); we add 'daily_narration',
--      'monthly_baseline', 'doctor_prep_cover',
--      'doctor_prep_observations'.
--
--   2. New table `ai_narration_cache` — single source of truth for
--      generated narrations across every ambient surface. Keyed on
--      (user_id, surface, scope_key) so the same key shape works
--      for daily (date), reading-detail (reading id), weekly (iso
--      week), monthly (year-month), doctor-prep (export id). Per
--      D14 §3.1 / Q-D14-4 the daily-narration TTL is 4 hours;
--      enforced at read-time (compare generated_at to now), not at
--      DB level — so a single table suffices for every surface.
--
-- Sourced from:
--   docs/_reference/D14-ambient-ai-architecture.md §3, §4, §6, §7, §8
--   plans/sprint-12-5-ambient-ai-surfaces.md (deliverables)

-- 1. ai_conversations.context — add the four new ambient contexts ----------

alter table public.ai_conversations
  drop constraint ai_conversations_context_check;

alter table public.ai_conversations
  add constraint ai_conversations_context_check
  check (context in (
    'home',
    'reading_detail',
    'weekly_summary',
    'onboarding',
    'user_question',
    'daily_narration',
    'monthly_baseline',
    'doctor_prep_cover',
    'doctor_prep_observations'
  ));

-- 2. ai_narration_cache ----------------------------------------------------

create table public.ai_narration_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  surface text not null check (surface in (
    'daily_narration',
    'reading_detail',
    'weekly_summary',
    'monthly_baseline',
    'doctor_prep_cover',
    'doctor_prep_observations'
  )),
  -- Per-surface scope key. Documented in the migration header so a
  -- future developer doesn't have to dig:
  --   daily_narration   → 'YYYY-MM-DD' local-date
  --   reading_detail    → reading_id (UUID, BP) or vitals_other_id
  --   weekly_summary    → 'YYYY-Www' iso-week (e.g. '2026-W19')
  --   monthly_baseline  → 'YYYY-MM' local-month
  --   doctor_prep_*     → pdf_export_id (UUID)
  scope_key text not null,
  body text not null,
  tier text not null check (tier in ('A','B','C')),
  model text,
  prompt_tokens int,
  completion_tokens int,
  -- Whether the response was flagged by the output guard (Layer 1
  -- regex hit OR Layer 2 cosine ≥ 0.75). Carries over from
  -- ai_messages.flagged so the same surface treatment applies.
  flagged boolean not null default false,
  generated_at timestamptz not null default now(),
  -- Upsert key: a single (user_id, surface, scope_key) triple is
  -- the cache slot. ON CONFLICT DO UPDATE on this constraint to
  -- atomically replace the cached body when re-generating.
  constraint ai_narration_cache_unique unique (user_id, surface, scope_key)
);

-- The hot lookup is "give me this user's daily_narration for today's
-- local date" — covered by the unique-constraint index. Add a
-- secondary index for cache-warming queries that need to find rows
-- whose TTL just expired ("daily_narration generated > 4h ago").
create index ai_narration_cache_surface_generated_idx
  on public.ai_narration_cache (surface, generated_at desc);

-- 3. RLS -------------------------------------------------------------------

alter table public.ai_narration_cache enable row level security;

-- Authenticated users read their own narrations only.
create policy "self reads own narrations"
  on public.ai_narration_cache
  for select
  using (user_id = auth.uid());

-- Inserts/updates are service-role only (the ambient Edge Functions
-- write here). No INSERT/UPDATE/DELETE policy for authenticated
-- users — RLS denies by default.

-- 4. Notes -----------------------------------------------------------------

-- TTL semantics:
--   - daily_narration: caller compares generated_at to now() and
--     regenerates if > 4h old (D14 Q-D14-4) or if the user pulls-to-
--     refresh on Home.
--   - reading_detail / weekly_summary / monthly_baseline / doctor_
--     prep_*: cache forever — these surfaces are scoped to a fixed
--     past period (a specific reading, a specific week/month, a
--     specific PDF export) and never change once generated.
--
-- Quota counting (D14 §14.1) reads from public.audit_log row counts
-- (action prefixed 'ai.'); the cache table doesn't double as a
-- counter. Audit log is volumetric truth.
--
-- The clinical-review queue (Sprint 12, ai_clinical_review_queue)
-- continues to receive the 10% sample. The Edge Functions for these
-- ambient surfaces will sample into that same queue with surface
-- = 'daily_narration' / etc — surface enum already permits all four
-- per migration 0012.
