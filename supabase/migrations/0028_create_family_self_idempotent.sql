-- 0028_create_family_self_idempotent.sql
--
-- ADR-0006 Phase 1, Task 2 — make create_family idempotent for the
-- self-buyer's own circle.
--
-- Problem: useEnsureSelfBuyerFamily (client) does a check-then-create —
-- it looks for an existing membership, and if none is found, calls
-- create_family. That lookup + RPC pair is not atomic, so two near-
-- simultaneous mounts (app relaunch, effect re-fire) can both see "no
-- membership" and both call the RPC, minting TWO self-circles for one
-- user. (Observed in the 2026-06-01 investigation alongside the routing
-- scatter.) create_family itself had no guard.
--
-- Fix: in the self_buyer branch, before creating anything, check whether
-- the caller already owns a self-circle (a family they family_own whose
-- parent_user_id = themselves, not soft-removed). If so, RETURN THAT
-- family_id instead of inserting a duplicate. This makes repeated self
-- calls idempotent and closes the race server-side, regardless of client
-- timing.
--
-- Scope: ONLY the self_buyer branch is guarded here. The caregiver branch
-- is intentionally untouched in Phase 1 (it legitimately creates multiple
-- distinct circles, one per cared-for person). The larger "create_family
-- becomes self-circle-only / stops branching on account_type" refactor is
-- ADR-0006 Phase 3, not this migration.
--
-- This is a CREATE OR REPLACE of the function defined in
-- 0004_create_family_self_buyer.sql; signature and grants are unchanged.

create or replace function public.create_family(
  _parent_display_name text,
  _parent_relationship text,
  _caregiver_relationship text
)
returns table (family_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_id    uuid := auth.uid();
  v_family_id    uuid;
  v_account_type text;
  v_parent_uid   uuid;
  v_audit_meta   jsonb;
  v_existing     uuid;
begin
  if v_caller_id is null then
    raise exception 'authentication required'
      using errcode = 'P0001';
  end if;

  if _parent_display_name is null or length(trim(_parent_display_name)) = 0 then
    raise exception 'parent_display_name is required' using errcode = 'P0001';
  end if;
  if _parent_relationship is null or length(trim(_parent_relationship)) = 0 then
    raise exception 'parent_relationship is required' using errcode = 'P0001';
  end if;
  if _caregiver_relationship is null or length(trim(_caregiver_relationship)) = 0 then
    raise exception 'caregiver_relationship is required' using errcode = 'P0001';
  end if;

  select account_type into v_account_type
  from public.users
  where id = v_caller_id and deleted_at is null;

  if v_account_type is null then
    raise exception 'caller has no public.users profile' using errcode = 'P0001';
  end if;

  -- Branch on account_type. caregiver and self_buyer are valid; parent is not.
  if v_account_type = 'caregiver' then
    v_parent_uid := null;
    v_audit_meta := jsonb_build_object(
      'path', 'caregiver',
      'parent_relationship', trim(_parent_relationship),
      'caregiver_relationship', trim(_caregiver_relationship)
    );
  elsif v_account_type = 'self_buyer' then
    v_parent_uid := v_caller_id;
    v_audit_meta := jsonb_build_object(
      'path', 'self_buyer',
      'parent_relationship', trim(_parent_relationship)
    );

    -- IDEMPOTENCY GUARD (self-circle only). If the caller already owns a
    -- self-circle, return it instead of creating a duplicate.
    select f.id into v_existing
    from public.families f
    join public.family_members fm
      on fm.family_id = f.id
     and fm.user_id = v_caller_id
     and fm.role = 'family_owner'
     and fm.removed_at is null
    where f.parent_user_id = v_caller_id
    order by f.created_at asc
    limit 1;

    if v_existing is not null then
      family_id := v_existing;
      return next;
      return;
    end if;
  else
    raise exception 'create_family is not callable for account_type=%', v_account_type
      using errcode = 'P0001';
  end if;

  insert into public.families (
    parent_user_id,
    parent_display_name,
    parent_relationship,
    created_by
  ) values (
    v_parent_uid,
    trim(_parent_display_name),
    trim(_parent_relationship),
    v_caller_id
  )
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, role, invited_by)
  values (v_family_id, v_caller_id, 'family_owner', v_caller_id);

  insert into public.audit_log (
    actor_user_id, family_id, action, target_type, target_id, metadata
  ) values (
    v_caller_id,
    v_family_id,
    'family.created',
    'family',
    v_family_id,
    v_audit_meta
  );

  family_id := v_family_id;
  return next;
end;
$$;

revoke all on function public.create_family(text, text, text) from public;
revoke all on function public.create_family(text, text, text) from anon;
grant execute on function public.create_family(text, text, text) to authenticated;
