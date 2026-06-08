-- 0040_ops_runs_journal.sql
--
-- The Leiko Operator's append-only journal. Every cron run / agent action
-- writes one row here, so when the agent wakes up it can read back exactly
-- what it has done and when — its continuity across runs. Combined with
-- the static charter (src/operator/charter.ts = "what it is") and
-- ops_briefs (its daily readouts), this is the agent's memory.

create table public.ops_runs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null,   -- reconcile | daily_brief | weekly | chat | action
  summary     text,
  data        jsonb
);

create index ops_runs_created_idx on public.ops_runs (created_at desc);

alter table public.ops_runs enable row level security;

comment on table public.ops_runs is
  'Leiko Operator append-only run/action journal. Service-role only. Read each run for continuity.';
