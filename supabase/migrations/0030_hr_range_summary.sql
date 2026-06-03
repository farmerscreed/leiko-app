-- 0030_hr_range_summary.sql — vitals data-completeness fix (Stage 1).
--
-- Why: the HR detail screen (screens/VitalDetail/HRDetail.tsx) renders its
-- range-driven surfaces (zones, per-night resting → baseline + sleep×HR
-- correlation, per-day stats) off the local MMKV HR slice, which is
-- hard-capped at RECENT_SAMPLES_CAP = 200 samples. At the watch's real
-- 5-min cadence that is ~16 hours, not the "~7 days" the comment assumes,
-- so every range pill (7d/30d/90d) shows the same ~16h slice. HR is the
-- only vital dense enough that pulling the full window to the device is
-- impractical (~26k rows over 90d), so we aggregate server-side instead.
-- BP/SpO2/sleep/activity stay on direct date-windowed selects (small;
-- already RLS-gated + indexed via readings_family_time / vitals_family_time).
--
-- This function is additive and READ-ONLY: it computes aggregates over
-- existing rows. No schema change, no data mutation.
--
-- Access: SECURITY DEFINER (to read across the family's rows) but gated on
-- public.can_see_vital(_family_id, 'hr') keyed off auth.uid() — a caller
-- only ever gets aggregates for a family they're permitted to read HR for.
-- Mirrors the can_see_vital / get_user_onboarding_state pattern.
--
-- Semantics match the client so baseline/correlation stay consistent:
--   - zones bands: <60 resting, 60–80 calm, 80–110 active, 110+ vigorous
--     (matches HRDetail buildZones)
--   - per-night resting: 10-min rolling-average minimum (≥2 samples in the
--     window) within the 22:00–06:00 local sleep window, night-keyed to the
--     "owning morning" (evening samples roll to the next local date). This
--     mirrors state/hr.ts rollingMinAverage + nightDateKey + inSleepWindow
--     (SLEEP_WINDOW 22→06, ROLLING_WINDOW_SEC 600). _tz is the user's IANA
--     timezone (useAuth profile.timezone); empty/null falls back to UTC.
--   - hidden rows excluded.

create or replace function public.hr_range_summary(
  _family_id uuid,
  _tz        text,
  _from      timestamptz,
  _to        timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _tzn    text := coalesce(nullif(_tz, ''), 'UTC');
  _result jsonb;
begin
  if not public.can_see_vital(_family_id, 'hr') then
    raise exception 'not authorized to read hr for family %', _family_id
      using errcode = '42501';
  end if;

  with win as (
    select measured_at,
           value_int as bpm,
           (measured_at at time zone _tzn) as local_ts
    from public.vitals_other
    where vital_type = 'hr'
      and family_id  = _family_id
      and not hidden
      and measured_at >= _from
      and measured_at <= _to
  ),
  totals as (
    select count(*)              as n,
           round(avg(bpm))       as avg_bpm,
           min(bpm)              as min_bpm,
           max(bpm)              as max_bpm,
           min(measured_at)      as first_at,
           max(measured_at)      as last_at
    from win
  ),
  zones as (
    select count(*) filter (where bpm < 60)                  as resting,
           count(*) filter (where bpm >= 60 and bpm < 80)    as calm,
           count(*) filter (where bpm >= 80 and bpm < 110)   as active,
           count(*) filter (where bpm >= 110)                as vigorous,
           count(*)                                          as total
    from win
  ),
  per_day as (
    select local_ts::date as d,
           round(avg(bpm)) as avg_bpm,
           min(bpm)        as min_bpm,
           max(bpm)        as max_bpm,
           count(*)        as n
    from win
    group by 1
  ),
  night_samples as (
    select bpm,
           measured_at,
           case when extract(hour from local_ts) >= 22
                then (local_ts::date + 1)
                else local_ts::date
           end as night_key
    from win
    where extract(hour from local_ts) >= 22
       or extract(hour from local_ts) < 6
  ),
  rolling as (
    select night_key,
           avg(bpm) over (
             partition by night_key order by measured_at
             range between interval '10 minutes' preceding and current row
           ) as ravg,
           count(*) over (
             partition by night_key order by measured_at
             range between interval '10 minutes' preceding and current row
           ) as rn
    from night_samples
  ),
  resting as (
    select night_key, round(min(ravg)) as resting_bpm
    from rolling
    where rn >= 2
    group by night_key
  )
  select jsonb_build_object(
    'totals', (select row_to_json(totals) from totals),
    'zones',  (select row_to_json(zones)  from zones),
    'per_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d::text, 'avg', avg_bpm, 'min', min_bpm, 'max', max_bpm, 'n', n
      ) order by d) from per_day
    ), '[]'::jsonb),
    'resting_by_night', coalesce((
      select jsonb_agg(jsonb_build_object(
        'night', night_key::text, 'resting', resting_bpm
      ) order by night_key) from resting
    ), '[]'::jsonb)
  ) into _result;

  return _result;
end;
$$;

comment on function public.hr_range_summary(uuid, text, timestamptz, timestamptz) is
  'Server-side HR aggregates for a family over [_from,_to] in _tz: totals, zone distribution, per-day avg/min/max, and per-night resting (10-min rolling-min within 22:00-06:00 local). Read-only; gated on can_see_vital(_family_id, ''hr''). Backs HRDetail range surfaces so they are not capped by the local 200-sample slice.';

grant execute on function public.hr_range_summary(uuid, text, timestamptz, timestamptz) to authenticated;
revoke execute on function public.hr_range_summary(uuid, text, timestamptz, timestamptz) from anon;
