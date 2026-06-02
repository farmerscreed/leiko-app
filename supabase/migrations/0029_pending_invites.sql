-- 0029_pending_invites.sql
--
-- ADR-0006 — caregiver-initiated PENDING invites.
--
-- The "+ Add someone I care for" flow lets a caregiver invite a wearer who
-- is NOT yet on Leiko. At creation time the wearer has no circle, so the
-- invite cannot reference a family. This migration makes that possible.
--
-- Semantics (kind = 'parent_pairing'):
--   • invited_by = the caregiver who initiated.
--   • family_id  = NULL until the invite resolves.
--   • The wearer installs Leiko, taps the link, onboards and pairs their
--     own watch (which creates THEIR circle via create_family), and the
--     invite resolves: the caregiver (invited_by) is attached as a
--     'caregiver' member of the wearer's new circle, and family_id is
--     stamped onto the invite.
--
-- This inverts the normal 'caregiver' invite (where a caregiver accepts a
-- code to join an existing circle). A circle is still NEVER pre-created
-- for the invitee — it is born from the wearer pairing their own watch,
-- keeping the "wrong wearer stamped on a circle" bug class dead.

-- 1) family_id becomes nullable. Existing 'caregiver' invites always set
--    it; only 'parent_pairing' (pending) invites leave it null until
--    resolution. A CHECK enforces that invariant so a caregiver invite
--    can never be created without a circle.
alter table public.invitations
  alter column family_id drop not null;

alter table public.invitations
  add constraint invitations_family_id_required_for_caregiver
  check (kind <> 'caregiver' or family_id is not null);

-- 2) Fast lookup of an active pending invite by its inviter (for the
--    caregiver's "pending invites" list + dedupe) and by code/token at
--    resolution time (pairing_code + url_token are already unique).
create index if not exists invitations_pending_by_inviter
  on public.invitations (invited_by)
  where kind = 'parent_pairing'
    and family_id is null
    and accepted_at is null
    and cancelled_at is null;

-- 3) RLS. The existing policies key on is_family_owner(family_id), which
--    is null/false for a pending invite — so the inviter could neither
--    create, read, nor cancel one. Add inviter-scoped policies for the
--    pending (family_id IS NULL) case. The edge functions run as
--    service_role and bypass RLS, but these keep the table sane for any
--    direct client access and document intent.

-- Inviter can read their own pending invites.
create policy "inviter reads own pending invites" on public.invitations
  for select using (
    kind = 'parent_pairing'
    and family_id is null
    and invited_by = auth.uid()
  );

-- Inviter can create a pending invite (no circle yet) for themselves.
create policy "inviter creates pending invites" on public.invitations
  for insert with check (
    kind = 'parent_pairing'
    and family_id is null
    and invited_by = auth.uid()
  );

-- Inviter can cancel their own pending invite.
create policy "inviter cancels pending invites" on public.invitations
  for update using (
    kind = 'parent_pairing'
    and invited_by = auth.uid()
  );
