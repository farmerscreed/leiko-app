-- 0034_doctor_report_vitals_summary.sql — doctor-PDF data-completeness fix.
--
-- Why: generate-doctor-pdf pulled RAW vitals_other rows with no .limit(),
-- which PostgREST silently caps at max_rows = 1000 — and the query had no
-- ORDER BY, so WHICH 1000 was arbitrary. HR at the 5-min cadence crosses
-- 1000 rows in ~3.5 days, so every 7d/30d/90d/1y report's HR section was
-- computed from an arbitrary subset (prod: 5,322 HR rows, report saw
-- ~1,000). SpO2 (hourly) crosses the cap within weeks of wear.
--
-- Fix: aggregate the dense vitals (hr, spo2) in SQL — exact, over the FULL
-- window, and day-bucketed in the wearer's IANA timezone (_tz, '' / null →
-- UTC) so the report's "days" match the wearer's calendar, consistent with
-- the app-side timezone fixes. Mirrors the hr_range_summary (0030) pattern.
--
-- Aggregate semantics intentionally match the previous JS shape functions:
--   hr.per_day.median  — percentile_cont(0.5) == JS median (mean of the two
--                        middle values for even counts)
--   spo2.per_day.min   — min(coalesce(value_int_3, value_int)) (hourly min
--                        within window, falling back to the hourly average)
--   spo2.min_observed  — single lowest observation across BOTH columns
--   spo2.events_below_93 — counts value_int and value_int_3 separately,
--                        matching the JS flatMap over both columns
--
-- Only the service role (the edge function) may execute: the doctor PDF is
-- generated server-side after its own membership validation.

create or replace function public.doctor_report_vitals_summary(
  _family_id uuid,
  _tz        text,
  _from      timestamptz
)
returns jsonb
language sql
stable
set search_path = public
as $$
with hr as (
  select value_int as bpm,
         ((measured_at at time zone coalesce(nullif(_tz, ''), 'UTC'))::date) as day
  from vitals_other
  where family_id = _family_id
    and vital_type = 'hr'
    and not hidden
    and value_int is not null
    and measured_at >= _from
),
hr_day as (
  select day,
         percentile_cont(0.5) within group (order by bpm) as median_bpm,
         count(*) as n
  from hr
  group by day
),
spo2 as (
  select value_int   as avg_pct,
         value_int_3 as min_pct,
         ((measured_at at time zone coalesce(nullif(_tz, ''), 'UTC'))::date) as day
  from vitals_other
  where family_id = _family_id
    and vital_type = 'spo2'
    and not hidden
    and value_int is not null
    and measured_at >= _from
),
spo2_day as (
  select day,
         avg(avg_pct)                          as avg_pct,
         min(coalesce(min_pct, avg_pct))       as min_pct,
         count(*)                              as n
  from spo2
  group by day
)
select jsonb_build_object(
  'hr', jsonb_build_object(
    'count', (select count(*) from hr),
    'min',   (select min(bpm) from hr),
    'max',   (select max(bpm) from hr),
    'per_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', day::text, 'median', median_bpm, 'n', n
      ) order by day) from hr_day
    ), '[]'::jsonb)
  ),
  'spo2', jsonb_build_object(
    'count', (select count(*) from spo2),
    'min_observed', (select min(least(coalesce(min_pct, avg_pct), coalesce(avg_pct, min_pct))) from spo2),
    'events_below_93', (
      select count(*) filter (where avg_pct is not null and avg_pct < 93)
           + count(*) filter (where min_pct is not null and min_pct < 93)
      from spo2
    ),
    'per_day', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', day::text, 'avg', avg_pct, 'min', min_pct, 'n', n
      ) order by day) from spo2_day
    ), '[]'::jsonb)
  )
);
$$;

comment on function public.doctor_report_vitals_summary(uuid, text, timestamptz) is
  'Exact full-window HR + SpO2 aggregates for the doctor PDF, day-bucketed in the wearer''s tz. Replaces raw row pulls that PostgREST silently capped at max_rows=1000. Service-role only.';

revoke execute on function public.doctor_report_vitals_summary(uuid, text, timestamptz) from anon;
revoke execute on function public.doctor_report_vitals_summary(uuid, text, timestamptz) from authenticated;
grant execute on function public.doctor_report_vitals_summary(uuid, text, timestamptz) to service_role;
