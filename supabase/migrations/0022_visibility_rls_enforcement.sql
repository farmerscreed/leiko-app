-- 0022_visibility_rls_enforcement.sql — Sprint 17b follow-up.
--
-- Closes the silent gap from migration 0010, which added
-- `family_members.vital_visibility` and stopped there. The toggle UI
-- on CaregiverVisibilityScreen has been faithfully writing the JSON
-- since Sprint 10c.2, but the server-side READ policies on
-- `readings` + `vitals_other` never consulted it. Caregivers saw
-- every vital regardless of the owner's settings, which makes the
-- toggles look broken (they aren't — the enforcement layer was
-- missing).
--
-- This migration adds:
--
--   1. `can_see_vital(family_id, vital_kind)` — security-definer
--      helper. family_owner: always true. caregiver: gated on the
--      caller's `vital_visibility` JSON for the matching key.
--      Defaults mirror the client's DEFAULT_VISIBILITY
--      (services/families/visibility.ts) — bp/hr/spo2/activity
--      default visible, sleep default hidden.
--
--   2. Updated SELECT policies on `readings` + `vitals_other` to
--      delegate to the helper. The vital_type discriminator on
--      `vitals_other` rows drives per-row gating; `readings` is
--      always BP (which the client coerces to true anyway, so the
--      net effect for family_owners is unchanged).
--
-- The INSERT + UPDATE policies are NOT touched — those still permit
-- `is_family_member`. Visibility is read-only enforcement; writes
-- still flow through service_role / member-update paths unchanged.
--
-- Why now: founder reported toggling vitals off on Phone 1 (owner)
-- but Phone 2 (caregiver) still seeing them. The toggle UI was the
-- 80% of the user mental model; this migration is the missing 20%.

-- ─── Helper ─────────────────────────────────────────────────────

create or replace function public.can_see_vital(
  _family_id uuid,
  _vital_kind text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with mb as (
    select role, vital_visibility
    from public.family_members
    where family_id = _family_id
      and user_id = auth.uid()
      and removed_at is null
    limit 1
  )
  select case
    -- Non-member: deny outright (the existing per-table membership
    -- policy already does this, but defence in depth).
    when not exists (select 1 from mb) then false
    -- family_owner: full access regardless of vital_visibility.
    when (select role from mb) = 'family_owner' then true
    -- caregiver / parent_viewer: gate on the visibility JSON. The
    -- key lookup maps vital_type discriminators on `vitals_other`
    -- rows to the high-level visibility keys.
    else coalesce(
      (
        select (vital_visibility ->> (
          case _vital_kind
            when 'sleep_session' then 'sleep'
            when 'steps_day'     then 'activity'
            when 'calories_day'  then 'activity'
            when 'bp'            then 'bp'
            when 'hr'            then 'hr'
            when 'spo2'          then 'spo2'
            else _vital_kind
          end
        ))::boolean
        from mb
      ),
      -- Missing JSON / missing key — fall through to the default.
      -- Sleep defaults OFF per D13 §13.2; everything else defaults
      -- ON. Sleep_session maps to the 'sleep' key.
      case _vital_kind
        when 'sleep_session' then false
        when 'sleep'         then false
        else true
      end
    )
  end;
$$;

comment on function public.can_see_vital(uuid, text) is
  'True if the signed-in user is permitted to read a vital of the given kind in this family. family_owner: always true. caregiver: gated on vital_visibility JSON. Maps vital_type discriminators (sleep_session, steps_day, calories_day) to the high-level visibility keys (sleep, activity).';

-- ─── readings RLS ───────────────────────────────────────────────

drop policy if exists "members read readings" on public.readings;
create policy "members read readings"
  on public.readings for select
  using (public.can_see_vital(family_id, 'bp'));

-- ─── vitals_other RLS ───────────────────────────────────────────

-- `vital_type` is an ENUM; cast to text so the helper's (uuid, text)
-- signature matches. Postgres does not implicitly cast enum → text.
drop policy if exists "members read vitals" on public.vitals_other;
create policy "members read vitals"
  on public.vitals_other for select
  using (public.can_see_vital(family_id, vital_type::text));
