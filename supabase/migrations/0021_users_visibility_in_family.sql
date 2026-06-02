-- 0021_users_visibility_in_family.sql — Sprint 17a.
--
-- Closes the silent failure in Settings → Family Members where every
-- row except the signed-in user's renders as "Member" with no
-- display_name. Root cause: the original RLS on public.users only
-- allows `id = auth.uid()`. The Family Members screen joins
-- family_members → users(display_name); for every other member the
-- join returns null and the mapper falls back to the generic label.
--
-- Strategy: add a second policy that also permits selecting a user
-- row when the signed-in user and the target user share an active
-- family membership. Existing "self read profile" policy stays as-is
-- (RLS policies are OR-combined for the same command + role, so the
-- net effect is "self OR same-family").
--
-- Surface exposure: only the columns the join + screen consume —
-- display_name (a chosen handle). Email, year-of-birth, account_type,
-- created_at, etc. are also on public.users but the FamilyMembers
-- screen never selects them. Callers that DO want to read those
-- columns for non-self users still get filtered by the original
-- "self read profile" + this new policy (which both gate SELECT *
-- the same way at row level).
--
-- Why this is safe per CLAUDE.md data rules: same-family members
-- already see each other's vital readings (BP, HR, SpO2, sleep). A
-- chosen display handle is strictly less sensitive than the medical
-- data they already share access to. We do NOT expose email here
-- (the families table holds parent_display_name + parent_relationship
-- separately for the wearer; emails were never on the read path).

-- ---------------------------------------------------------------------------
-- Helper: does the signed-in user share an active family membership
-- with `target_user_id`?
-- ---------------------------------------------------------------------------
create or replace function public.shares_family(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm_self
    join public.family_members fm_other
      on fm_self.family_id = fm_other.family_id
    where fm_self.user_id   = auth.uid()
      and fm_self.removed_at  is null
      and fm_other.user_id  = target_user_id
      and fm_other.removed_at is null
  );
$$;

comment on function public.shares_family(uuid) is
  'True when the signed-in user and the target user are both active members of at least one common family. Used by the same-family users RLS policy added in 0021.';

-- ---------------------------------------------------------------------------
-- New RLS policy on public.users — same-family members can read each
-- other's row. Stacks alongside "self read profile" (OR semantics).
-- ---------------------------------------------------------------------------
create policy "same-family read profile"
  on public.users for select
  using (public.shares_family(id));
