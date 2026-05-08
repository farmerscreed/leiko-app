-- supabase/setup/schedule-compute-correlations.sql — Sprint 9.
--
-- Deferred setup script — NOT auto-applied as a migration. Run this
-- once per environment after deploying the compute-correlations Edge
-- Function. Per docs/15-correlation-engine.md §6.2.
--
-- The script:
--   1. Enables pg_cron + pg_net extensions (idempotent).
--   2. Stores the function URL + service-role key as Postgres settings
--      so the cron job body can stay environment-agnostic.
--   3. Schedules the hourly cron entry that POSTs to the function.
--
-- Why a setup script rather than a migration:
--   • pg_cron is database-level — a single shared cron table across
--     local / staging / prod would create cross-environment side effects
--     if it shipped as a vanilla migration.
--   • The function URL + service-role key vary per environment; a
--     migration with hard-coded URLs would break in any environment
--     that didn't match.
--   • Re-running migrations should be deterministic; cron schedule
--     drift is operationally noisy.
--
-- Usage:
--   1. Set the per-environment values at the top.
--   2. Apply via psql:
--        psql ${DB_URL} -f supabase/setup/schedule-compute-correlations.sql
--   3. Verify:
--        select * from cron.job where jobname = 'compute-correlations-hourly';

-- ── Environment values ─────────────────────────────────────────────
-- Edit these for the target environment before running.
\set compute_correlations_url 'http://host.docker.internal:54321/functions/v1/compute-correlations'
\set service_role_key 'YOUR_SERVICE_ROLE_KEY_HERE'

-- ── Extensions ─────────────────────────────────────────────────────
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ── Persist the env values as Postgres settings ────────────────────
-- ALTER DATABASE puts them in pg_db_role_setting so every connection
-- inherits them; current_setting() in the cron body resolves cleanly.
do $$
begin
  execute format('alter database %I set app.compute_correlations_url = %L', current_database(), :'compute_correlations_url');
  execute format('alter database %I set app.service_role_key = %L', current_database(), :'service_role_key');
end $$;

-- ── Schedule (or re-schedule) the hourly job ───────────────────────
-- Idempotent: unschedule the prior version before re-creating so
-- re-running the script doesn't pile up duplicate entries.
select cron.unschedule('compute-correlations-hourly')
where exists (select 1 from cron.job where jobname = 'compute-correlations-hourly');

select cron.schedule(
  'compute-correlations-hourly',
  '0 * * * *',
  $body$
    select net.http_post(
      url := current_setting('app.compute_correlations_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    )
  $body$
);

-- ── Verify ─────────────────────────────────────────────────────────
select jobname, schedule, active
from cron.job
where jobname = 'compute-correlations-hourly';
