-- 0008_user_demographics.sql — Sprint 10b.1.
--
-- Adds the demographics + hypertension fields the Settings → Profile
-- section captures, and the multi-vitals orchestrator's setUserParams
-- writer needs (per memory/multi_vitals_gap.md "setUserParams + setGoals
-- writers stubbed ... Wire in Sprint 8.5+ when Settings lands").
--
-- All four columns are nullable + optional. Capturing them is a soft ask
-- in onboarding (not gated) and editable in Settings. Until they're
-- populated, the BLE wrapper falls back to existing defaults.
--
-- Sourced from:
--   docs/04-screens/settings.md (Profile section)
--   docs/_reference/D8a-self-buyer-mode.md §10.1 (hypertension chip)
--   docs/_reference/D13-multi-vitals-constellation-spec.md §3.3
--     (setUserParams demographics fields)

-- 1. Enums --------------------------------------------------------------------

create type public.gender as enum (
  'female',
  'male',
  'nonbinary',
  'prefer_not_say'
);

create type public.hypertension_status as enum (
  'yes',
  'no',
  'prefer_not_say'
);

-- 2. Columns ------------------------------------------------------------------
--
-- height_cm: smallint with a wide check (60–260 cm) — covers paediatric
--   to extreme adult range and rejects sentinel-zero typos.
-- weight_kg: numeric(5,2) — three-digit kg with two decimals; precise
--   enough for the BMR estimate that setUserParams feeds into the
--   watch's calorie engine.

alter table public.users
  add column if not exists gender public.gender,
  add column if not exists height_cm smallint
    check (height_cm is null or height_cm between 60 and 260),
  add column if not exists weight_kg numeric(5, 2)
    check (weight_kg is null or weight_kg between 20 and 400),
  add column if not exists hypertension_status public.hypertension_status;

-- 3. RLS — no changes ---------------------------------------------------------
--
-- public.users already has "self read profile" and "self updates own"
-- policies (0001_initial.sql). The new columns inherit them. No
-- additional policy needed.
