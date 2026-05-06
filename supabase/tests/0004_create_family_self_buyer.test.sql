-- Manual verification for 0004_create_family_self_buyer.sql.
-- Run after `supabase migration up`:
--
--   docker exec -i supabase_db_leiko psql -U postgres -d postgres \
--     < supabase/tests/0004_create_family_self_buyer.test.sql
--
-- Sprint 4 acceptance: create_family handles caregiver (regression) and
-- self_buyer paths atomically. parent account_type is rejected.

begin;

-- A. caregiver regression — no behavioural change ----------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  fid uuid;
  member_count int;
  family_parent_uid uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (uid, 'caregiver-04@test.local',
    jsonb_build_object('account_type', 'caregiver', 'timezone', 'UTC'));

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  select family_id into fid
  from public.create_family('Mama Linda', 'mother', 'daughter');

  if fid is null then raise exception 'TEST FAIL: caregiver returned null'; end if;

  select parent_user_id into family_parent_uid from public.families where id = fid;
  if family_parent_uid is not null then
    raise exception 'TEST FAIL: caregiver path set parent_user_id (got %)', family_parent_uid;
  end if;
  raise notice 'OK: caregiver path leaves parent_user_id null';

  select count(*) into member_count from public.family_members
  where family_id = fid and user_id = uid and role = 'family_owner';
  if member_count <> 1 then
    raise exception 'TEST FAIL: caregiver expected 1 family_owner, got %', member_count;
  end if;
  raise notice 'OK: caregiver got exactly 1 family_owner row';

  if not exists (
    select 1 from public.audit_log
    where family_id = fid and action = 'family.created'
      and metadata->>'path' = 'caregiver'
  ) then
    raise exception 'TEST FAIL: caregiver audit metadata missing path=caregiver';
  end if;
  raise notice 'OK: caregiver audit_log path=caregiver';
end $$;

-- B. self_buyer happy path ---------------------------------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  fid uuid;
  family_parent_uid uuid;
  parent_owner_count int;
  family_owner_count int;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (uid, 'self-buyer-04@test.local',
    jsonb_build_object('account_type', 'self_buyer', 'timezone', 'UTC'));

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  select family_id into fid
  from public.create_family('Lawrence', 'self', 'self');

  if fid is null then raise exception 'TEST FAIL: self_buyer returned null'; end if;

  -- parent_user_id MUST be the caller (self-buyer is the wearer).
  select parent_user_id into family_parent_uid from public.families where id = fid;
  if family_parent_uid is null or family_parent_uid <> uid then
    raise exception 'TEST FAIL: self_buyer parent_user_id must equal caller (got %)', family_parent_uid;
  end if;
  raise notice 'OK: self_buyer parent_user_id = caller';

  -- Exactly one family_member row, role=family_owner.
  select count(*) into family_owner_count
  from public.family_members
  where family_id = fid and user_id = uid and role = 'family_owner';
  if family_owner_count <> 1 then
    raise exception 'TEST FAIL: self_buyer expected 1 family_owner, got %', family_owner_count;
  end if;

  -- Zero parent_owner rows (the schema-vs-doc resolution: no separate row).
  select count(*) into parent_owner_count
  from public.family_members
  where family_id = fid and role = 'parent_owner';
  if parent_owner_count <> 0 then
    raise exception 'TEST FAIL: self_buyer should have 0 parent_owner rows, got %', parent_owner_count;
  end if;
  raise notice 'OK: self_buyer has 1 family_owner, 0 parent_owner rows';

  -- Audit metadata
  if not exists (
    select 1 from public.audit_log
    where family_id = fid and action = 'family.created'
      and metadata->>'path' = 'self_buyer'
  ) then
    raise exception 'TEST FAIL: self_buyer audit metadata missing path=self_buyer';
  end if;
  raise notice 'OK: self_buyer audit_log path=self_buyer';
end $$;

-- C. parent account_type — rejected ------------------------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  caught_sqlstate text;
  caught_message  text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (uid, 'parent-04@test.local',
    jsonb_build_object('account_type', 'parent', 'timezone', 'UTC'));

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  begin
    perform public.create_family('Anyone', 'self', 'self');
    raise exception 'TEST FAIL: parent account_type was allowed';
  exception when sqlstate 'P0001' then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message  = message_text;
    raise notice 'OK: parent account_type rejected — % (%)', caught_message, caught_sqlstate;
  end;
end $$;

-- D. unauthenticated — still rejected ----------------------------------------
do $$
declare caught_sqlstate text;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  begin
    perform public.create_family('Lawrence', 'self', 'self');
    raise exception 'TEST FAIL: unauthenticated call was allowed';
  exception when sqlstate 'P0001' then
    get stacked diagnostics caught_sqlstate = returned_sqlstate;
    raise notice 'OK: unauthenticated call rejected (%)', caught_sqlstate;
  end;
end $$;

-- E. self_buyer with empty input — rejected ----------------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  caught_sqlstate text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (uid, 'self-buyer-empty-04@test.local',
    jsonb_build_object('account_type', 'self_buyer', 'timezone', 'UTC'));

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  begin
    perform public.create_family('', 'self', 'self');
    raise exception 'TEST FAIL: self_buyer with empty name was accepted';
  exception when sqlstate 'P0001' then
    get stacked diagnostics caught_sqlstate = returned_sqlstate;
    raise notice 'OK: self_buyer empty name rejected (%)', caught_sqlstate;
  end;
end $$;

rollback;
