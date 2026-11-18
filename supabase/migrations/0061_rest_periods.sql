-- 0061_rest_periods.sql — daytime rest / nap estimates (2026-11-18).
--
-- The watch reports only nightly sleep totals (0x07); it never says
-- when the wearer napped. The phone now estimates daytime rest periods
-- from 5-minute heart rate (sustained low HR near the wearer's own
-- sleeping level) plus the hourly step timeline (no movement), and
-- uploads them as vitals_other rows:
--
--   vital_type  = 'rest_period'
--   measured_at = start of the rest period (dedupe key with device_id)
--   value_int   = duration, minutes
--   value_int_2 = average heart rate during it
--   value_jsonb = { end: ISO UTC, confidence: 'hr_and_steps' | 'hr_only',
--                   baseline_bpm }
--
-- These are ESTIMATES. Sitting very still can look like a nap; the app
-- labels them "estimated". Not fed to anomaly detection.
--
-- Visibility: rest periods follow the wearer's SLEEP visibility toggle
-- for caregivers (default off, D13 §13.2), so can_see_vital maps
-- 'rest_period' to the 'sleep' key.

alter type public.vital_type add value if not exists 'rest_period';

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
    when not exists (select 1 from mb) then false
    when (select role from mb) = 'family_owner' then true
    else coalesce(
      (
        select (vital_visibility ->> (
          case _vital_kind
            when 'sleep_session' then 'sleep'
            when 'rest_period'   then 'sleep'
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
      case _vital_kind
        when 'sleep_session' then false
        when 'rest_period'   then false
        when 'sleep'         then false
        else true
      end
    )
  end;
$$;

comment on function public.can_see_vital(uuid, text) is
  'True if the signed-in user is permitted to read a vital of the given kind in this family. family_owner: always true. caregiver: gated on vital_visibility JSON. Maps vital_type discriminators (sleep_session, rest_period, steps_day, calories_day) to the high-level visibility keys (sleep, activity).';
