-- Manual verification for migration 0028_create_family_self_idempotent.sql.
-- Run after `supabase start`:
--
--   psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
--        -f supabase/tests/0028_create_family_self_idempotent.test.sql
--
-- ADR-0006 Phase 1, Task 2 acceptance: create_family is idempotent for a
-- self_buyer's own circle. Repeated calls return the SAME family_id and
-- never mint a duplicate self-circle. The caregiver path is unaffected
-- (it may create multiple distinct circles).

begin;

-- A. self_buyer: two calls return the SAME family, only ONE circle exists -------
do $$
declare
  uid  uuid := gen_random_uuid();
  fid1 uuid;
  fid2 uuid;
  self_circle_count int;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    uid,
    'self-idem@test.local',
    jsonb_build_object('account_type', 'self_buyer', 'timezone', 'UTC')
  );
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  select family_id into fid1 from public.create_family('Lawrence', 'self', 'self');
  select family_id into fid2 from public.create_family('Lawrence', 'self', 'self');

  if fid1 is null or fid2 is null then
    raise exception 'TEST FAIL: create_family returned null family_id';
  end if;
  if fid1 <> fid2 then
    raise exception 'TEST FAIL: second self call returned a DIFFERENT family (% vs %)', fid1, fid2;
  end if;

  -- Exactly one self-circle owned by this user.
  select count(*) into self_circle_count
  from public.families f
  join public.family_members fm
    on fm.family_id = f.id and fm.user_id = uid and fm.role = 'family_owner'
   and fm.removed_at is null
  where f.parent_user_id = uid;

  if self_circle_count <> 1 then
    raise exception 'TEST FAIL: expected 1 self-circle, found %', self_circle_count;
  end if;

  raise notice 'OK: self_buyer create_family is idempotent (1 circle, same id twice)';
end $$;

-- B. caregiver: still creates DISTINCT circles per call (guard is self-only) ----
do $$
declare
  uid  uuid := gen_random_uuid();
  fid1 uuid;
  fid2 uuid;
  circle_count int;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    uid,
    'cg-multi@test.local',
    jsonb_build_object('account_type', 'caregiver', 'timezone', 'UTC')
  );
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  select family_id into fid1 from public.create_family('Mum', 'mother', 'daughter');
  select family_id into fid2 from public.create_family('Dad', 'father', 'daughter');

  if fid1 = fid2 then
    raise exception 'TEST FAIL: caregiver calls collapsed to one circle — guard leaked to caregiver path';
  end if;

  select count(*) into circle_count
  from public.family_members
  where user_id = uid and role = 'family_owner' and removed_at is null;

  if circle_count <> 2 then
    raise exception 'TEST FAIL: caregiver expected 2 circles, found %', circle_count;
  end if;

  raise notice 'OK: caregiver path still creates distinct circles (Mum + Dad)';
end $$;

-- C. self_buyer who soft-LEFT their circle gets a NEW one (removed_at respected)-
do $$
declare
  uid  uuid := gen_random_uuid();
  fid1 uuid;
  fid2 uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    uid,
    'self-left@test.local',
    jsonb_build_object('account_type', 'self_buyer', 'timezone', 'UTC')
  );
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, true);

  select family_id into fid1 from public.create_family('Lawrence', 'self', 'self');

  -- Soft-remove the membership; the guard must NOT match a removed circle.
  update public.family_members
  set removed_at = now()
  where family_id = fid1 and user_id = uid;

  select family_id into fid2 from public.create_family('Lawrence', 'self', 'self');

  if fid2 = fid1 then
    raise exception 'TEST FAIL: guard matched a soft-removed circle';
  end if;

  raise notice 'OK: soft-removed self-circle is not reused (new circle created)';
end $$;

rollback;
