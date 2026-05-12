-- 0018_pg_cron_detect_anomaly.sql — Sprint 15.
--
-- Schedule the detect-anomaly Edge Function in cron mode to fire
-- nightly at 03:00 UTC. The function recomputes BP + HR baselines,
-- evaluates HR 3-day trend + SpO2 3-night trend, and writes
-- anomaly_events for any new trends. BP single-reading detection
-- runs on the hot path (/sync → detect-anomaly inline) and is NOT
-- the cron's responsibility.
--
-- Configuration mirrors the Sprint 14.5 / Sprint 12.5.3 cron helper
-- pattern: the helper function reads the function URL + service-role
-- key from Postgres GUCs. Set per-environment:
--
--     ALTER DATABASE postgres
--       SET app.settings.functions_base_url = 'http://kong-internal:8000';
--     ALTER DATABASE postgres
--       SET app.settings.service_role_key = '<service-role JWT>';
--
-- Sourced from:
--   plans/sprint-15-push-anomaly.md (deliverable: detect-anomaly cron)
--   docs/10-anomaly-logic.md §2 (baseline cadence)
--   docs/_reference/D13-multi-vitals-constellation-spec.md §11

create extension if not exists pg_cron;

create or replace function public.invoke_detect_anomaly_cron()
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_base_url text := current_setting('app.settings.functions_base_url', true);
  v_service_key text := current_setting('app.settings.service_role_key', true);
  v_request_id bigint;
begin
  if v_base_url is null or v_base_url = '' then
    raise exception 'invoke_detect_anomaly_cron: missing GUC app.settings.functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_detect_anomaly_cron: missing GUC app.settings.service_role_key';
  end if;

  select net.http_post(
    url := v_base_url || '/functions/v1/detect-anomaly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('mode', 'cron')
  )
  into v_request_id;
  return v_request_id;
end;
$$;

-- Idempotent re-apply.
do $$
begin
  perform cron.unschedule('detect-anomaly-nightly')
  where exists (select 1 from cron.job where jobname = 'detect-anomaly-nightly');
exception when undefined_function then null;
end$$;

-- 03:00 UTC nightly. Late enough that an overnight SpO2 dip sustained
-- to 02:30 will be captured in the same day's pass; early enough that
-- the morning caregiver push goes out before the user's first reading.
select cron.schedule(
  'detect-anomaly-nightly',
  '0 3 * * *',
  $$ select public.invoke_detect_anomaly_cron(); $$
);

-- Inspection:
--   select * from cron.job where jobname = 'detect-anomaly-nightly';
--   select * from cron.job_run_details
--     where jobname = 'detect-anomaly-nightly'
--     order by start_time desc limit 10;
