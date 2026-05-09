-- 0006_external_vitals.sql — Read-path namespace for vitals pulled from
-- Apple Health / Health Connect. Sourced from
-- docs/_reference/D13-multi-vitals-constellation-spec.md §12.3 and the
-- Sprint 9.5 card.
--
-- These rows are NOT Leiko-captured readings. They are snapshots of values
-- the user has entered into Apple Health (typically from a connected
-- weight scale, glucose monitor, or manual entry) that we surface on
-- Trends as a separate series. Per D13 §12.6 we never integrate them into
-- Leiko's anomaly engine — they exist only to keep the user's numbers
-- "in one place" without claiming clinical responsibility for them.
--
-- Write model (Sprint 9.5 §Phase 3 / Task 7):
--   • Client reads from HK / HC on-device (only the user's phone has
--     OS-level access to the platform store)
--   • Client POSTs to a future /sync-external-vitals Edge Function
--   • That function runs as service_role and inserts here
-- The "service inserts" RLS policy below mirrors the readings + correlations
-- pattern. The Edge Function itself ships in a later commit.
--
-- Round-trip prevention: when the client filters HK/HC samples before
-- POSTing, it excludes any whose sourceBundleId / packageName matches our
-- own bundle id. This row still records `source_origin` for forensic
-- traceability — *which* third-party app or device wrote the value into
-- the platform store.

-- 1. Enums ------------------------------------------------------------------

create type public.external_vital_platform as enum (
  'apple_health',
  'health_connect'
);

-- v1.0 surface: weight + height feed BMR / calorie context, blood glucose
-- is read-only and shown as its own Trends series. Sleep / activity from
-- the platform are NOT pulled — Leiko writes those types and reading them
-- back would round-trip our own data. See D13 §12.3.
create type public.external_vital_type as enum (
  'weight',
  'height',
  'blood_glucose'
);

-- 2. Table ------------------------------------------------------------------

create table public.external_vitals (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete restrict,
  user_id         uuid not null references public.users(id) on delete cascade,
  source_platform public.external_vital_platform not null,
  -- Apple `sourceName` / `sourceBundleId` or HC `dataOrigin.packageName`.
  -- Free-text because the platforms publish many third-party origins
  -- (Withings scale, FreeStyle Libre, manual Apple Watch entry) and we
  -- record exactly what we read so a future support-debug call can trace
  -- where a value came from.
  source_origin   text not null,
  vital_type      public.external_vital_type not null,
  measured_at     timestamptz not null,
  -- numeric covers all v1.0 vitals: weight kg (~30-300, 1 dp), height m
  -- (~0.5-2.5, 2 dp), glucose mg/dL or mmol/L (~30-600 / 1.5-30).
  value_numeric   numeric not null check (value_numeric > 0),
  -- Markets disagree on glucose units — Nigeria mmol/L, US mg/dL — and
  -- weight/height bring imperial vs metric ambiguity. Store the unit the
  -- platform handed us; the UI converts at render time.
  value_unit      text not null check (value_unit in (
                    'kg', 'lb',
                    'm', 'cm', 'in',
                    'mg/dL', 'mmol/L'
                  )),
  hidden          boolean not null default false,
  hidden_reason   text,
  hidden_by_user_id uuid references public.users(id),
  hidden_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- Dedupe: the same (user, platform, origin, vital_type, measured_at)
-- tuple identifies a single platform sample. Background fetch may pull
-- the same window multiple times; the unique index turns retries into
-- no-ops.
create unique index external_vitals_dedupe
  on public.external_vitals (user_id, source_platform, source_origin, vital_type, measured_at);

-- Read pattern: latest values per (user, vital_type) for the Trends
-- screen. Family-scoped because hybrid-mode caregivers may view the
-- self-buyer's external vitals (subject to D13 §13.2 visibility rules,
-- enforced at the application layer).
create index external_vitals_family_time
  on public.external_vitals (family_id, user_id, vital_type, measured_at desc)
  where hidden = false;

-- 3. RLS --------------------------------------------------------------------

alter table public.external_vitals enable row level security;

create policy "members read external vitals" on public.external_vitals
  for select using (public.is_family_member(family_id));

-- /sync-external-vitals Edge Function (Sprint 9.5 / Task 7) is the only
-- writer. Clients NEVER insert directly — the device-side HK/HC read path
-- is in the React Native app, but the write path always goes through the
-- service-role Edge Function for parity with the readings + vitals_other
-- write model.
create policy "service inserts external vitals" on public.external_vitals
  for insert with check (auth.role() = 'service_role');

-- Members may soft-hide a row (e.g. "this scale isn't mine"). Mirrors the
-- readings "members soft-hide" policy.
create policy "members soft-hide external vitals" on public.external_vitals
  for update using (public.is_family_member(family_id))
  with check (hidden_by_user_id = auth.uid());

-- Hard delete forbidden via RLS (no for-delete policy declared). The
-- platform owns the source of truth; if the user removes a sample from
-- Apple Health and re-syncs, the next background fetch reflects the
-- absence by simply not re-inserting it.

-- 4. Immutability trigger ---------------------------------------------------
-- Physiological columns are immutable post-insert, same posture as the
-- readings table. Implemented as a BEFORE UPDATE trigger because Postgres
-- does not expose OLD/NEW inside CREATE POLICY (see the equivalent
-- comment on readings in 0001_initial.sql).

create or replace function public.external_vitals_immutable_columns()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.family_id is distinct from old.family_id
     or new.user_id is distinct from old.user_id
     or new.source_platform is distinct from old.source_platform
     or new.source_origin is distinct from old.source_origin
     or new.vital_type is distinct from old.vital_type
     or new.measured_at is distinct from old.measured_at
     or new.value_numeric is distinct from old.value_numeric
     or new.value_unit is distinct from old.value_unit
     or new.created_at is distinct from old.created_at then
    raise exception 'external_vitals: physiological columns are immutable; only hidden, hidden_reason, hidden_by_user_id, hidden_at are mutable';
  end if;
  return new;
end;
$$;

create trigger external_vitals_immutable_columns_trigger
  before update on public.external_vitals
  for each row execute function public.external_vitals_immutable_columns();
