-- 0010_caregiver_visibility.sql — Sprint 10c.2.
--
-- Hybrid-mode privacy boundary per D13 §13.2: a self-buyer (parent_owner)
-- who later invites caregivers can hide specific vital streams from
-- them. We store the per-caregiver overrides on the existing
-- family_members row.
--
-- Defaults (when vital_visibility IS NULL):
--   BP        — always visible (it's the primary use case)
--   HR        — visible
--   SpO2      — visible
--   Sleep     — HIDDEN (intimate; opt-in to share)
--   Activity  — visible
--
-- Sourced from:
--   docs/_reference/D13-multi-vitals-constellation-spec.md §13.2
--   docs/04-screens/settings.md (Family / Manage who sees my readings)
--
-- Shape (when populated):
--   { "bp": true, "hr": true, "spo2": true, "sleep": false, "activity": true }
--
-- BP is always true — UI disables the BP toggle. The column accepts any
-- boolean for forward compatibility; the read helper enforces the
-- always-visible rule defence-in-depth.

alter table public.family_members
  add column if not exists vital_visibility jsonb;

-- Sanity constraint: when populated, must be an object (not array / null
-- / scalar). Field-level shape is enforced in TypeScript; the DB allows
-- partial maps so the migration history doesn't need a column update
-- when D13 §13 evolves.
alter table public.family_members
  add constraint family_members_vital_visibility_object
  check (
    vital_visibility is null
    or jsonb_typeof(vital_visibility) = 'object'
  );

-- RLS: no new policies needed. The existing "owner edits members"
-- policy (0001_initial.sql) already permits the family_owner — which
-- is the self-buyer in hybrid mode — to UPDATE caregiver rows in their
-- family.
