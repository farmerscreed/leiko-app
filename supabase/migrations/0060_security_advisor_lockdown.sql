-- 0060 — close the Supabase security-advisor ERROR/WARN findings that
-- expose data or server work to anyone holding the public anon key
-- (which ships inside the app). Found in the 2026-10-30 release audit.
--
-- Who is affected: nothing in the mobile app. Every caller of the
-- objects below uses the service_role key (edge functions, pg_cron, the
-- content/ops agents — they already read RLS-enabled, policy-less tables
-- such as content_posts and ops_rules, which only service_role can do).
-- service_role bypasses RLS and keeps EXECUTE.

-- 1. RLS on tables that had none. With no policies, only service_role
--    can read or write them. (audit_log_default is a partition of
--    audit_log; access through the parent keeps the parent's policies.)
alter table if exists public.content_slots       enable row level security;
alter table if exists public.content_competitors enable row level security;
alter table if exists public.competitor_posts    enable row level security;
alter table if exists public.content_ideas       enable row level security;
alter table if exists public.content_archive     enable row level security;
alter table if exists public.audit_log_default   enable row level security;

-- 2. Internal SECURITY DEFINER functions: callable only by service_role.
--    Functions get EXECUTE for PUBLIC by default, so revoking from anon
--    alone (as earlier migrations did) left them callable.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.hard_delete_expired_users()',
    'public.invoke_compute_correlations_cron()',
    'public.invoke_compute_monthly_baseline_cron()',
    'public.invoke_compute_weekly_summary_cron()',
    'public.invoke_detect_anomaly_cron()',
    'public.invoke_request_stale_syncs_cron()',
    'public.ops_daily_deposits(timestamp with time zone)',
    'public.families_needing_refresh(interval)',
    -- trigger functions: EXECUTE is checked at CREATE TRIGGER, not when
    -- the trigger fires, so revoking does not affect inserts.
    'public.handle_new_user()',
    'public.resolve_pending_connects_on_pairing()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

-- (App RPCs used by RLS policies — is_family_member, can_see_vital, … —
-- are deliberately left alone: policies evaluate them for every role,
-- so revoking from anon would turn empty results into permission errors.
-- Each already checks auth.uid().)

-- 3. Pin search_path on trigger functions flagged as mutable.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.set_updated_at()',
    'public.readings_immutable_columns_trigger()',
    'public.users_account_type_immutable()',
    'public.external_vitals_immutable_columns()',
    'public.anomaly_events_immutable_columns_trigger()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('alter function %s set search_path = public, pg_temp', fn);
    end if;
  end loop;
end $$;
