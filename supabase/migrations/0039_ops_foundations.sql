-- 0039_ops_foundations.sql
--
-- The Leiko Operator — Slice 0 foundations (money + marketing agent).
-- Spec: LeikoWebsite/leiko/docs/operator/SPEC.md
--
-- Three tables + one RPC. All service-role-only (RLS on, no policies),
-- same posture as public.orders. The worker (Cloudflare) reads/writes
-- these with the service-role key; no client ever touches them.

-- ── ops_ad_insights_daily ──────────────────────────────────────────
-- One row per (date, level, ref_id). Meta metrics on every row; the
-- reconciled real-money figures live on the level='account' rows
-- (deposits aren't per-ad-attributable without more tracking, so the
-- north-star cost-per-real-deposit is computed at the account/day level).
create table public.ops_ad_insights_daily (
  date                        date    not null,
  level                       text    not null,           -- 'account' | 'campaign' | 'adset' | 'ad'
  ref_id                      text    not null,           -- meta object id, or 'account'
  name                        text,
  spend_kobo                  bigint  not null default 0, -- Meta spend (NGN) × 100
  impressions                 bigint  not null default 0,
  clicks                      bigint  not null default 0,
  link_clicks                 bigint  not null default 0,
  meta_results                integer not null default 0, -- Meta-attributed pixel purchases
  real_deposits               integer,                    -- from orders (account rows only)
  real_revenue_kobo           bigint,                     -- cash recognized that day (account rows)
  cost_per_real_deposit_kobo  bigint,                     -- spend / real_deposits (account rows)
  net_contribution_kobo       bigint,                     -- real_revenue − spend (account rows)
  updated_at                  timestamptz not null default now(),
  primary key (date, level, ref_id)
);

-- ── ops_briefs ─────────────────────────────────────────────────────
-- Stored daily/weekly briefs the agent produces (Slice 1+).
create table public.ops_briefs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null,            -- 'daily' | 'weekly'
  summary_md    text,
  metrics_json  jsonb,
  channels_sent text[]
);

-- ── ops_rules ──────────────────────────────────────────────────────
-- The agent's operating rules. hard_cap rows are the leash and are
-- human-only; heuristic rows the weekly strategist may tune (Slice 3).
create table public.ops_rules (
  key          text primary key,
  value        text not null,
  kind         text not null,            -- 'hard_cap' | 'heuristic'
  editable_by  text not null,            -- 'human' | 'agent'
  updated_at   timestamptz not null default now(),
  updated_by   text
);

-- Seed the leash + starting heuristics. Budget defaults track the
-- $200/mo Phase-1a plan (~₦10,000/day). agent_enabled=false: until it's
-- flipped, the agent proposes only and never executes.
insert into public.ops_rules (key, value, kind, editable_by, updated_by) values
  ('agent_enabled',                 'false', 'hard_cap',  'human', 'migration_0039'),
  ('max_daily_spend_ngn',           '10000', 'hard_cap',  'human', 'migration_0039'),
  ('max_weekly_budget_increase_pct','20',    'hard_cap',  'human', 'migration_0039'),
  ('auto_pause_cpa_multiple',       '2',     'hard_cap',  'human', 'migration_0039'),
  ('auto_action_allowlist',         'pause_dead_ad,shift_budget_between_ads', 'hard_cap', 'human', 'migration_0039'),
  ('target_cpa_ngn',                '24000', 'heuristic', 'agent', 'migration_0039');

-- ── RLS: service-role only, no policies (matches public.orders) ─────
alter table public.ops_ad_insights_daily enable row level security;
alter table public.ops_briefs            enable row level security;
alter table public.ops_rules             enable row level security;

comment on table public.ops_ad_insights_daily is
  'Leiko Operator: daily Meta metrics + reconciled real-deposit figures. Service-role only.';

-- ── ops_daily_deposits RPC ─────────────────────────────────────────
-- Per-day real deposits + cash recognized, from orders (the truth).
-- A deposit is recognized at created_at (₦50,000 for reservations, full
-- price for full orders); a reservation's balance is recognized at
-- balance_paid_at. Flagged/refunded are excluded. The worker calls this
-- via PostgREST rpc so the money logic stays in one place.
create or replace function public.ops_daily_deposits(since timestamptz)
returns table (d date, deposits integer, revenue_kobo bigint)
language sql
security definer
set search_path = public
as $$
  with ev as (
    select created_at as ts,
           1 as dep,
           case when order_type = 'full' then amount_paid_kobo else 5000000 end as rev
    from public.orders
    where status in ('reserved', 'paid') and created_at >= since
    union all
    select balance_paid_at as ts,
           0 as dep,
           greatest(amount_paid_kobo - 5000000, 0) as rev
    from public.orders
    where status = 'paid' and balance_reference is not null and balance_paid_at >= since
  )
  select ts::date as d, sum(dep)::integer as deposits, sum(rev)::bigint as revenue_kobo
  from ev
  group by ts::date;
$$;
