-- 0041_ops_decisions_alerts_chat.sql
-- Leiko Operator Slice 2 (Hands): proposed/executed actions, emergency
-- alerts, and the chat log. Service-role only (RLS on, no policies).

create table public.ops_decisions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  source          text not null,            -- daily | weekly | chat
  type            text not null,            -- pause_ad | set_adset_budget | note | creative | launch
  target_ref      text,
  target_name     text,
  params          jsonb,
  title           text,
  rationale       text,
  hypothesis      text,
  expected_metric text,
  baseline_value  numeric,
  requires_approval boolean not null default true,
  auto_eligible   boolean not null default false,
  status          text not null default 'proposed',
  executor        text,
  executed_at     timestamptz,
  result          jsonb,
  measure_after   timestamptz
);
create index ops_decisions_status_idx on public.ops_decisions (status, created_at desc);

create table public.ops_alerts (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  severity       text not null,
  type           text not null,
  message        text not null,
  ref            text,
  acknowledged_at timestamptz,
  channels_sent  text[]
);
create index ops_alerts_type_idx on public.ops_alerts (type, created_at desc);

create table public.ops_chat (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  role         text not null,
  content      text not null,
  decision_ids text[]
);
create index ops_chat_created_idx on public.ops_chat (created_at desc);

alter table public.ops_decisions enable row level security;
alter table public.ops_alerts    enable row level security;
alter table public.ops_chat      enable row level security;
