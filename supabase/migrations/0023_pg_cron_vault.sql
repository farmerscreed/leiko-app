-- 0023_pg_cron_vault.sql — Sprint 18 OPS-2 hotfix.
--
-- Hosted Supabase denies `ALTER DATABASE postgres SET app.settings.X`
-- and `ALTER ROLE postgres IN DATABASE postgres SET app.settings.X`
-- with `42501: permission denied to set parameter`. That blocked the
-- GUC-based config model used by the four pg_cron helpers added in
-- migrations 0013, 0015, and 0018. Switching them to read from
-- Supabase Vault (which IS supported for hosted projects).
--
-- Operator setup (one-shot, post-migration — run in dashboard SQL editor):
--
--   select vault.create_secret(
--     'https://<your-project-ref>.supabase.co',
--     'functions_base_url'
--   );
--   select vault.create_secret(
--     '<service-role-JWT>',
--     'service_role_key'
--   );
--
-- NOTE: `functions_base_url` is the project root, NOT the /functions/v1
-- path. The helpers append `/functions/v1/<function-name>` themselves.
-- The earlier inline comment in 0013/0018 was wrong on that point.
--
-- Re-apply / rotation: `vault.update_secret(id, new_value)` or drop +
-- recreate by name. The decrypt path uses `vault.decrypted_secrets`,
-- which is a view that returns the plaintext for any caller with the
-- correct grants. Our helpers are SECURITY DEFINER owned by postgres,
-- so the read works.

create extension if not exists supabase_vault;

-- 1. compute-correlations -------------------------------------------------

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
  select decrypted_secret into v_base_url
    from vault.decrypted_secrets
    where name = 'functions_base_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets
    where name = 'service_role_key';

  if v_base_url is null or v_base_url = '' then
    raise exception 'invoke_compute_correlations_cron: missing vault secret functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_compute_correlations_cron: missing vault secret service_role_key';
  end if;

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

-- 2. compute-weekly-summary ----------------------------------------------

create or replace function public.invoke_compute_weekly_summary_cron()
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
  select decrypted_secret into v_base_url
    from vault.decrypted_secrets
    where name = 'functions_base_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets
    where name = 'service_role_key';

  if v_base_url is null or v_base_url = '' then
    raise exception 'invoke_compute_weekly_summary_cron: missing vault secret functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_compute_weekly_summary_cron: missing vault secret service_role_key';
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

-- 3. compute-monthly-baseline --------------------------------------------

create or replace function public.invoke_compute_monthly_baseline_cron()
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
  select decrypted_secret into v_base_url
    from vault.decrypted_secrets
    where name = 'functions_base_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets
    where name = 'service_role_key';

  if v_base_url is null or v_base_url = '' then
    raise exception 'invoke_compute_monthly_baseline_cron: missing vault secret functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_compute_monthly_baseline_cron: missing vault secret service_role_key';
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

-- 4. detect-anomaly ------------------------------------------------------

create or replace function public.invoke_detect_anomaly_cron()
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
  select decrypted_secret into v_base_url
    from vault.decrypted_secrets
    where name = 'functions_base_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets
    where name = 'service_role_key';

  if v_base_url is null or v_base_url = '' then
    raise exception 'invoke_detect_anomaly_cron: missing vault secret functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_detect_anomaly_cron: missing vault secret service_role_key';
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

-- Cron schedules are unchanged — they still call the same function names.
-- Existing cron.job rows for compute-correlations-hourly /
-- compute-weekly-summary-hourly / compute-monthly-baseline-hourly /
-- detect-anomaly-nightly continue to work; only the function body
-- changes under them.
