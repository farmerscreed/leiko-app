-- 0049_fix_stale_sync_vault.sql — fix remote-refresh auto-trigger config.
--
-- Migration 0048 added invoke_request_stale_syncs_cron() using the GUC
-- pattern (current_setting('app.settings.X')). But hosted Supabase denies
-- `ALTER DATABASE ... SET app.settings.X` (42501), which is exactly why
-- 0023 switched every other cron helper to read from Supabase Vault. 0048
-- missed that. This redefines the invoker to read Vault, matching 0023.
--
-- The Vault secrets `functions_base_url` (project root, e.g.
-- https://<ref>.supabase.co) and `service_role_key` (service-role JWT) are
-- already populated for this project (they drive the other crons). No
-- operator action needed. The cron schedule 'request-stale-syncs-3h' from
-- 0048 is unchanged — only the function body it calls changes.

create or replace function public.invoke_request_stale_syncs_cron()
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
    raise exception 'invoke_request_stale_syncs_cron: missing vault secret functions_base_url';
  end if;
  if v_service_key is null or v_service_key = '' then
    raise exception 'invoke_request_stale_syncs_cron: missing vault secret service_role_key';
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
