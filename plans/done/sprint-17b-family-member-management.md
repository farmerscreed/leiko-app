# Sprint 17b — Family Member Management

## Goal

Give the data owner full control over **who has access** to their
family circle. Today the DB supports membership removal (soft-delete
`family_members.removed_at`) and the RLS policies gate it correctly —
but the client has no UI to invoke either of the two flows:

1. **Owner removes a caregiver** ("owner edits members" RLS)
2. **A caregiver leaves the circle themselves** ("self-leave" RLS)

And when a caregiver IS removed, today they have no signal — their
constellation just empties on the next refetch. The founder rightly
flagged that this would read as a bug, not as a deliberate action.

This sprint closes both gaps: a confirmation flow on the Family
Members screen for both actions, a push notification to the removed
caregiver, and an in-app fallback banner when the family list
shrinks unexpectedly.

## Hard dependencies

- Sprint 16.6 caregiver-flow polish + invite-code UX
- Sprint 15 push infrastructure (`send-push` Edge Function +
  notification-templates)
- Sprint 17a per-person dashboard (caregiver surface that the
  removal-detection banner mounts on)

## Docs to load

- `docs/05-voice-and-claims.md` — every new user-visible string
- `docs/10-anomaly-logic.md` §4 (title patterns: "Worth a look",
  sentence-case, ≤120 chars iOS / 180 Android)
- `docs/11-push-notifications.md` §1 (push category structure)
- `memory/sprint_15_close_out.md` — push infra context

## Approved decisions (founder, 2026-05-20)

1. **Block owner self-removal.** The family_owner cannot remove
   themselves; the only path to "delete my family" is the existing
   /delete-account flow. The Family Members row for the owner
   renders no action sheet.
2. **Removed caregivers are notified, never silently revoked.**
   Two-signal pattern (push + in-app banner) so the change never
   reads as a bug. Push is primary; banner is the safety net for
   users without push permission.
3. **Add a link from Family Members → CaregiverVisibility.** A row
   at the bottom of the Family Members screen reads "Manage what
   each caregiver sees →". Discoverability polish; the two screens
   are logical neighbours.
4. **Confirmation copy** (voice-clean):
   - Owner remove: "Remove {Name}? They won't see your readings
     anymore. You can invite them back any time."
   - Self-leave: "Leave {Owner}'s circle? You won't see their
     readings anymore. They can invite you back any time."
5. **Audit log entries** for both actions, no PHI in metadata.

## Architecture

### Server (one Edge Function extension, no migrations)

`send-push` Edge Function gains a new `family_removed` push category:

- New payload subtype with `removerName` and `circleLabel` strings.
- New `renderFamilyMemberRemoved` template in
  `_shared/notification-templates.ts`. Caregiver / self_buyer
  variants; same calm framing.
- Voice-lint passes on the rendered output.
- Same opt-out / quiet-hours / rate-limit pipeline as every other
  push category — recipients with all-family-pushes-off won't get
  it. (The in-app banner is the safety net.)

No new RLS, no new tables, no new migrations. The audit_log entries
piggyback on the existing `service inserts` policy.

### Client

| Layer | New / modified | Notes |
|---|---|---|
| `services/families/manageMembers.ts` | new | `removeMember(familyId, userId)` + `leaveFamily(familyId)`. Each soft-deletes the membership, writes audit_log, fires send-push (remove case only). |
| `screens/FamilyMembers/FamilyMembersScreen.tsx` | modified | Pressable rows → BottomSheet confirmation. Role-aware action selection. Adds "Manage what each caregiver sees →" link at the bottom. |
| `hooks/useFamilyRemovalBanner.ts` | new | Diff MMKV-stored last-known family_ids on every refetch. Returns banner state when a family disappeared. One-shot per disappearance. |
| `screens/Home/CaregiverHome.tsx` | modified | Mount the removal banner. |
| `screens/Home/SelfBuyerHome.tsx` | modified | Mount the removal banner. |
| `services/storage.ts` | modified | Add `lastKnownFamilyIds` storage key. |

### Role × Target matrix

The Family Members row tap dispatcher:

