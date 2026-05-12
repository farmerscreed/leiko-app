-- 0016_anomaly_engine.sql — Sprint 15.
--
-- Persistence for the multi-vital anomaly engine. Three new tables and
-- one column extension:
--
--   anomaly_events   — one row per fired anomaly (BP, HR, or SpO2).
--                      Sleep + Activity never produce rows (D13 §11.1).
--   bp_baselines     — per-user rolling 14-day BP mean + sigma. Refreshed
--                      nightly by compute-baselines (migration 0018).
--   hr_baselines     — per-user 14-day median resting HR. Same cadence.
--   families.anomaly_sensitivity — per-family multiplier on the σ
--                      threshold, nudged by thumbs feedback per
--                      docs/10-anomaly-logic.md §3.
--
-- Sourced from:
--   plans/sprint-15-push-anomaly.md
--   docs/_reference/D13-multi-vitals-constellation-spec.md §11
--   docs/10-anomaly-logic.md §2, §3, §4
--   docs/11-push-notifications.md §5
--
-- RLS model: anomaly_events follows the same shape as readings — family
-- members may read (caregivers see their parents' events; self-buyers
-- see their own). Service role writes via detect-anomaly + the nightly
-- cron. Thumbs feedback writes go through a self-only update policy
-- guarded so only the thumb / ack columns are mutable.

-- 1. families.anomaly_sensitivity -----------------------------------------

alter table public.families
  add column if not exists anomaly_sensitivity numeric(3, 2) not null default 1.00
  check (anomaly_sensitivity between 0.80 and 1.50);

comment on column public.families.anomaly_sensitivity is
  'Per-family multiplier on the σ threshold for calm-concerned classification. '
  'Default 1.00; thumbs-down +0.05, thumbs-up −0.02 (asymmetric — fewer false '
  'positives is more important). Clamped to [0.80, 1.50] per '
  'docs/10-anomaly-logic.md §3.';

-- 2. anomaly_events -------------------------------------------------------

create table public.anomaly_events (
  id                       uuid primary key default gen_random_uuid(),
  -- The user whose vitals tripped — for caregivers, this is the parent.
  -- For self_buyer / parent modes, this is the user themselves.
  user_id                  uuid not null references public.users(id) on delete cascade,
  -- family_id mirrors the readings/vitals pattern so the existing
  -- is_family_member helper drives RLS.
  family_id                uuid not null references public.families(id) on delete cascade,
  vital_kind               text not null check (vital_kind in ('bp', 'hr', 'spo2')),
  tier                     text not null check (tier in ('calm_concerned', 'confirmed_urgent')),
  reason                   text not null,
  -- For BP single-reading events, the originating reading row. Trend
  -- events (BP 60-min sustained, HR 3-day, SpO2 3-night) have no single
  -- driver row → null.
  reading_id               uuid references public.readings(id) on delete set null,
  -- vitals_other row pointer (HR / SpO2) when a single sample drove it.
  vital_row_id             uuid references public.vitals_other(id) on delete set null,
  triggered_at             timestamptz not null default now(),
  -- Push lifecycle.
  push_sent_at             timestamptz,
  push_outcome             text check (push_outcome in ('sent','suppressed_quiet_hours','suppressed_opt_out','suppressed_dedup','suppressed_rate_limit','failed')),
  push_dispatch_attempts   smallint not null default 0,
  -- Acknowledge (caregiver tapped the banner).
  acknowledged_at          timestamptz,
  acknowledged_by_user_id  uuid references public.users(id) on delete set null,
  -- Thumbs feedback per docs/10-anomaly-logic.md §3.
  feedback_thumb           smallint not null default 0 check (feedback_thumb in (-1, 0, 1)),
  feedback_by_user_id      uuid references public.users(id) on delete set null,
  feedback_at              timestamptz,
  created_at               timestamptz not null default now()
);

