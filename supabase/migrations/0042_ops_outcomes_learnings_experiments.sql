-- 0042_ops_outcomes_learnings_experiments.sql
-- Leiko Operator Slice 3 (Memory & Lab): outcome measurement, durable
-- learnings, and experiments. Service-role only (RLS on, no policies).

create table public.ops_outcomes (
  id          uuid primary key default gen_random_uuid(),
  decision_id uuid references public.ops_decisions(id),
  measured_at timestamptz not null default now(),
  metric      text,
  baseline    numeric,
  actual      numeric,
  delta       numeric,
  verdict     text,                  -- worked | neutral | backfired
  notes       text
);

create table public.ops_learnings (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  topic       text not null,         -- angle | audience | creative | timing | budget
  statement   text not null,
  confidence  numeric,
  evidence    jsonb,
  status      text not null default 'active'
);
create index ops_learnings_status_idx on public.ops_learnings (status, created_at desc);

create table public.ops_experiments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  hypothesis  text not null,
  variable    text,
  control_ref text,
  variant_ref text,
  metric      text,
  started_at  timestamptz,
  ends_at     timestamptz,
  min_sample  integer,
  status      text not null default 'running',
  result      jsonb,
  winner_ref  text
);

alter table public.ops_outcomes     enable row level security;
alter table public.ops_learnings    enable row level security;
alter table public.ops_experiments  enable row level security;