| Viewer role | Target role | Tap behaviour |
|---|---|---|
| family_owner | family_owner (self) | No sheet — row shows "(you, family owner)" label only |
| family_owner | caregiver | "Remove from circle" confirmation sheet |
| caregiver | family_owner | No sheet — row is informational |
| caregiver | self (caregiver) | "Leave this circle" confirmation sheet |
| caregiver | other caregiver | No sheet — caregivers can't remove each other |

The RLS policies on `family_members` already enforce these rules
server-side; the UI just maps to the right call (or no call).

## Deliverables

### 17b.A — Sprint card

This file.

### 17b.B — `services/families/manageMembers.ts`

```ts
export async function removeMember(
  familyId: string,
  targetUserId: string,
  client?: SupabaseClient<Database>,
): Promise<void>;

export async function leaveFamily(
  familyId: string,
  client?: SupabaseClient<Database>,
): Promise<void>;
```

Each soft-deletes via supabase-js (`family_members.update({ removed_at: now, removed_reason: 'owner_removed' | 'self_leave' })`), writes audit_log, and (for `removeMember`) calls send-push with the new category. Errors propagate so the UI can show a calm retry copy.

### 17b.C — FamilyMembersScreen extension

- Make each `ListRow` Pressable (existing `onPress` slot).
- Tap dispatches via the role × target matrix above.
- BottomSheet confirmation modal with the copy from approved
  decision §4. Destructive button is brand state-urgent ramped to
  one-tap acknowledgement.
- New "Manage what each caregiver sees →" row at the bottom, navigates to `CaregiverVisibility`.
- Voice-lint passes; testIDs preserved.

### 17b.D — `useFamilyRemovalBanner` + mount on home screens

- Hook reads `STORAGE_KEYS.lastKnownFamilyIds` from MMKV.
- On every `useFamilyReadings` refetch, computes the diff between
  the new family_ids set and the persisted set.
- If any family_id disappeared, returns a `{ visible: true, label }` banner state with a `dismiss()` to clear the one-shot.
- On dismiss (or on banner mount), writes the new family_ids set
  back to MMKV.
- New `FamilyRemovalBanner` component mounts on `CaregiverHome` +
  `SelfBuyerHome`. Calm informational copy: "You're no longer in
  {label}'s circle." plus a soft CTA "Have a new invite code?" that
  opens the existing `AcceptInviteSheet`.

### 17b.E — Tests + voice-lint sweep

- Unit tests for `manageMembers` (mocked client + mocked send-push).
- Unit test for `useFamilyRemovalBanner` diff logic.
- Voice-lint on every new authored string: confirmation modal copy,
  push title + body, banner label.

## Acceptance criteria

1. Tapping a caregiver row on Family Members opens a confirmation
   sheet appropriate for the viewer's role.
2. Confirming "Remove" soft-deletes the row, removes the caregiver's
   RLS access immediately, fires the push, writes the audit row.
3. The removed caregiver receives the push (when notification
   permission is granted). When push is suppressed for any reason
   (opt-out, quiet hours, no token), the in-app banner surfaces on
   next foreground.
4. Self-leave path works the same way without the push step.
5. The family_owner's own row never opens an action sheet.
6. "Manage what each caregiver sees →" link navigates to
   `CaregiverVisibility`.
7. `tsc --noEmit` + `npm run lint` + `jest` (new + existing) all pass.
8. Voice-lint clean on every new string.

## Out of scope (explicit deferrals)

- **Disband-family flow** — the only "delete the whole family"
  path stays /delete-account. Disbanding without account deletion
  is rare and not in v1.
- **Ownership transfer** — out of v1.
- **AuditLog screen UX touch-up** — the removal entries will
  appear in the existing AuditLog screen unchanged; no rework.
- **Cooldown / undo** — once confirmed, removal is immediate. No
  undo. Re-invite still works (the upsert in `accept-family-invite`
  resurrects `removed_at` to null).
- **Dedicated re-invite affordance** on the in-app banner — for
  v1 the existing "I have an invite code" empty-state CTA covers it.

## Open prompt for next session

Sprint 17b — Family Member Management. The DB is already capable of
all three operations (owner-remove, self-leave, member-list); this
sprint adds the client + the notification path. Start with the
send-push extension (server) then move to client. Read
`docs/11-push-notifications.md` §1 + `memory/sprint_15_close_out.md`
before extending send-push.
