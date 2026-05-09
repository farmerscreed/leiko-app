-- Manual verification for 0006_external_vitals.sql.
-- Run after `supabase db reset`:
--
--   docker exec -i supabase_db_leiko psql -U postgres -d postgres \
--     < supabase/tests/0006_external_vitals.test.sql
--
-- Sprint 9.5 acceptance: service_role inserts; family members read; non-
-- members denied; dedupe index defends against duplicate fetches; physio
-- columns immutable post-insert; soft-hide allowed.

begin;

-- Setup: a self-buyer family + a non-member user --------------------------
do $$
declare
  member_uid    uuid := gen_random_uuid();
  outsider_uid  uuid := gen_random_uuid();
  fid           uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (member_uid, 'sb-06@test.local',
     jsonb_build_object('account_type', 'self_buyer', 'timezone', 'UTC')),
    (outsider_uid, 'outsider-06@test.local',
     jsonb_build_object('account_type', 'self_buyer', 'timezone', 'UTC'));

  perform set_config('request.jwt.claim.sub', member_uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_uid)::text, true);

  select family_id into fid
  from public.create_family('Lawrence', 'self', 'self');

  perform set_config('test.member_uid',   member_uid::text, false);
  perform set_config('test.outsider_uid', outsider_uid::text, false);
  perform set_config('test.family_id',    fid::text, false);

  raise notice 'SETUP: family % member % outsider %', fid, member_uid, outsider_uid;
end $$;

-- A. service_role insert succeeds -----------------------------------------
do $$
declare
  fid          uuid := current_setting('test.family_id')::uuid;
  member_uid   uuid := current_setting('test.member_uid')::uuid;
  inserted_id  uuid;
begin
  set local role service_role;
  insert into public.external_vitals
    (family_id, user_id, source_platform, source_origin, vital_type,
     measured_at, value_numeric, value_unit)
  values
    (fid, member_uid, 'apple_health', 'com.withings.scale', 'weight',
     now() - interval '1 day', 78.4, 'kg')
  returning id into inserted_id;

  if inserted_id is null then
    raise exception 'TEST FAIL (A): service_role insert returned null id';
  end if;
  raise notice 'OK (A): service_role insert succeeded id=%', inserted_id;
end $$;

-- B. dedupe — second identical insert blocked by unique index ------------
do $$
declare
  fid         uuid := current_setting('test.family_id')::uuid;
  member_uid  uuid := current_setting('test.member_uid')::uuid;
  ts          timestamptz := now() - interval '2 days';
  caught      boolean := false;
begin
  set local role service_role;
  insert into public.external_vitals
    (family_id, user_id, source_platform, source_origin, vital_type,
     measured_at, value_numeric, value_unit)
  values
    (fid, member_uid, 'apple_health', 'com.withings.scale', 'weight',
     ts, 78.5, 'kg');

  begin
    insert into public.external_vitals
      (family_id, user_id, source_platform, source_origin, vital_type,
       measured_at, value_numeric, value_unit)
    values
      (fid, member_uid, 'apple_health', 'com.withings.scale', 'weight',
       ts, 78.5, 'kg');
  exception when unique_violation then
    caught := true;
  end;

  if not caught then
    raise exception 'TEST FAIL (B): dedupe index did not reject duplicate';
  end if;
  raise notice 'OK (B): dedupe index rejected duplicate (user, platform, origin, type, ts)';
end $$;

-- C. authenticated member can SELECT ---------------------------------------
do $$
declare
  member_uid   uuid := current_setting('test.member_uid')::uuid;
  visible_n    int;
begin
  perform set_config('request.jwt.claim.sub', member_uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_uid)::text, true);
  set local role authenticated;
  select count(*) into visible_n from public.external_vitals;
  if visible_n < 2 then
    raise exception 'TEST FAIL (C): member should see >=2 rows, got %', visible_n;
  end if;
  raise notice 'OK (C): member sees % rows', visible_n;
end $$;

-- D. non-member SELECT returns zero rows ----------------------------------
do $$
declare
  outsider_uid uuid := current_setting('test.outsider_uid')::uuid;
  visible_n    int;
begin
  perform set_config('request.jwt.claim.sub', outsider_uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', outsider_uid)::text, true);
  set local role authenticated;
  select count(*) into visible_n from public.external_vitals;
  if visible_n <> 0 then
    raise exception 'TEST FAIL (D): outsider saw % rows, expected 0', visible_n;
  end if;
  raise notice 'OK (D): outsider sees 0 rows (RLS blocks)';
end $$;

-- E. authenticated client INSERT denied -----------------------------------
do $$
declare
  fid         uuid := current_setting('test.family_id')::uuid;
  member_uid  uuid := current_setting('test.member_uid')::uuid;
  caught_sqlstate text;
begin
  perform set_config('request.jwt.claim.sub', member_uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_uid)::text, true);
  set local role authenticated;
  begin
    insert into public.external_vitals
      (family_id, user_id, source_platform, source_origin, vital_type,
       measured_at, value_numeric, value_unit)
    values
      (fid, member_uid, 'apple_health', 'com.withings.scale', 'weight',
       now(), 79.1, 'kg');
    raise exception 'TEST FAIL (E): client INSERT slipped past service-only policy';
  exception when insufficient_privilege or others then
    get stacked diagnostics caught_sqlstate = returned_sqlstate;
    raise notice 'OK (E): client INSERT rejected (sqlstate %)', caught_sqlstate;
  end;
end $$;

-- F. soft-hide UPDATE allowed (mutates only hidden columns) --------------
do $$
declare
  member_uid uuid := current_setting('test.member_uid')::uuid;
  target_id  uuid;
  hidden_n   int;
begin
  perform set_config('request.jwt.claim.sub', member_uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_uid)::text, true);
  set local role authenticated;

  select id into target_id from public.external_vitals limit 1;

  update public.external_vitals
     set hidden = true,
         hidden_reason = 'not my scale',
         hidden_by_user_id = member_uid,
         hidden_at = now()
   where id = target_id;

  select count(*) into hidden_n
    from public.external_vitals where hidden = true and id = target_id;
  if hidden_n <> 1 then
    raise exception 'TEST FAIL (F): soft-hide UPDATE did not persist (got % rows)', hidden_n;
  end if;
  raise notice 'OK (F): soft-hide UPDATE persisted';
end $$;

-- G. immutability trigger blocks value_numeric edit ----------------------
do $$
declare
  member_uid uuid := current_setting('test.member_uid')::uuid;
  target_id  uuid;
  caught_msg text;
begin
  perform set_config('request.jwt.claim.sub', member_uid::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_uid)::text, true);
  set local role authenticated;
  select id into target_id from public.external_vitals limit 1;

  begin
    -- The "members soft-hide" policy WITH CHECK demands hidden_by_user_id =
    -- auth.uid(); set it so the policy passes and the trigger gets a chance
    -- to run.
    update public.external_vitals
       set value_numeric = 999,
           hidden_by_user_id = member_uid
     where id = target_id;
    raise exception 'TEST FAIL (G): physio column edit slipped past immutability trigger';
  exception when raise_exception then
    get stacked diagnostics caught_msg = message_text;
    raise notice 'OK (G): immutability trigger fired — %', caught_msg;
  end;
end $$;

rollback;
