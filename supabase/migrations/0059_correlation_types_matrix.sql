-- 0059 — allow the cross-vital matrix correlation types.
--
-- The 2026-08-19 matrix (PR #28) added three correlation types to
-- compute-correlations (supabase/functions/compute-correlations/types.ts):
--   sleep_x_resting_hr, activity_x_morning_bp, after_meds_x_bp
-- but 0005's check constraint still only allowed the original three, so
-- every insert of a new type failed with 23514
-- (correlations_correlation_type_check). Found in the 2026-10-30 release
-- audit: since the hourly cron recovered on 2026-10-29, each user's run
-- saved the first three types and then errored on sleep_x_resting_hr.
--
-- Idempotent: drops the constraint by name if present and re-adds it with
-- the full list. No data changes — existing rows are all original types.

alter table public.correlations
  drop constraint if exists correlations_correlation_type_check;

alter table public.correlations
  add constraint correlations_correlation_type_check
  check (correlation_type in (
    'sleep_x_morning_bp',
    'activity_x_resting_hr',
    'spo2_dip_x_sleep_score',
    'sleep_x_resting_hr',
    'activity_x_morning_bp',
    'after_meds_x_bp'
  ));
