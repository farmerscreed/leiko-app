-- 0020_pg_cron_hard_delete.sql — Sprint 16.6 FUN-2.
--
-- Closes the 30-day delete-account SLA gap. /delete-account today only
-- soft-deletes (sets users.deleted_at). GDPR Art. 17 + CCPA require
-- erasure within 30 days of request. This migration adds the cron that
-- actually purges the rows once that window has elapsed.
--
-- Strategy: for each public.users row with deleted_at older than
-- 30 days, delete the corresponding auth.users row. The FK
--
--     public.users.id references auth.users(id) on delete cascade
--
-- (see 0001_initial.sql) means deleting from auth.users cascades
-- through public.users, which in turn cascades to every dependent
-- table whose FK is declared `on delete cascade` (most of them) and
-- nulls every `on delete set null` FK. The handful of `on delete
-- restrict` references (families.parent_user_id, learn_cards.author_id,
-- etc.) WILL block the delete; we catch and log instead of failing
-- the whole batch.
--
-- Schedule: daily at 04:00 UTC. Late enough that the 03:00 detect-anomaly
-- cron (0018) has finished; early enough to be far from any user-facing
-- traffic window.
--
-- Configuration: this cron is self-contained — no Edge Function call,
-- no HTTP, no GUCs. The function runs as SECURITY DEFINER so the
-- cron job (which executes as the postgres role) inherits the
-- permissions needed to touch auth.users.

create extension if not exists pg_cron;

create or replace function public.hard_delete_expired_users()
returns table(deleted_count int, skipped_count int)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_deleted int := 0;
  v_skipped int := 0;
begin
  for v_user_id in
    select id
    from public.users
    where deleted_at is not null
      and deleted_at < (now() - interval '30 days')
  loop
    begin
      delete from auth.users where id = v_user_id;
      v_deleted := v_deleted + 1;
    exception
      when foreign_key_violation then
        v_skipped := v_skipped + 1;
        raise warning
          'hard_delete_expired_users: skipped % due to FK constraint',
          v_user_id;
      when others then
        v_skipped := v_skipped + 1;
        raise warning
          'hard_delete_expired_users: skipped % due to error: %',
          v_user_id, sqlerrm;
    end;
  end loop;

  insert into public.audit_log (action, metadata)
  values (
    'compliance.hard_delete_run',
    jsonb_build_object(
      'deleted_count', v_deleted,
      'skipped_count', v_skipped,
      'ran_at', now()
    )
  );

  return query select v_deleted, v_skipped;
end;
$$;

-- Idempotent re-apply: drop any prior schedule first.
do $$
begin
  perform cron.unschedule('hard-delete-expired-users-daily')
  where exists (
    select 1 from cron.job where jobname = 'hard-delete-expired-users-daily'
  );
exception when undefined_function then null;
end$$;

select cron.schedule(
  'hard-delete-expired-users-daily',
  '0 4 * * *',
  $$ select public.hard_delete_expired_users(); $$
);

-- Inspection:
--   select * from cron.job where jobname = 'hard-delete-expired-users-daily';
--   select * from public.audit_log
--     where action = 'compliance.hard_delete_run'
--     order by occurred_at desc limit 10;
--
-- Manual run (e.g. for a one-off purge):
--   select * from public.hard_delete_expired_users();
