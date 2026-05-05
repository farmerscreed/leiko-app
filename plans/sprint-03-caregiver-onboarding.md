# Sprint 3 — Caregiver Onboarding

## Goal
The caregiver-flavoured onboarding flow per D8 §4.2: profile setup, parent profile creation, family-circle context, "let's get the watch on" handoff to Sprint 5 pairing.

## Duration
~1 work-week.

## Hard dependencies
Sprint 2.

## Docs to load
docs/04-screens/caregiver-onboarding.md, docs/02-design-tokens.md, docs/05-voice-and-claims.md, docs/01-data-model.md (§ users, families, family_members).

## Deliverables
- apps/mobile/src/screens/Onboarding/Caregiver/Welcome.tsx
- Profile.tsx — the caregiver's own info
- AddParent.tsx — first parent profile
- Permissions.tsx — push notifications, BLE permissions
- Migration if needed: families table + family_members table per docs/01-data-model.md

## Acceptance criteria
- Onboarding flows from fork screen through to a "ready to pair the watch" screen
- Caregiver profile is saved to `public.users`; family record created; family_member row created with `family_owner` role
- Skipping AddParent is supported (caregiver can pair watch first, add parent later)
- All copy uses caregiver voice (third-person about parent, "your Mum", etc.)

## Open prompt
Sprint 3 — Caregiver Onboarding. Read CLAUDE.md, then docs/04-screens/caregiver-onboarding.md, docs/01-data-model.md, docs/05-voice-and-claims.md.

Propose:

1. Screen sequence and navigation pattern (stack? tabs? wizard?)
2. Where the parent profile is stored (families.parent_* fields per docs/01-data-model.md vs separate rows)
3. Permissions handling — do we ask up front or just-in-time?
4. Skip-add-parent path: confirm the spec allows it

Wait for approval.
