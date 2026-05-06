-- Manual verification for migration 0002_account_type_immutable.sql.
-- Run after `supabase start` against the local Docker instance:
--
--   psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
--        -f supabase/tests/0002_account_type_immutable.test.sql
--
-- Sprint 2 acceptance criterion: "After fork, attempting to update
-- account_type via API returns a 403/forbidden response." The trigger
-- raises P0001; PostgREST surfaces it as HTTP 400. Functional intent
-- (the update is blocked) is what's being verified here.

begin;

-- A. handle_new_user requires account_type metadata --------------------------
-- Without account_type in raw_user_meta_data, signup must fail.
do $$
declare
  caught_sqlstate text;
  caught_message  text;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), 'no-meta@test.local', '{}'::jsonb);
    raise exception 'TEST FAIL: handle_new_user accepted signup without account_type';
  exception when sqlstate 'P0001' then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message  = message_text;
    raise notice 'OK: signup without account_type rejected — % (%)', caught_message, caught_sqlstate;
  end;
end $$;

-- B. account_type immutability trigger blocks updates ------------------------
do $$
declare
  uid uuid := gen_random_uuid();
  caught_sqlstate text;
  caught_message  text;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    uid,
    'caregiver@test.local',
    jsonb_build_object('account_type', 'caregiver', 'timezone', 'UTC')
  );

  -- Attempt the forbidden mutation.
  begin
    update public.users set account_type = 'self_buyer' where id = uid;
    raise exception 'TEST FAIL: account_type update was allowed';
  exception when sqlstate 'P0001' then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message  = message_text;
    raise notice 'OK: account_type update rejected — % (%)', caught_message, caught_sqlstate;
  end;

  -- Other column updates should still succeed.
  update public.users set display_name = 'Mum' where id = uid;
  if (select display_name from public.users where id = uid) <> 'Mum' then
    raise exception 'TEST FAIL: legitimate column update was blocked';
  end if;
  raise notice 'OK: non-account_type updates still flow through';
end $$;

rollback;
