-- 0015_pg_cron_tier_c.sql — Sprint 12.5 session 3.
--
-- Schedule the two Tier-C ambient surfaces via pg_cron, mirroring
-- the pattern Sprint 14.5 established for compute-correlations
-- (helper function reads URL + service-role key from GUCs; cron
-- entry calls the helper).
--
--   compute-weekly-summary   → hourly UTC (cache dedupes; only the
--                              first run of each ISO week per
--                              user does real work)
--   compute-monthly-baseline → hourly UTC (cache key is YYYY-MM,
--                              same dedupe property)
--
-- Both functions internally honour AI_TIER_C_PROD_DATA_ENABLED —
-- when false (the dev default), they cache a deterministic
-- placeholder instead of calling Sonnet 4.6. Founder flips the
-- env var per-environment to enable real generation.
--
-- Sourced from:
--   plans/sprint-12-5-ambient-ai-surfaces.md (deliverables 4 + 5)
--   docs/_reference/D14-ambient-ai-architecture.md §6, §7

-- 1. Helpers ---------------------------------------------------------------

create or replace function public.invoke_compute_weekly_summary_cron()
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
    raise exception 'invoke_compute_weekly_summary_cron: missing GUC app.settings.functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_compute_weekly_summary_cron: missing GUC app.settings.service_role_key';
  end if;

  select net.http_post(
    url := v_base_url || '/functions/v1/compute-weekly-summary',
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

create or replace function public.invoke_compute_monthly_baseline_cron()
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
    raise exception 'invoke_compute_monthly_baseline_cron: missing GUC app.settings.functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_compute_monthly_baseline_cron: missing GUC app.settings.service_role_key';
  end if;

  select net.http_post(
    url := v_base_url || '/functions/v1/compute-monthly-baseline',
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

-- 2. Schedules -------------------------------------------------------------

-- Idempotent re-apply: drop existing entries by name first.
do $$
begin
  perform cron.unschedule('compute-weekly-summary-hourly')
  where exists (select 1 from cron.job where jobname = 'compute-weekly-summary-hourly');
  perform cron.unschedule('compute-monthly-baseline-hourly')
  where exists (select 1 from cron.job where jobname = 'compute-monthly-baseline-hourly');
exception when undefined_function then null;
end$$;

select cron.schedule(
  'compute-weekly-summary-hourly',
  '0 * * * *',
  $$ select public.invoke_compute_weekly_summary_cron(); $$
);

select cron.schedule(
  'compute-monthly-baseline-hourly',
  '0 * * * *',
  $$ select public.invoke_compute_monthly_baseline_cron(); $$
);
