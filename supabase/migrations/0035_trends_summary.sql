-- 0035_trends_summary.sql — Trends data-completeness fix (ADR-0008 D4
-- applied to the Trends screen; founder-approved package 2026-06-05).
--
-- Why: useTrendsData pulled RAW readings + vitals_other rows with no
-- limit — PostgREST silently caps the response at max_rows = 1000, and
-- the single combined vitals_other query meant dense HR rows (5-min
-- cadence) crowded sleep/activity rows out entirely at 30d+. The chart
-- series, the summary numbers, AND the generated narrative ("The
-- Letter") were computed from an arbitrary truncated prefix of the
-- window. Day bucketing was also UTC, not the wearer's timezone.
--
-- Fix: one RPC returning exact per-day aggregates for all five vitals,
-- day-bucketed in the wearer's IANA tz (_tz, ''/null → UTC). ≤366
-- points per vital at 1y vs ~105k raw rows. Mirrors hr_range_summary
-- (0030) / doctor_report_vitals_summary (0034).
--
-- Per-vital visibility: each section is gated on can_see_vital(...) so
-- a caregiver with restricted visibility gets an EMPTY section — the
-- same outcome RLS produced on the old raw-row path.
--
-- Semantics mirror utils/trends-aggregate.ts exactly:
--   bp.per_day            day-mean sys/dia/pulse + n; totals avg over READINGS
--   hr.per_day            night_median (22:00–06:00 local) + all_median + n;
--                         the client uses night ?? all (resting proxy)
--   spo2.per_day          day-mean of value_int, day-min of
--                         coalesce(value_int_3, value_int), n
--   sleep.per_night       the FULLEST row per local night (max total; deep
--                         from the same row — cross-device shadow guard)
--   activity.per_day      max(value_int) per day (end-of-day total)

create or replace function public.trends_summary(
  _family_id uuid,
  _tz        text,
  _from      timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with tzv as (
  select coalesce(nullif(_tz, ''), 'UTC') as tz
),
bp_rows as (
  select systolic, diastolic, pulse,
         ((measured_at at time zone (select tz from tzv))::date) as day
  from readings
  where family_id = _family_id and not hidden and measured_at >= _from
    and can_see_vital(_family_id, 'bp')
),
bp_day as (
  select day, avg(systolic) as sys, avg(diastolic) as dia,
         avg(pulse) as pulse, count(*) as n
  from bp_rows group by day
),
hr_rows as (
  select value_int as bpm,
         ((measured_at at time zone (select tz from tzv))::date) as day,
         (extract(hour from (measured_at at time zone (select tz from tzv))) >= 22
          or extract(hour from (measured_at at time zone (select tz from tzv))) < 6) as is_night
  from vitals_other
  where family_id = _family_id and vital_type = 'hr' and not hidden
    and value_int is not null and measured_at >= _from
    and can_see_vital(_family_id, 'hr')
),
hr_day as (
  select day,
         percentile_cont(0.5) within group (order by bpm) filter (where is_night) as night_median,
         percentile_cont(0.5) within group (order by bpm) as all_median,
         count(*) as n
  from hr_rows group by day
),
spo2_rows as (
  select value_int as avg_pct, value_int_3 as min_pct,
         ((measured_at at time zone (select tz from tzv))::date) as day
  from vitals_other
  where family_id = _family_id and vital_type = 'spo2' and not hidden
    and value_int is not null and measured_at >= _from
    and can_see_vital(_family_id, 'spo2')
),
spo2_day as (
  select day, avg(avg_pct) as avg_pct,
         min(coalesce(min_pct, avg_pct)) as min_pct, count(*) as n
  from spo2_rows group by day
),
sleep_rows as (
  select value_int as total, coalesce(value_int_2, 0) as deep,
         ((measured_at at time zone (select tz from tzv))::date) as day
  from vitals_other
  where family_id = _family_id and vital_type = 'sleep_session' and not hidden
    and value_int is not null and measured_at >= _from
    and can_see_vital(_family_id, 'sleep')
),
sleep_pick as (
  select distinct on (day) day, total, deep
  from sleep_rows
  order by day, total desc
),
act_rows as (
  select value_int as steps,
         ((measured_at at time zone (select tz from tzv))::date) as day
  from vitals_other
  where family_id = _family_id and vital_type = 'steps_day' and not hidden
    and value_int is not null and measured_at >= _from
    and can_see_vital(_family_id, 'activity')
),
act_day as (
  select day, max(steps) as steps from act_rows group by day
)
select jsonb_build_object(
  'bp', jsonb_build_object(
    'count', (select count(*) from bp_rows),
    'avg_sys', (select avg(systolic) from bp_rows),
    'avg_dia', (select avg(diastolic) from bp_rows),
    'per_day', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day::text, 'sys', sys, 'dia', dia, 'pulse', pulse, 'n', n
    ) order by day) from bp_day), '[]'::jsonb)
  ),
  'hr', jsonb_build_object(
    'count', (select count(*) from hr_rows),
    'per_day', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day::text, 'night_median', night_median,
      'all_median', all_median, 'n', n
    ) order by day) from hr_day), '[]'::jsonb)
  ),
  'spo2', jsonb_build_object(
    'count', (select count(*) from spo2_rows),
    'per_day', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day::text, 'avg', avg_pct, 'min', min_pct, 'n', n
    ) order by day) from spo2_day), '[]'::jsonb)
  ),
  'sleep', jsonb_build_object(
    'count', (select count(*) from sleep_rows),
    'per_night', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day::text, 'total', total, 'deep', deep
    ) order by day) from sleep_pick), '[]'::jsonb)
  ),
  'activity', jsonb_build_object(
    'count', (select count(*) from act_rows),
    'per_day', coalesce((select jsonb_agg(jsonb_build_object(
      'day', day::text, 'steps', steps
    ) order by day) from act_day), '[]'::jsonb)
  )
);
$$;

comment on function public.trends_summary(uuid, text, timestamptz) is
  'Exact per-day trend aggregates for all five vitals over [_from, now], day-bucketed in the wearer''s tz, per-vital visibility enforced via can_see_vital. Replaces raw-row pulls that PostgREST silently capped at max_rows=1000 (the dense HR rows also starved sleep/activity out of the combined response).';

revoke execute on function public.trends_summary(uuid, text, timestamptz) from anon;
grant execute on function public.trends_summary(uuid, text, timestamptz) to authenticated;
