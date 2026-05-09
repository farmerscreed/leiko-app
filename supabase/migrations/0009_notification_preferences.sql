-- 0009_notification_preferences.sql — Sprint 10b.3.
--
-- Per-user notification toggles + quiet-hours config. Drives the
-- Settings → Notifications section and (later) the push-routing logic
-- in Sprint 15. Sprint 10b.3 ships the storage + UI; the routing
-- layer lands when the anomaly engine ships.
--
-- Sourced from:
--   docs/04-screens/settings.md (Notifications section)
--   docs/_reference/D13-multi-vitals-constellation-spec.md §11.3
--     (8 push categories)
--   docs/06-dashboards.md … no — that's irrelevant.
--   docs/11-push-notifications.md (referenced; expanded later sprints)
--
-- The 8 categories from D13 §11.3 (BP / HR / SpO2 calm-concerned +
-- urgent variants + sleep) are folded into the four user-facing
-- toggles per the Settings spec: anomaly_notifications covers all
-- "calm-concerned + urgent" rows. We don't surface 8 toggles —
-- bundling matches what users expect from a Notifications panel.

create table public.notification_preferences (
  user_id                 uuid primary key references public.users(id) on delete cascade,
  -- Toggles per docs/04-screens/settings.md §Notifications
  daily_summary           boolean not null default true,
  weekly_summary          boolean not null default true,    -- Plus only at runtime
  anomaly_notifications   boolean not null default true,    -- Plus only at runtime
  watch_status            boolean not null default true,
  family_activity         boolean not null default true,
  subscription_account    boolean not null default true,
  marketing               boolean not null default false,   -- D6: opt-in
  -- Quiet hours — start/end as 'HH:MM' 24h. Default 22:00–07:00 caregiver-local
  -- per the spec; the routing layer uses the user's IANA timezone.
  quiet_hours_enabled     boolean not null default true,
  quiet_hours_start       text not null default '22:00'
    check (quiet_hours_start ~ '^[0-2][0-9]:[0-5][0-9]$'),
  quiet_hours_end         text not null default '07:00'
    check (quiet_hours_end ~ '^[0-2][0-9]:[0-5][0-9]$'),
  -- Bypass flags — anomaly + medication notifications can override
  -- quiet hours (D13 §11.3 confirmed-urgent rows). Surfaced inline in
  -- the Settings explainer.
  anomaly_bypass_quiet    boolean not null default true,
  medication_bypass_quiet boolean not null default true,
  updated_at              timestamptz not null default now()
);

create trigger notification_prefs_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

-- Self-only read + upsert. There is no admin-side write path.
create policy "self reads notification prefs"
  on public.notification_preferences
  for select using (user_id = auth.uid());

create policy "self upserts notification prefs"
  on public.notification_preferences
  for insert with check (user_id = auth.uid());

create policy "self updates notification prefs"
  on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A user gets a row on first read — the client upserts the defaults if
-- the row is missing. We don't backfill via trigger because the
-- handle_new_user trigger already runs at sign-up and adding another
-- responsibility there couples concerns.
