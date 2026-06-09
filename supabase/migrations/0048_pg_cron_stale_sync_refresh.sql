-- 0048_pg_cron_stale_sync_refresh.sql — remote-refresh (auto trigger).
--
-- Companion to the request-sync / send-push 'sync_refresh' path. The
-- caregiver button gives an on-demand "refresh Mum's readings"; this cron
-- is the hands-off safety net: every 3 hours it finds families whose
-- watch is paired but whose data has gone stale, and nudges the owner's
-- phone with a silent push so it syncs without anyone opening the app.
--
-- Mirrors the established cron→edge-function pattern (0018, 0023_vault):
-- the invoker reads the function base URL + service-role key from GUCs.
-- Set per-environment (founder-ops, same as the other crons):
--
--     ALTER DATABASE postgres
--       SET app.settings.functions_base_url = 'http://kong-internal:8000';
--     ALTER DATABASE postgres
--       SET app.settings.service_role_key = '<service-role JWT>';
--
-- No PHI leaves the database — the silent push carries only
-- { type: 'sync_refresh' }.

create extension if not exists pg_cron;

-- ── Stale-family selector ────────────────────────────────────────────
-- Returns the watch-owner for every family that (a) has an active paired
-- device, (b) whose owner has at least one push token, and (c) whose most
-- recent reading (BP or other vital) is older than p_stale — or has none.
create or replace function public.families_needing_refresh(
  p_stale interval default interval '6 hours'
)
returns table (family_id uuid, owner_id uuid)
language sql
security definer
set search_path = public
as $$
  select d.family_id, d.paired_by_user_id as owner_id
  from public.devices d
  where d.unpaired_at is null
    and exists (
      select 1 from public.push_tokens pt
      where pt.user_id = d.paired_by_user_id
    )
    and coalesce(
      greatest(
        (select max(r.created_at) from public.readings r where r.family_id = d.family_id),
        (select max(v.created_at) from public.vitals_other v where v.family_id = d.family_id)
      ),
      'epoch'::timestamptz
    ) < now() - p_stale;
$$;

-- ── Cron invoker ─────────────────────────────────────────────────────
create or replace function public.invoke_request_stale_syncs_cron()
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
    raise exception 'invoke_request_stale_syncs_cron: missing GUC app.settings.functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_request_stale_syncs_cron: missing GUC app.settings.service_role_key';
  end if;

  select net.http_post(
    url := v_base_url || '/functions/v1/request-stale-syncs',
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
  perform cron.unschedule('request-stale-syncs-3h')
  where exists (select 1 from cron.job where jobname = 'request-stale-syncs-3h');
exception when undefined_function then null;
end$$;

-- Every 3 hours. Conservative cadence: the silent push only fires for
-- genuinely-stale families, and send-push coalesces duplicates within 30s.
select cron.schedule(
  'request-stale-syncs-3h',
  '0 */3 * * *',
  $$ select public.invoke_request_stale_syncs_cron(); $$
);

-- Inspection:
--   select * from public.families_needing_refresh();
--   select * from cron.job where jobname = 'request-stale-syncs-3h';
--   select * from cron.job_run_details
--     where jobname = 'request-stale-syncs-3h' order by start_time desc limit 10;
