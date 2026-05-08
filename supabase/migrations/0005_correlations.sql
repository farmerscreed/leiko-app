-- 0005_correlations.sql — Cross-vital correlation engine table.
-- Sourced from docs/_reference/D13-multi-vitals-constellation-spec.md §9.2
-- + docs/15-correlation-engine.md.
--
-- One row per (family, user, correlation_type) per nightly compute run.
-- The engine writes; clients only read. Trends + vital-detail surfaces
-- query the latest row per (user, correlation_type) with
-- `is_meaningful = true`. Historical rows are retained so the engine's
-- output can be audited over time (and Tier-C summaries can describe
-- trend changes between weeks); pruning policy is a v1.1 follow-up.
--
-- Statistical thresholds (D13 §9.3):
--   • Pearson r computed on a 30-day window per user
--   • Minimum sample size: 14 paired observations
--   • Threshold for "meaningful": |r| >= 0.3 AND p < 0.05
--   • Significance test: two-tailed Pearson p-value
-- The engine writes `is_meaningful` once per row so clients can filter
-- without re-deriving the rule.

-- 1. Table -------------------------------------------------------------------

create table public.correlations (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  correlation_type  text not null check (correlation_type in (
                      'sleep_x_morning_bp',
                      'activity_x_resting_hr',
                      'spo2_dip_x_sleep_score'
                    )),
  window_days       integer not null default 30 check (window_days > 0),
  computed_at       timestamptz not null default now(),
  -- Statistical outputs.
  pearson_r         double precision,
  effect_size       double precision,
  effect_unit       text,
  significance      double precision,
  sample_n          integer,
  is_meaningful     boolean not null default false,
  -- Surfacing copy generated alongside the stats; voice rules per
  -- D13 §9.5. Both columns can be null when the engine couldn't derive
  -- a confident narrative; the UI falls back to the stats line.
  narrative_short   text,
  narrative_long    text,
  created_at        timestamptz not null default now()
);

-- Latest-per-type query path: (family, user, computed_at desc) +
-- correlation_type filter. Index covers the common access pattern
-- without re-creating the family scope.
create index correlations_family_user on public.correlations (family_id, user_id, computed_at desc);
create index correlations_meaningful on public.correlations (family_id, user_id, correlation_type, computed_at desc)
  where is_meaningful = true;

-- 2. RLS ---------------------------------------------------------------------

alter table public.correlations enable row level security;

-- Members read every correlation in their family scope. Same pattern as
-- vitals_other / readings.
create policy "members read correlations" on public.correlations
  for select using (public.is_family_member(family_id));

-- Engine (compute-correlations Edge Function) writes via service_role.
-- Clients NEVER insert/update/delete — the engine is the only writer.
create policy "service writes correlations" on public.correlations
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
