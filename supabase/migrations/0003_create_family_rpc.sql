-- 0003_create_family_rpc.sql — Sprint 3.
-- The atomic "create caregiver family" entrypoint. Inserts public.families,
-- public.family_members (role='family_owner'), and an audit_log entry in a
-- single transaction.
--
-- Implementation note: docs/01-data-model.md prescribes a /create-family
-- Edge Function (service_role) for this. We ship a SECURITY DEFINER SQL
-- function instead — same security boundary (bypasses RLS, runs as
-- postgres), better atomicity (one transaction vs three PostgREST calls),
-- no Edge Function deploy infra. The functional contract is identical:
-- the caller is authenticated, the function uses auth.uid() to identify
-- them, returns the new family_id. Comment-only docs divergence to be
-- reconciled in docs/01-data-model.md after Sprint 3.

create or replace function public.create_family(
  _parent_display_name text,
  _parent_relationship text,
  _caregiver_relationship text     -- 'daughter','son','niece','nephew','other'
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
begin
  if v_caller_id is null then
    raise exception 'authentication required'
      using errcode = 'P0001';
  end if;

  -- Per-input validation. The schema's NOT NULL + length checks would
  -- reject empty inputs anyway, but we want a clean P0001 instead of a
  -- check-constraint noise message.
  if _parent_display_name is null or length(trim(_parent_display_name)) = 0 then
    raise exception 'parent_display_name is required' using errcode = 'P0001';
  end if;
  if _parent_relationship is null or length(trim(_parent_relationship)) = 0 then
    raise exception 'parent_relationship is required' using errcode = 'P0001';
  end if;
  if _caregiver_relationship is null or length(trim(_caregiver_relationship)) = 0 then
    raise exception 'caregiver_relationship is required' using errcode = 'P0001';
  end if;

  -- Mode gate: only caregiver / self_buyer accounts may own a family. The
  -- self-buyer hybrid path (D8a §1.3) creates a different shape of family;
  -- self_buyer onboarding (Sprint 4) will branch within this function or
  -- ship its own RPC. For Sprint 3 only caregiver is accepted.
  select account_type into v_account_type
  from public.users
  where id = v_caller_id and deleted_at is null;

  if v_account_type is null then
    raise exception 'caller has no public.users profile' using errcode = 'P0001';
  end if;
  if v_account_type <> 'caregiver' then
    raise exception 'create_family is caregiver-only in Sprint 3 (got %)', v_account_type
      using errcode = 'P0001';
  end if;

  insert into public.families (
    parent_display_name,
    parent_relationship,
    created_by
  ) values (
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
    jsonb_build_object(
      'parent_relationship', trim(_parent_relationship),
      'caregiver_relationship', trim(_caregiver_relationship)
    )
  );

  family_id := v_family_id;
  return next;
end;
$$;

-- Lock down execute: anon cannot call this; only authenticated users can.
revoke all on function public.create_family(text, text, text) from public;
revoke all on function public.create_family(text, text, text) from anon;
grant execute on function public.create_family(text, text, text) to authenticated;
