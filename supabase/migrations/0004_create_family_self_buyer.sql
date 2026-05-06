-- 0004_create_family_self_buyer.sql — Sprint 4.
-- Extends create_family to handle the self-buyer onboarding path
-- (D8a §4). The function now branches on the caller's account_type:
--
--   caregiver  → existing behaviour (parent_user_id stays NULL until a
--                parent joins via parent_pairing; one family_member row
--                with role='family_owner' for the caregiver).
--   self_buyer → user IS the wearer. parent_user_id is set to the
--                caller, parent_relationship is 'self', the user gets
--                one family_member row with role='family_owner'.
--                A separate parent_owner row is intentionally NOT
--                created — the schema's PK (family_id, user_id)
--                forbids two rows for the same user in one family,
--                and self-buyer-ness is signalled by
--                families.parent_user_id = created_by.
--   parent     → rejected. The 'parent' account_type is the
--                invitation-flow target (D8a §1.3 hybrid mode); they
--                never own a family directly.
--
-- The third parameter, _caregiver_relationship, is retained but
-- ignored on the self_buyer path (callers pass 'self' for symmetry,
-- but any value is accepted and recorded in the audit metadata).
--
-- Doc divergence: docs/01-data-model.md states "a single row exists
-- where the user is BOTH family_owner AND parent_owner" for self-buyer
-- families. That is mechanically impossible against the shipped
-- schema — single-value role enum + PK (family_id, user_id) forbids
-- two rows for the same user in one family. This migration commits
-- to the schema-as-shipped: one row, role='family_owner', no
-- parent_owner row. To be reconciled in docs/01 after Sprint 4.

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
