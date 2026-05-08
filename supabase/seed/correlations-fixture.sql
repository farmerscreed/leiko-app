-- supabase/seed/correlations-fixture.sql
--
-- Synthetic test data for the correlation engine (Sprint 9 / D13 §9).
-- Seeds two fixture families:
--
--   Family A (strong) — 30 days of paired sleep × morning-BP data with
--     a clean negative correlation (lower sleep → higher morning systolic).
--     Deterministic noise built in via prime-mod math so the data feels
--     realistic but stays reproducible. Expected Pearson r ≈ -0.93,
--     comfortably above the |r| ≥ 0.3 + p < 0.05 + n ≥ 14 threshold —
--     compute-correlations should produce `is_meaningful = true` for
--     `sleep_x_morning_bp`.
--
--   Family B (weak) — 30 days of paired data generated from independent
--     prime-mod schedules. Expected |r| < 0.3, so compute-correlations
--     should NOT produce a meaningful row.
--
-- The fixture is idempotent: it deletes its own rows by deterministic
-- UUID before re-inserting. Re-running the script is safe.
--
-- The fixture is rolling: dates are anchored to current_date so the
-- 30-day window always lands inside the engine's compute scope, no
-- matter when the developer runs the script.
--
-- Usage (local dev):
--   supabase db reset --no-seed     # optional — wipe local DB
--   psql ${LOCAL_DB_URL} -f supabase/seed/correlations-fixture.sql
--   # then trigger the Edge Function or hourly cron to compute
--
-- Acceptance (Sprint 9):
--   • After seeding + compute-correlations, family A has one
--     `correlations` row with correlation_type='sleep_x_morning_bp',
--     is_meaningful=true, pearson_r negative, |pearson_r| ≥ 0.3.
--   • Family B's row (if produced) has is_meaningful=false.

begin;

-- ─────────────────────────────────────────────────────────────────────
-- Deterministic UUIDs — same values every run so the fixture is
-- replaceable without orphaning rows.

-- Auth users
do $$
declare
  fixture_user_a uuid := '11111111-1111-1111-1111-111111111aaa';
  fixture_user_b uuid := '11111111-1111-1111-1111-111111111bbb';
  fixture_family_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  fixture_family_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
begin

-- Step 1: clean up any prior run --------------------------------------
delete from public.correlations where family_id in (fixture_family_a, fixture_family_b);
delete from public.vitals_other where family_id in (fixture_family_a, fixture_family_b);
delete from public.readings     where family_id in (fixture_family_a, fixture_family_b);
delete from public.family_members where family_id in (fixture_family_a, fixture_family_b);
delete from public.families     where id in (fixture_family_a, fixture_family_b);
delete from public.users        where id in (fixture_user_a, fixture_user_b);
delete from auth.users          where id in (fixture_user_a, fixture_user_b);

-- Step 2: auth.users --------------------------------------------------
-- Minimal-shape insert that satisfies GoTrue's NOT-NULL constraints
-- without going through the auth API. The on_auth_user_created trigger
-- (handle_new_user, see 0001 + 0002) auto-creates the public.users row
-- from raw_user_meta_data, so we pack display_name / timezone /
-- account_type into the metadata here. Local-dev only.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    fixture_user_a,
    'authenticated', 'authenticated',
    'fixture-strong@leiko.test',
    crypt('fixture-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'display_name', 'Fixture Strong',
      'timezone',     'Africa/Lagos',
      'account_type', 'self_buyer'
    ),
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    fixture_user_b,
    'authenticated', 'authenticated',
    'fixture-weak@leiko.test',
    crypt('fixture-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'display_name', 'Fixture Weak',
      'timezone',     'Africa/Lagos',
      'account_type', 'self_buyer'
    ),
    now(), now(), '', '', '', ''
  );

-- Step 3: backfill non-trigger fields on public.users -----------------
-- handle_new_user populates id/email/display_name/timezone/account_type.
-- year_of_birth is not in the trigger; set it via UPDATE here. The
-- account_type immutability trigger (0002) doesn't fire because we're
-- not changing account_type.
update public.users set year_of_birth = 1980 where id = fixture_user_a;
update public.users set year_of_birth = 1985 where id = fixture_user_b;

-- Step 4: public.families ---------------------------------------------
-- Self-buyer families: parent_user_id == created_by == self.
insert into public.families (
  id, parent_user_id, parent_display_name, parent_relationship,
  parent_year_of_birth, created_by
) values
  (fixture_family_a, fixture_user_a, 'Fixture Strong', 'self', 1980, fixture_user_a),
  (fixture_family_b, fixture_user_b, 'Fixture Weak',   'self', 1985, fixture_user_b);

