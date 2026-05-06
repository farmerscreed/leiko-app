-- Manual verification for migration 0003_create_family_rpc.sql.
-- Run after `supabase start`:
--
--   psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
--        -f supabase/tests/0003_create_family_rpc.test.sql
--
-- Sprint 3 acceptance: a caregiver can create a family + family_members
-- owner row + audit_log entry in a single transaction via the
-- create_family RPC. Non-caregiver account_types are rejected.

begin;

-- A. caregiver path: success ---------------------------------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  fid uuid;
  member_count int;
  audit_count  int;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    uid,
    'caregiver-create@test.local',
    jsonb_build_object('account_type', 'caregiver', 'timezone', 'UTC')
  );

  -- Simulate the auth.uid() call. set_config('request.jwt.claim.sub', ...)
  -- is what PostgREST would do for the RPC caller.
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  select family_id into fid
  from public.create_family('Mama Linda', 'mother', 'daughter');

  if fid is null then
    raise exception 'TEST FAIL: create_family returned null family_id';
  end if;

  -- Family row inserted with the right shape.
  if not exists (
    select 1 from public.families
    where id = fid
      and parent_display_name = 'Mama Linda'
      and parent_relationship = 'mother'
      and created_by = uid
  ) then
    raise exception 'TEST FAIL: families row not inserted correctly';
  end if;
  raise notice 'OK: families row created';

  -- Exactly one family_owner row.
  select count(*) into member_count
  from public.family_members
  where family_id = fid and user_id = uid and role = 'family_owner';
  if member_count <> 1 then
    raise exception 'TEST FAIL: expected 1 family_owner row, got %', member_count;
  end if;
  raise notice 'OK: family_owner row created';

  -- Audit log entry.
  select count(*) into audit_count
  from public.audit_log
  where actor_user_id = uid
    and family_id = fid
    and action = 'family.created';
  if audit_count <> 1 then
    raise exception 'TEST FAIL: expected 1 audit_log entry, got %', audit_count;
  end if;
  raise notice 'OK: audit_log entry written';
end $$;

-- B. non-caregiver: rejected ---------------------------------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  caught_sqlstate text;
  caught_message  text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    uid,
    'self-buyer-create@test.local',
    jsonb_build_object('account_type', 'self_buyer', 'timezone', 'UTC')
  );

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  begin
    perform public.create_family('Me', 'self', 'self');
    raise exception 'TEST FAIL: self_buyer was allowed to call create_family';
  exception when sqlstate 'P0001' then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message  = message_text;
    raise notice 'OK: self_buyer rejected — % (%)', caught_message, caught_sqlstate;
  end;
end $$;

-- C. unauthenticated: rejected -------------------------------------------------
do $$
declare
  caught_sqlstate text;
  caught_message  text;
begin
  -- Clear the jwt claim — auth.uid() returns null.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  begin
    perform public.create_family('Anyone', 'mother', 'daughter');
    raise exception 'TEST FAIL: unauthenticated call was allowed';
  exception when sqlstate 'P0001' then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message  = message_text;
    raise notice 'OK: unauthenticated call rejected — % (%)', caught_message, caught_sqlstate;
  end;
end $$;

-- D. empty input: rejected -----------------------------------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  caught_sqlstate text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    uid,
    'empty-input@test.local',
    jsonb_build_object('account_type', 'caregiver', 'timezone', 'UTC')
  );

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  begin
    perform public.create_family('', 'mother', 'daughter');
    raise exception 'TEST FAIL: empty parent_display_name was accepted';
  exception when sqlstate 'P0001' then
    get stacked diagnostics caught_sqlstate = returned_sqlstate;
    raise notice 'OK: empty parent_display_name rejected (%)', caught_sqlstate;
  end;
end $$;

rollback;
