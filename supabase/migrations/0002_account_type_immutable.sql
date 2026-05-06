-- 0002_account_type_immutable.sql — Sprint 2.
-- Enforces D8a §1.3 + §14.1: account_type is IMMUTABLE after onboarding.
-- Two concerns:
--   1. The fork-screen choice committed at sign-up must never change. A
--      BEFORE UPDATE trigger raises if account_type changes between OLD and
--      NEW. (CREATE POLICY WITH CHECK can't see OLD/NEW; same constraint
--      that drove readings_immutable_columns_trigger in 0001.)
--   2. handle_new_user previously fell back to account_type='caregiver' when
--      raw_user_meta_data was missing the field — a silent footgun that
--      could land a self-buyer signup in caregiver mode if the client
--      forgot to pass the metadata. This migration tightens it to RAISE.
--
-- Surfaced PostgREST error: HTTP 400 with code 'P0001' (RAISE EXCEPTION).
-- That's intentional — see plans/sprint-02-auth-and-fork.md "open
-- prompt" §3 for the discussion. The acceptance criterion phrased it as
-- "403/forbidden" but the functional requirement is "the update is
-- blocked" and a P0001 satisfies that.

-- 1. account_type immutability trigger ---------------------------------------
create or replace function public.users_account_type_immutable()
returns trigger language plpgsql as $$
begin
  if old.account_type is distinct from new.account_type then
    raise exception 'account_type is immutable (D8a §1.3 + §14.1); switching modes requires support intervention'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger users_account_type_immutable_trigger
  before update on public.users
  for each row execute function public.users_account_type_immutable();

-- 2. handle_new_user — require account_type metadata -------------------------
-- Replaces the version in 0001. No coalesce default: if the client did not
-- pass account_type in raw_user_meta_data (set via supabase.auth.signInWithOtp
-- options.data on the SignUp screen), we refuse the signup rather than
-- guessing. Sprints 3/4 own real display_name / timezone capture; the
-- email-handle placeholder for display_name is fine until then.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  meta_account_type text := new.raw_user_meta_data->>'account_type';
begin
  if meta_account_type is null then
    raise exception 'account_type is required in raw_user_meta_data (set on the fork screen, committed at sign-up)'
      using errcode = 'P0001';
  end if;

  insert into public.users (id, email, display_name, timezone, account_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data->>'timezone', 'UTC'),
    meta_account_type
  );
  return new;
end;
$$;