-- Step 5: family_members ----------------------------------------------
-- Self-buyer pattern (per 0004_create_family_self_buyer.sql): one row
-- per (family, user) with role='family_owner'. Parent-owner-ness is
-- signalled by families.parent_user_id = created_by.
insert into public.family_members (family_id, user_id, role)
values
  (fixture_family_a, fixture_user_a, 'family_owner'),
  (fixture_family_b, fixture_user_b, 'family_owner');

-- Step 6: 30 days of paired sleep × morning BP for Family A (strong) ─
-- Sleep hours cycle through [4..9], morning systolic = 150 - 5*hours
-- with ±2 mmHg deterministic noise. Strong negative correlation by
-- construction.

insert into public.readings (
  id, family_id, source, measured_at, measured_at_local,
  systolic, diastolic, pulse, quality_score
)
select
  gen_random_uuid(),
  fixture_family_a,
  'watch',
  ((current_date - (29 - i)) + interval '7 hours 13 minutes')::timestamptz,
  to_char(((current_date - (29 - i)) + interval '7 hours 13 minutes'), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
  -- morning systolic: 150 - 5*sleep_hours + small deterministic noise
  150 - 5 * (4 + (i % 6)) + ((i * 13) % 5) - 2,
  -- diastolic loosely tracks systolic (also negatively correlated with sleep)
  88 - 1 * (4 + (i % 6)) + ((i * 11) % 4) - 2,
  68 + ((i * 7) % 10),
  'good'::public.quality_score
from generate_series(0, 29) i;

insert into public.vitals_other (
  id, family_id, device_id, vital_type, measured_at,
  value_int, value_int_2, value_int_3, value_jsonb
)
select
  gen_random_uuid(),
  fixture_family_a,
  null,
  'sleep_session'::public.vital_type,
  ((current_date - (29 - i)) + interval '6 hours')::timestamptz,
  -- total minutes: sleep_hours * 60 + ±5 min deterministic noise
  (4 + (i % 6)) * 60 + ((i * 7) % 11) - 5,
  -- deep minutes: ~25% of total
  ((4 + (i % 6)) * 60) / 4,
  -- light minutes: ~55% of total
  ((4 + (i % 6)) * 60) * 55 / 100,
  jsonb_build_object(
    'sessionStartSec', extract(epoch from ((current_date - (29 - i)) + interval '0 hours')::timestamptz),
    'sessionEndSec',   extract(epoch from ((current_date - (29 - i)) + interval '6 hours')::timestamptz),
    'remMinutes', 0,
    'awakeMinutes', 0,
    'awakeCount', 0,
    'sleepScore', 70
  )
from generate_series(0, 29) i;

-- Step 7: 30 days of paired sleep × morning BP for Family B (weak) ───
-- Sleep + systolic both follow independent prime-mod schedules. By
-- construction the correlation should land below the |r| ≥ 0.3 cutoff.

insert into public.readings (
  id, family_id, source, measured_at, measured_at_local,
  systolic, diastolic, pulse, quality_score
)
select
  gen_random_uuid(),
  fixture_family_b,
  'watch',
  ((current_date - (29 - i)) + interval '7 hours 22 minutes')::timestamptz,
  to_char(((current_date - (29 - i)) + interval '7 hours 22 minutes'), 'YYYY-MM-DD"T"HH24:MI:SSOF'),
  -- ~uncorrelated wave: 122 + ±6 mmHg via prime-23 mod
  118 + ((i * 23) % 12),
  78 + ((i * 19) % 8),
  72 + ((i * 5) % 11),
  'good'::public.quality_score
from generate_series(0, 29) i;

insert into public.vitals_other (
  id, family_id, device_id, vital_type, measured_at,
  value_int, value_int_2, value_int_3, value_jsonb
)
select
  gen_random_uuid(),
  fixture_family_b,
  null,
  'sleep_session'::public.vital_type,
  ((current_date - (29 - i)) + interval '6 hours')::timestamptz,
  -- ~uncorrelated wave: 420 ± 45 min via prime-17 mod (independent of BP's prime-23)
  375 + ((i * 17) % 90),
  100 + ((i * 17) % 30),
  240 + ((i * 17) % 50),
  jsonb_build_object(
    'sessionStartSec', extract(epoch from ((current_date - (29 - i)) + interval '0 hours')::timestamptz),
    'sessionEndSec',   extract(epoch from ((current_date - (29 - i)) + interval '6 hours')::timestamptz),
    'remMinutes', 0,
    'awakeMinutes', 0,
    'awakeCount', 0,
    'sleepScore', 70
  )
from generate_series(0, 29) i;

raise notice 'Correlation fixture seeded: family_a (strong, %), family_b (weak, %).',
  fixture_family_a, fixture_family_b;

end $$;

commit;
