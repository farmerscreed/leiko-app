-- 0001_initial.sql — Leiko initial schema.
-- Sourced from docs/01-data-model.md (D7 §3). Order:
--   1. extensions
--   2. enum types
--   3. updated_at trigger function
--   4. tables (in FK dependency order) + indexes + per-table triggers
--   5. handle_new_user (auth.users → public.users sync)
--   6. RLS helpers
--   7. RLS enable + policies
--
-- Doc-divergence notes (to reconcile in docs/01-data-model.md after Sprint 0):
--   * The "members soft-hide" policy in the doc references OLD/NEW which is not
--     valid in a CREATE POLICY WITH CHECK clause. Replaced with a simpler RLS
--     policy plus a BEFORE UPDATE trigger that enforces physiological-value
--     immutability (see `readings_immutable_columns_trigger`).
--   * audit_log is partitioned by occurred_at, so the primary key must include
--     occurred_at. Doc shows `id primary key`; corrected here to
--     `primary key (id, occurred_at)`.

-- 1. Extensions ---------------------------------------------------------------
create extension if not exists pgcrypto;

-- 2. Enum types ---------------------------------------------------------------
create type public.family_role     as enum ('family_owner','caregiver','parent_owner','parent_viewer');
create type public.reading_source  as enum ('watch','manual','clinic','pharmacy','other');
create type public.quality_score   as enum ('good','fair','suspect');
create type public.hidden_reason   as enum (
  'cuff_slipped','measured_someone_else','duplicate_reading',
  'parent_request','caregiver_correction','other'
);
create type public.note_visibility as enum ('private','family');
create type public.vital_type      as enum ('hr','spo2','sleep_session','steps_day','calories_day');
create type public.invitation_kind as enum ('caregiver','parent_pairing');

-- 3. updated_at trigger function ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4. Tables -------------------------------------------------------------------

