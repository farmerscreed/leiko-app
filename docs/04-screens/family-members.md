# Screen — Family members

Sourced from D8 §4.11 + D8a §10.2, reshaped by **ADR-0006 §4** (the unified
circle model). The read + manage view for everyone in one circle. Owners
remove members and reach the per-vital visibility editor from here; followers
leave the circle from here.

> **Implementation**: `apps/mobile/src/screens/FamilyMembers/FamilyMembersScreen.tsx`
> (Sprint 10c.2 list, Sprint 17b action sheets). Registered on **both** the
> caregiver and self-buyer stacks in
> `apps/mobile/src/navigation/RootNavigator.tsx` as `FamilyMembers`.

---

## Audience

Both personas — `account_type` is inert here (ADR-0006). What changes the
screen is the viewer's **role inside this circle**, derived at runtime from
`family_members.role`:

- **`family_owner`** (the wearer) — sees a remove action per other member and
  a "Sharing" section linking to per-caregiver visibility.
- **`caregiver`** (a follower) — sees only a "Leave this circle" action on
  their own row; every other row is informational.

The role is computed from the loaded member list (`viewerRole`), not from
`account_type` or a nav param.

## Purpose

- List every active member of one circle: display name, role label, joined month.
- Let the **owner** remove a caregiver (`removeMember` → `manage-family-membership` Edge Function).
- Let a **caregiver** leave the circle (`leaveFamily` → same Edge Function).
- Give the owner a jump-off to per-vital sharing (`CaregiverVisibility`).

---

## When reached

- **Settings → "People you care for" → a circle row** navigates here
  (`SettingsScreen.tsx`, `stackNavigation.navigate('FamilyMembers')`). Each
  followed circle is a row; tapping it opens this screen.
- **Deep link `leiko://family`** routes here
  (`apps/mobile/src/services/notifications/deepLinks.ts` → `navigationRef.navigate('FamilyMembers')`).
- The header comment in the screen still says "Settings → Family → Family
  members"; the live Settings entry is the **"People you care for"** row per
  ADR-0006's section rename. Documented here as a known label drift, not a
  code bug.

The circle shown is `parents[0]?.familyId` from `useFamilyReadings()` — the
screen reads a single `familyId`, so it always renders the first circle in
that hook's list. There is no `familyId` route param; multi-circle selection
is not expressed at this screen yet.

---

## Layout (top to bottom)

| Element | Detail |
| --- | --- |
| Back affordance | Text "Back", `brand.primary`, `accessibilityRole="button"` |
| Header | "Family members" (`displayM`, `accessibilityRole="header"`) |
| Subhead | "Everyone in your circle." (`bodyL`, `text.secondary`) |
| **Members** section | `SettingsSection` of `ListRow`s, one per active member |
| **Sharing** section | *Owner only* — single `navigation` row "Manage what each caregiver sees" → `CaregiverVisibility` |

Each member row:
- **Title**: display name, plus a self suffix — `" (you, family owner)"` for
  the owner's own row, `" (you)"` for a follower's own row.
- **Subtitle**: `"{Role label} · joined {Mon YYYY}"`. Role labels map from
  `FamilyRole`: `family_owner → "Family owner"`, `parent_owner → "Wearer"`,
  `caregiver → "Caregiver"`, `parent_viewer → "Family"`. Joined date is
  device-locale-aware (`toLocaleDateString`, month + year).
- **Variant**: `navigation` (tappable) or `data` (inert) per the role matrix below.

### Role × target tap matrix (`isRowTappable` / `onRowPress`)

| Viewer | Target row | Tappable? | Action |
| --- | --- | --- | --- |
| `family_owner` | own row | No | inert ("(you, family owner)") |
| `family_owner` | a caregiver | Yes | "Remove {name}?" sheet |
| `family_owner` | another owner | No | defensive no-op (shouldn't occur) |
| `caregiver` | own row | Yes | "Leave {owner}'s circle?" sheet |
| `caregiver` | any other row | No | informational |

### Remove sheet (owner)

`BottomSheet`, title "Remove {name}?". Body: *"{name} won't see your readings
anymore. You can invite them back any time."* Destructive "Remove" button +
ghost "Cancel". On confirm → `removeMember({ familyId, targetUserId })`, then
refresh. Server errors map to calm copy: `only_owner_can_remove` → "You don't
have permission to do that."; `target_not_active_member` → "That person is
already out of the circle."; otherwise "We couldn't remove them. Try again in
a moment."

### Leave sheet (caregiver)

`BottomSheet`, title "Leave {owner}'s circle?". Body: *"You won't see {owner}'s
readings anymore. They can invite you back any time."* Destructive "Leave" +
ghost "Cancel". On confirm → `leaveFamily({ familyId })`, then
`navigation.goBack()` (the screen no longer makes sense; the caregiver lands
back on home). Error map: `owner_cannot_leave` → "Family owners can't leave
their own circle."; otherwise "We couldn't leave the circle. Try again in a
moment."

---

## States

| State | What renders (`testID`) |
| --- | --- |
| `loading` | "Loading…" (`family-members-loading`) while `members === null` |
| `error` | "We couldn't load your family list. Pull down to retry." (`family-members-error`) |
| `empty` | "No one here yet. Invite someone from Settings → Family." (`family-members-empty`) — shown when the list loads to length 0, including when there is no `familyId` |
| `default` | Members section (+ Sharing section for owners) |
| `action pending` | Confirm button shows spinner (`actionPending`); sheet dismissal is blocked until it resolves |

The empty state is also the **no-circle** state: when `familyId` is null,
`refresh()` sets members to `[]`, so a viewer with no circle sees the empty
copy rather than a spinner.

---

## Relationship to settings.md + ADR-0006

- ADR-0006 §4 collapses the old multi-section Family surface to two role-aware
  Settings sections. This screen is the **follower-list detail** behind the
  "People you care for" rows. The owner's reciprocal surface ("Following your
  readings") lives in Settings itself and links to `CaregiverVisibility`
  (see `caregiver-visibility.md`), **not** through this screen — only the
  owner-viewing-their-own-circle path here exposes the Sharing link.
- `settings.md` documents the legacy "Family section lands in 10c" note; this
  screen is that delivery, now reshaped by ADR-0006. The "remove / leave"
  semantics (one wearer per circle, wearer holds visibility) are the ADR's
  invariant made tappable.
- Server authority: removal/leave validation lives in the
  `manage-family-membership` Edge Function; the client never edits membership
  directly (audit-log writes need service role). See
  `apps/mobile/src/services/families/manageMembers.ts`.

---

## Voice

Per `docs/05-voice-and-claims.md`:
- No "patient", no fear language. Destructive copy explains the consequence
  ("won't see your readings anymore") and offers a reversible path ("invite
  them back any time") — dignified cancellation.
- Sheets keep a "Cancel" escape on every destructive action.
- Error copy names a calm cause + a retry, never a code or stack trace.

---

## Accessibility

- Header carries `accessibilityRole="header"`; Back is `accessibilityRole="button"`.
- Destructive sheet buttons carry explicit labels ("Remove {name}", "Leave this circle", "Cancel").
- Tappable rows render as `navigation` variant; inert rows as `data` so the
  screen reader does not announce them as actionable.
