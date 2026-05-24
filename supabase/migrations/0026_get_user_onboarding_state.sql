-- 0026_get_user_onboarding_state.sql — Sprint 19 v7 hotfix.
--
-- The mobile-client `checkOnboardingState` query against
-- public.family_members works on paper (RLS allows self-read via
-- is_family_member), but in v7 it returns hasOnboarded=false for a
-- user with an active membership row. Symptoms observed 2026-05-24:
--   - lawonecloud@gmail.com (self_buyer, family_owner of Lawrence Plus
--     with 56 BP readings) signs in cleanly
--   - Block 8 checkOnboardingState should mark them onboarded
--   - Navigator instead routes them through onboarding again
--   - Server-side count query confirms membership IS active (= 1)
--
-- Root cause isn't fully nailed (possibly RLS recursion timing,
-- possibly JWT propagation on first session, possibly a supabase-js
-- v2 quirk). Rather than debug from afar, this migration ships a
-- SECURITY DEFINER RPC that bypasses all RLS for this one query.
-- It's keyed off auth.uid() so a caller can only retrieve their own
-- state — no PHI leak, no escalation surface.
--
-- The RPC returns both has_onboarded AND primary_family_id so the
-- client can write currentFamilyId to MMKV at the same moment it
-- flips the onboarding flag. Pre-fix Block 8 only wrote the flag,
-- which left the user in a half-state (flag true, familyId null) on
-- fresh-install.

create or replace function public.get_user_onboarding_state()
returns table (
  has_onboarded boolean,
  primary_family_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with active_memberships as (
    select fm.family_id, fm.joined_at
    from public.family_members fm
    where fm.user_id = auth.uid()
      and fm.removed_at is null
  )
  select
    (select count(*) > 0 from active_memberships) as has_onboarded,
    -- Pick the oldest active membership as the "primary" family.
    -- For self_buyers this is the only family. For caregivers with
    -- multiple families, the chooser sheet (Sprint 19 Block 2) lets
    -- the user pick a different active family later; this is just
    -- the default landing family.
    (
      select family_id
      from active_memberships
      order by joined_at asc
      limit 1
    ) as primary_family_id;
$$;

-- Anyone signed in can call this — they only ever see their own
-- state because the function reads auth.uid() inside.
grant execute on function public.get_user_onboarding_state() to authenticated;

-- Revoke from anon explicitly — there's nothing useful for an anon
-- caller and we don't want unauth probing of the RPC surface.
revoke execute on function public.get_user_onboarding_state() from anon;