-- users
create table public.users (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  display_name       text not null,
  photo_url          text,
  preferred_language text not null default 'en',
  timezone           text not null,
  year_of_birth      smallint check (year_of_birth between 1900 and 2100),
  account_type       text not null check (account_type in ('caregiver','parent','self_buyer')),
  marketing_opt_in   boolean not null default false,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index users_email_idx  on public.users (lower(email)) where deleted_at is null;
create index users_active_idx on public.users (id) where deleted_at is null;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- families
create table public.families (
  id                        uuid primary key default gen_random_uuid(),
  parent_user_id            uuid references public.users(id) on delete restrict,
  parent_display_name       text not null,
  parent_relationship       text not null,
  parent_year_of_birth      smallint,
  parent_residence          text,
  subscription_status       text not null default 'free'
    check (subscription_status in ('free','plus','plus_trial','plus_grace','past_due')),
  subscription_renewal_date timestamptz,
  created_by                uuid not null references public.users(id) on delete restrict,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index families_created_by_idx  on public.families (created_by);
create index families_parent_user_idx on public.families (parent_user_id);
create trigger families_set_updated_at before update on public.families
  for each row execute function public.set_updated_at();

-- family_members
create table public.family_members (
  family_id      uuid not null references public.families(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  role           public.family_role not null,
  invited_by     uuid references public.users(id) on delete set null,
  joined_at      timestamptz not null default now(),
  removed_at     timestamptz,
  removed_reason text,
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members (user_id) where removed_at is null;
create unique index family_members_one_owner
  on public.family_members (family_id) where role = 'family_owner' and removed_at is null;
create unique index family_members_one_parent_owner
  on public.family_members (family_id) where role = 'parent_owner' and removed_at is null;

-- devices
create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete restrict,
  serial_number     text not null unique,
  mac_address       text not null,
  model             text not null check (model in ('U16H','U19M')),
  firmware_version  text,
  paired_at         timestamptz not null default now(),
  paired_by_user_id uuid not null references public.users(id),
  unpaired_at       timestamptz,
  last_sync_at      timestamptz,
  last_battery_pct  smallint check (last_battery_pct between 0 and 100),
  created_at        timestamptz not null default now()
);
create index devices_family_idx on public.devices (family_id) where unpaired_at is null;
create unique index devices_active_mac on public.devices (mac_address) where unpaired_at is null;

-- readings
create table public.readings (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete restrict,
  device_id         uuid references public.devices(id) on delete set null,
  source            public.reading_source not null default 'watch',
  measured_at       timestamptz not null,
  measured_at_local text,
  systolic          smallint not null check (systolic between 30 and 300),
  diastolic         smallint not null check (diastolic between 20 and 200),
  pulse             smallint check (pulse between 30 and 240),
  quality_score     public.quality_score,
  quality_flags     jsonb not null default '{}',
  motion_detected   boolean,
  hidden            boolean not null default false,
  hidden_reason     public.hidden_reason,
  hidden_by_user_id uuid references public.users(id),
  hidden_at         timestamptz,
  created_at        timestamptz not null default now()
);
create unique index readings_dedupe on public.readings (device_id, measured_at)
  where device_id is not null;
create index readings_family_time on public.readings (family_id, measured_at desc);
create index readings_visible     on public.readings (family_id, measured_at desc) where hidden = false;
create index readings_for_baseline on public.readings (family_id, measured_at)
  where hidden = false and source = 'watch' and quality_score in ('good','fair');

-- reading immutability trigger (replaces the broken "members soft-hide" with-check OLD ref)
create or replace function public.readings_immutable_columns_trigger()
returns trigger language plpgsql as $$
begin
  if old.systolic     is distinct from new.systolic
  or old.diastolic    is distinct from new.diastolic
  or old.pulse        is distinct from new.pulse
  or old.measured_at  is distinct from new.measured_at
  or old.source       is distinct from new.source
  or old.device_id    is distinct from new.device_id
  or old.family_id    is distinct from new.family_id then
    raise exception 'Reading physiological values and measurement metadata are immutable (rule: D8a §7 + audit policy)';
  end if;
  return new;
end;
$$;
create trigger readings_immutable_columns
  before update on public.readings
  for each row execute function public.readings_immutable_columns_trigger();

-- reading_notes
create table public.reading_notes (
  id         uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.readings(id) on delete cascade,
  family_id  uuid not null references public.families(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete restrict,
  body       text not null check (length(body) <= 500),
  visibility public.note_visibility not null default 'family',
  created_at timestamptz not null default now()
);

-- reading_comments
create table public.reading_comments (
  id         uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.readings(id) on delete cascade,
  family_id  uuid not null references public.families(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete restrict,
  body       text not null check (length(body) <= 280),
  emoji      text check (length(emoji) <= 8),
  created_at timestamptz not null default now()
);

-- vitals_other
create table public.vitals_other (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete restrict,
  device_id     uuid references public.devices(id),
  vital_type    public.vital_type not null,
  measured_at   timestamptz not null,
  value_int     integer,
  value_int_2   integer,
  value_int_3   integer,
  value_jsonb   jsonb,
  hidden        boolean not null default false,
  hidden_reason text,
  created_at    timestamptz not null default now()
);
create unique index vitals_dedupe on public.vitals_other (device_id, vital_type, measured_at)
  where device_id is not null;
create index vitals_family_time on public.vitals_other (family_id, vital_type, measured_at desc);

-- subscriptions
create table public.subscriptions (
  user_id            uuid primary key references public.users(id) on delete cascade,
  rc_app_user_id     text not null,
  product_id         text,
  entitlement        text not null default 'plus',
  status             text not null check (status in ('active','trialing','grace','past_due','cancelled','expired')),
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  cancelled_at       timestamptz,
  last_event_at      timestamptz not null default now(),
  raw_event          jsonb
);

-- invitations
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  invited_by    uuid not null references public.users(id),
  kind          public.invitation_kind not null,
  invitee_label text,
  invitee_email text,
  invitee_phone text,
  pairing_code  text unique,
  url_token     text not null unique default encode(gen_random_bytes(24), 'base64'),
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  accepted_by   uuid references public.users(id),
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index invitations_family_active
  on public.invitations (family_id) where accepted_at is null and cancelled_at is null;

-- ai_conversations
create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  family_id  uuid not null references public.families(id) on delete cascade,
  context    text not null check (context in ('home','reading_detail','weekly_summary','onboarding')),
  created_at timestamptz not null default now()
);

-- ai_messages
create table public.ai_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.ai_conversations(id) on delete cascade,
  role              text not null check (role in ('system','user','assistant')),
  body              text not null,
  tier              text check (tier in ('A','B','C')),
  model             text,
  prompt_tokens     int,
  completion_tokens int,
  flagged           boolean not null default false,
  user_thumb        smallint check (user_thumb in (-1, 0, 1)),
  created_at        timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- audit_log (partitioned by range on occurred_at; PK includes the partition key)
create table public.audit_log (
  id            bigint generated always as identity,
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid references public.users(id),
  family_id     uuid references public.families(id),
  action        text not null,
  target_type   text,
  target_id     uuid,
  metadata      jsonb not null default '{}',
  ip_inet       inet,
  user_agent    text,
  primary key (id, occurred_at)
) partition by range (occurred_at);
create index audit_actor_idx  on public.audit_log (actor_user_id, occurred_at desc);
create index audit_family_idx on public.audit_log (family_id, occurred_at desc);

-- Sprint 0 default partition. The partition-rolling cron Edge Function (Sprint 17)
-- will create explicit monthly partitions and drop expired ones; until then, the
-- default partition catches all writes.
create table public.audit_log_default partition of public.audit_log default;

-- push_tokens
create table public.push_tokens (
  user_id      uuid not null references public.users(id) on delete cascade,
  device_id    text not null,
  expo_token   text not null,
  apns_token   text,
  fcm_token    text,
  platform     text not null check (platform in ('ios','android','web')),
  app_version  text,
  os_version   text,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

-- shopify_orders
create table public.shopify_orders (
  id                 bigserial primary key,
  user_id            uuid references public.users(id),
  family_id          uuid references public.families(id),
  shopify_order_id   bigint not null unique,
  order_number       text,
  fulfilment_status  text,
  carrier            text,
  tracking_number    text,
  tracking_url       text,
  ship_date          timestamptz,
  estimated_delivery date,
  delivered_at       timestamptz,
  raw_event          jsonb,
  updated_at         timestamptz not null default now()
);
create index shopify_orders_user_idx on public.shopify_orders (user_id);
create trigger shopify_orders_set_updated_at before update on public.shopify_orders
  for each row execute function public.set_updated_at();

-- 5. auth.users → public.users sync ------------------------------------------
-- A new auth.users row creates a placeholder public.users row. The onboarding
-- flow (Sprint 2) overwrites display_name / timezone / account_type with real
-- values via the fork screen. Defaults here are placeholders, not user-visible.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.users (id, email, display_name, timezone, account_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC'),
    coalesce(new.raw_user_meta_data->>'account_type', 'caregiver')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. RLS helper functions -----------------------------------------------------
create or replace function public.is_family_member(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members
    where family_id = _family_id
      and user_id   = auth.uid()
      and removed_at is null
  );
$$;

create or replace function public.is_family_owner(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members
    where family_id = _family_id
      and user_id   = auth.uid()
      and role      = 'family_owner'
      and removed_at is null
  );
$$;

-- 7. Row-Level Security -------------------------------------------------------

alter table public.users            enable row level security;
alter table public.families         enable row level security;
alter table public.family_members   enable row level security;
alter table public.devices          enable row level security;
alter table public.readings         enable row level security;
alter table public.reading_notes    enable row level security;
alter table public.reading_comments enable row level security;
alter table public.vitals_other     enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.invitations      enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;
alter table public.audit_log        enable row level security;
alter table public.push_tokens      enable row level security;
alter table public.shopify_orders   enable row level security;

-- users: self read/update; inserts via handle_new_user (security definer) only.
create policy "self read profile"   on public.users for select using (id = auth.uid());
create policy "self update profile" on public.users for update using (id = auth.uid());

-- families: members read; owner updates; inserts via /create-family Edge Function (service_role).
create policy "members read family" on public.families for select using (public.is_family_member(id));
create policy "owner update family" on public.families for update using (public.is_family_owner(id));

-- family_members: members see; owner edits; self can leave.
create policy "members see members" on public.family_members for select using (public.is_family_member(family_id));
create policy "owner edits members" on public.family_members for update using (public.is_family_owner(family_id));
create policy "self-leave"          on public.family_members
  for update using (user_id = auth.uid()) with check (removed_at is not null);

-- devices: members read; owner manages.
create policy "members read devices"  on public.devices for select using (public.is_family_member(family_id));
create policy "owner manages devices" on public.devices for all
  using (public.is_family_owner(family_id))
  with check (public.is_family_owner(family_id));

-- readings: members read; service inserts; members soft-hide; only manual rows can be hard-deleted.
create policy "members read readings"  on public.readings for select using (public.is_family_member(family_id));
create policy "service inserts readings" on public.readings for insert with check (auth.role() = 'service_role');
create policy "members soft-hide"      on public.readings
  for update using (public.is_family_member(family_id))
  with check (hidden_by_user_id = auth.uid());
create policy "manual delete only"     on public.readings
  for delete using (public.is_family_member(family_id) and source = 'manual');

-- reading_notes: visibility-aware; author edits own.
create policy "members read family notes" on public.reading_notes
  for select using (public.is_family_member(family_id) and visibility = 'family');
create policy "author reads own private notes" on public.reading_notes
  for select using (author_id = auth.uid() and visibility = 'private');
create policy "members write own notes" on public.reading_notes
  for insert with check (public.is_family_member(family_id) and author_id = auth.uid());
create policy "author edits own notes" on public.reading_notes
  for update using (author_id = auth.uid());

-- reading_comments: family-scoped; author edits own.
create policy "members read comments"  on public.reading_comments
  for select using (public.is_family_member(family_id));
create policy "members write comments" on public.reading_comments
  for insert with check (public.is_family_member(family_id) and author_id = auth.uid());
create policy "author edits comments"  on public.reading_comments
  for update using (author_id = auth.uid());

-- vitals_other: members read; service inserts.
create policy "members read vitals"   on public.vitals_other for select using (public.is_family_member(family_id));
create policy "service inserts vitals" on public.vitals_other for insert with check (auth.role() = 'service_role');

-- subscriptions: self read; webhook writes via service_role.
create policy "self reads subscription" on public.subscriptions for select using (user_id = auth.uid());

-- invitations: owner reads / creates / cancels.
create policy "owner reads invitations"   on public.invitations
  for select using (public.is_family_owner(family_id));
create policy "owner creates invitations" on public.invitations
  for insert with check (public.is_family_owner(family_id) and invited_by = auth.uid());
create policy "owner cancels invitations" on public.invitations
  for update using (public.is_family_owner(family_id));

-- ai_conversations / ai_messages: self-scoped.
create policy "self reads conversations"   on public.ai_conversations
  for select using (user_id = auth.uid());
create policy "self creates conversations" on public.ai_conversations
  for insert with check (user_id = auth.uid() and public.is_family_member(family_id));
create policy "self reads messages" on public.ai_messages
  for select using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- audit_log: owner reads family-scoped; self reads own; service inserts.
create policy "owner reads family audit" on public.audit_log
  for select using (family_id is not null and public.is_family_owner(family_id));
create policy "self reads own audit"     on public.audit_log
  for select using (actor_user_id = auth.uid());
create policy "service inserts audit"    on public.audit_log
  for insert with check (auth.role() = 'service_role');

-- push_tokens: self only.
create policy "self manages push tokens" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- shopify_orders: self read; webhook writes via service_role.
create policy "self reads orders" on public.shopify_orders for select using (user_id = auth.uid());