-- Indexes:
--   • (user_id, vital_kind, triggered_at desc) — dedup query inside
--     detect-anomaly + per-vital banner lookup on the detail screens.
--   • (family_id, triggered_at desc) where push_outcome is null
--     — used by the most-severe-wins selector on Home.
--   • (family_id, vital_kind, tier) where acknowledged_at is null
--     — used by the banner-hydration query.
create index anomaly_events_user_vital_time
  on public.anomaly_events (user_id, vital_kind, triggered_at desc);
create index anomaly_events_family_time
  on public.anomaly_events (family_id, triggered_at desc);
create index anomaly_events_unacked_family
  on public.anomaly_events (family_id, vital_kind, tier)
  where acknowledged_at is null;
create index anomaly_events_pending_push
  on public.anomaly_events (triggered_at)
  where push_sent_at is null;

-- Anomaly events are immutable in their "what happened" columns;
-- only the push lifecycle, the ack, and the feedback fields may change.
create or replace function public.anomaly_events_immutable_columns_trigger()
returns trigger language plpgsql as $$
begin
  if old.user_id     is distinct from new.user_id
  or old.family_id   is distinct from new.family_id
  or old.vital_kind  is distinct from new.vital_kind
  or old.tier        is distinct from new.tier
  or old.reason      is distinct from new.reason
  or old.reading_id  is distinct from new.reading_id
  or old.vital_row_id is distinct from new.vital_row_id
  or old.triggered_at is distinct from new.triggered_at
  or old.created_at  is distinct from new.created_at then
    raise exception 'Anomaly event identity columns are immutable (rule: Sprint 15 / docs/10-anomaly-logic.md §3)';
  end if;
  return new;
end;
$$;
create trigger anomaly_events_immutable_columns
  before update on public.anomaly_events
  for each row execute function public.anomaly_events_immutable_columns_trigger();

-- 3. bp_baselines ---------------------------------------------------------

create table public.bp_baselines (
  user_id        uuid primary key references public.users(id) on delete cascade,
  family_id      uuid not null references public.families(id) on delete cascade,
  sys_mean       numeric(5, 2) not null,
  dia_mean       numeric(5, 2) not null,
  pulse_mean     numeric(5, 2),
  sigma_sys      numeric(5, 2) not null,
  sigma_dia      numeric(5, 2) not null,
  sigma_pulse    numeric(5, 2),
  days_of_data   smallint not null check (days_of_data >= 0),
  reading_count  smallint not null check (reading_count >= 0),
  computed_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index bp_baselines_family_idx on public.bp_baselines (family_id);
create trigger bp_baselines_set_updated_at before update on public.bp_baselines
  for each row execute function public.set_updated_at();

-- 4. hr_baselines ---------------------------------------------------------

create table public.hr_baselines (
  user_id        uuid primary key references public.users(id) on delete cascade,
  family_id      uuid not null references public.families(id) on delete cascade,
  median_bpm     numeric(5, 2) not null,
  days_of_data   smallint not null check (days_of_data >= 0),
  sample_count   smallint not null check (sample_count >= 0),
  computed_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index hr_baselines_family_idx on public.hr_baselines (family_id);
create trigger hr_baselines_set_updated_at before update on public.hr_baselines
  for each row execute function public.set_updated_at();

-- 5. RLS ------------------------------------------------------------------

alter table public.anomaly_events enable row level security;
alter table public.bp_baselines   enable row level security;
alter table public.hr_baselines   enable row level security;

-- anomaly_events: family members read; service inserts; family members
-- may update only the ack + feedback columns (the immutable-columns
-- trigger above protects identity columns regardless).
create policy "members read anomaly events" on public.anomaly_events
  for select using (public.is_family_member(family_id));
create policy "service inserts anomaly events" on public.anomaly_events
  for insert with check (auth.role() = 'service_role');
create policy "members ack and feedback" on public.anomaly_events
  for update using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy "service updates anomaly events" on public.anomaly_events
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- bp_baselines / hr_baselines: family members read; service writes.
create policy "members read bp baselines" on public.bp_baselines
  for select using (public.is_family_member(family_id));
create policy "service writes bp baselines" on public.bp_baselines
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "members read hr baselines" on public.hr_baselines
  for select using (public.is_family_member(family_id));
create policy "service writes hr baselines" on public.hr_baselines
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
