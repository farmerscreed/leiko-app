# Comprehensive Test — ADR-0006 unified model

Clean-slate end-to-end test of the whole build (Phases 1–4 + both invite
directions). Run after the 2026-06 DB reset (only `lawonecloud@gmail.com`
remains, with 87 BP / 5427 vitals, one active U19M device `5a2a24f5`).

## Devices & accounts

| Phone | Account | Watch | Role exercised |
| --- | --- | --- | --- |
| **1** | `lawonecloud@gmail.com` (Lawrence, existing data) | U19M (MAC …32:7B) | wearer **and** caregiver — the "both" view |
| **2** | NEW `lawonecloud+mum@gmail.com` | the OTHER watch | a person you care for (wearer) |
| **3** | NEW `lawonecloud+watcher@gmail.com` | none | pure caregiver |

`+alias` Gmail addresses all deliver to the one inbox — handy for invite emails.

**Branch / build:** `claude/consolidated-build` (top commit ≥ `fee8683`).
Pull + rebuild on all 3 phones. **Backend is already deployed** (migrations
0027–0029 + edge functions).

---

## Stage 0 — Builds
- [ ] All 3 phones launch the latest build with no white screen.

## Stage 1 — Signup (unified onboarding) · Phones 2 & 3
- [ ] Fresh launch shows **"Welcome to Leiko / Get started"** (single button, not the old fork).
- [ ] Sign up with the alias email → OTP.
- [ ] **Phone 2:** "Do you have a watch?" → **Yes** → pair the other watch.
- [ ] **Phone 3:** → **Not yet / skip** → lands on an (empty) constellation; **no "You" node, no Take-a-reading tab** (pure caregiver).

Checkpoint — each new signup made a self-circle:
```sql
select u.email, u.account_type, f.parent_relationship, f.id as family_id
from public.users u left join public.families f on f.parent_user_id=u.id
where u.email in ('lawonecloud+mum@gmail.com','lawonecloud+watcher@gmail.com');
```

## Stage 2 — Multi-watch routing (Phase 1) · Phones 1 & 2
- [ ] Phone 1 syncs U19M; Phone 2 syncs the other watch.
- [ ] Both Metro logs show `sync_completed`, **no 500**.

Checkpoint — each watch's data is in its OWN circle:
```sql
select f.parent_display_name, d.mac_address,
  d.client_device_id is not null as has_stable_id,
  (select count(*) from public.vitals_other v where v.device_id=d.id) as vitals
from public.devices d join public.families f on f.id=d.family_id
where d.unpaired_at is null order by f.parent_display_name;
```

## Stage 3 — Direction A: wearer invites a follower · Phone 1 → Phone 3
- [ ] **Phone 1** (Lawrence): Settings → **Invite someone to follow** → enter `lawonecloud+watcher@gmail.com` → Send.
- [ ] Code + link appear in the share sheet; the `+watcher` inbox gets the email.
- [ ] **Phone 3:** Settings → Add someone → Care for another person → enter code + email → submit.
- [ ] Phone 3's home now shows **Lawrence as a node** (pure caregiver following Lawrence).

Checkpoint:
```sql
select fm.role, u.email
from public.family_members fm join public.users u on u.id=fm.user_id
where fm.family_id='21b057bb-7aa4-4e47-9185-48afc43d19f6' and fm.removed_at is null;
```
Expect Lawrence (`family_owner`) + the +watcher account (`caregiver`).

## Stage 4 — Direction B: caregiver-initiated PENDING invite
**For the TRUE pending test, do this BEFORE the invitee signs up.** Use a
fresh alias the invitee will use.

- [ ] **Phone 1:** Home → **+ Add someone** → enter `lawonecloud+mum@gmail.com` → Send.
- [ ] Code appears. Checkpoint — pending invite with **no circle**:
```sql
select kind, family_id, pairing_code, invited_by, accepted_at
from public.invitations where kind='parent_pairing' order by created_at desc limit 1;
```
Expect `kind=parent_pairing`, **`family_id` NULL**.

- [ ] **Phone 2** (already signed up + watch paired in Stage 1): Settings → Add someone → Care for another person → type the code → submit.
  - If typed **before** pairing: shows "Set up your own watch first…" (the `no_circle_yet` guard).
- [ ] Resolves: Lawrence becomes a follower of Phone 2.

Checkpoint:
```sql
-- invite resolved + stamped
select kind, family_id, accepted_at, accepted_by
from public.invitations where kind='parent_pairing' order by created_at desc limit 1;
-- Lawrence is now a caregiver of Phone 2's circle
select fm.family_id, fm.role
from public.family_members fm
where fm.user_id='ceef5d2a-faf0-4747-a1d7-802635043b96' and fm.role='caregiver';
```

- [ ] **Phone 1:** refresh → **Phone 2 ("Mum") appears as a node** alongside Lawrence's centered "You". ← the unified "me + someone I care for" view.

## Stage 5 — Visibility controls · Phone 1
- [ ] Settings → **Who sees my readings** → toggle Sleep on for a follower.
- [ ] Toggle persists; BP stays locked on.

## Stage 6 — View-mode default · Phone 1
- [ ] Solo (before adding anyone): defaults to **Detailed (cards)**.
- [ ] With 3+ nodes: defaults to **Bird's-eye**. Manual toggle sticks.

---

## Known limitations (not bugs)
- **Invite LINK → download** does not work: Leiko isn't in the app stores and
  there's no `leiko.app/join` page. Test invites via the **6-digit code**.
  The store listing + join landing page are launch tasks.
- Edge functions / migration 0029 were authored but first executed by this
  test — treat the first real send/accept as their validation.

## If something fails
- Backend error / 500: Supabase → Functions → <name> → Logs → newest entry.
- Routing/data: re-run the relevant checkpoint query and report the rows.
