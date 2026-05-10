-- 0013_pg_cron_compute_correlations.sql — Sprint 14.5 task 4.
--
-- Schedule the compute-correlations Edge Function to fire every hour
-- at minute 0. The function itself decides which families to process
-- based on local time (see docs/15-correlation-engine.md §6.1 — it
-- iterates families whose local hour is currently 03:00). So the
-- cron only needs to wake up hourly; the geographic filter is done
-- inside the function.
--
-- Sourced from:
--   plans/sprint-14-5-deferred-followups.md (task 4)
--   plans/done/sprint-09-trends-pdf.md close-out (deferral note)
--   memory/sprint_9_followups.md
--   docs/15-correlation-engine.md §6.1 (hourly cron with local-hour gate)
--
-- Configuration model:
--   The schedule entry calls a helper function (public.invoke_compute_
--   correlations_cron) which does the HTTP POST via pg_net. The helper
--   reads the function URL + service-role key from Postgres GUCs, set
--   per-environment outside this migration:
--
--     ALTER DATABASE postgres
--       SET app.settings.functions_base_url = 'http://kong-internal:8000';
--     ALTER DATABASE postgres
--       SET app.settings.service_role_key = '<service-role JWT>';
--
--   Local dev: the founder sets these via supabase studio or psql
--   after `supabase start`. Production: set in the Supabase project
--   settings → Database → Custom Postgres Config (or via Vault).
--
--   If either GUC is missing the helper raises a clear error; pg_cron
--   captures the failure in cron.job_run_details so we see it.

-- 1. Extension --------------------------------------------------------------

create extension if not exists pg_cron;

-- pg_net is already enabled (Sprint 0 / supabase defaults). We rely
-- on net.http_post to invoke the Edge Function from the helper.

-- 2. Helper function --------------------------------------------------------

create or replace function public.invoke_compute_correlations_cron()
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_base_url text;
  v_service_key text;
  v_request_id bigint;
begin
  v_base_url := current_setting('app.settings.functions_base_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  if v_base_url is null or v_base_url = '' then
    raise exception 'invoke_compute_correlations_cron: missing GUC app.settings.functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_compute_correlations_cron: missing GUC app.settings.service_role_key';
  end if;

  -- Fire-and-forget. The Edge Function logs its own results to
  -- audit_log; we don't await the response. net.http_post returns a
  -- request id we expose for cron.job_run_details correlation.
  select net.http_post(
    url := v_base_url || '/functions/v1/compute-correlations',
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

-- 3. Schedule ---------------------------------------------------------------

-- Hourly at minute 0 UTC. The Edge Function gates on family-local
-- hour internally, so global UTC scheduling is correct.
--
-- Job name 'compute-correlations-hourly' is the unique identifier
-- pg_cron uses; if the job already exists, this will succeed
-- silently because we use cron.unschedule + re-schedule below.
do $$
begin
  perform cron.unschedule('compute-correlations-hourly')
  where exists (
    select 1 from cron.job where jobname = 'compute-correlations-hourly'
  );
exception when undefined_function then
  -- pg_cron < 1.5 doesn't expose cron.unschedule by name; ignore on
  -- older runtimes.
  null;
end$$;

select cron.schedule(
  'compute-correlations-hourly',
  '0 * * * *',
  $$ select public.invoke_compute_correlations_cron(); $$
);

-- 4. Notes ------------------------------------------------------------------

-- To inspect the schedule:
--   select * from cron.job where jobname = 'compute-correlations-hourly';
--
-- To inspect recent runs:
--   select * from cron.job_run_details
--     where jobname = 'compute-correlations-hourly'
--     order by start_time desc limit 10;
--
-- To pause without removing:
--   update cron.job set active = false
--     where jobname = 'compute-correlations-hourly';
