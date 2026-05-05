-- seed.sql — Minimal dev fixtures for `supabase db reset`.
--
-- Real dev users are seeded via the Supabase auth admin API in Sprint 2's
-- onboarding work. For now this file is intentionally near-empty so we
--   (a) don't create fake auth.users rows that bypass the onboarding flow, and
--   (b) keep integration tests in later sprints from accidentally relying on
--       seed-injected state instead of factories.
--
-- Schema validation runs on every `supabase db reset` regardless of seed
-- contents — the migration is the verification target, not this file.

do $$
begin
  raise notice 'Kena seed.sql executed at %', now();
end $$;
