# Sprint 4 — Self-Buyer Onboarding

## Goal
The self-buyer onboarding per D8a §3–4: a simpler two-screen flow ("You" + "Watch"), no parent profile, voice in second-person ("your reading").

## Duration
~1 work-week.

## Hard dependencies
Sprint 2.

## Docs to load
docs/04-screens/self-buyer-onboarding.md (which includes D8a amendments), docs/02-design-tokens.md, docs/05-voice-and-claims.md.

## Deliverables
- apps/mobile/src/screens/Onboarding/SelfBuyer/You.tsx — user info
- SelfBuyer/Watch.tsx — handoff to pairing
- Reuses Permissions.tsx from Sprint 3

## Acceptance criteria
- Onboarding flows fork → You → Watch → ready-to-pair
- `public.users` captures the self-buyer info; a single-member `public.families` row is created where the self-buyer holds both `family_owner` and `parent_owner` roles
- Voice is consistently second-person ("your reading", "your watch") throughout
- Voice gate (docs/05-voice-and-claims.md) passes on every string

## Open prompt
Sprint 4 — Self-Buyer Onboarding. Read CLAUDE.md, then docs/04-screens/self-buyer-onboarding.md (note D8a amendments), docs/02-design-tokens.md, docs/05-voice-and-claims.md.

Propose:

1. Reuse strategy from Sprint 3 components
2. The "You" screen field set (per D8a §4)
3. How the post-Watch screen routes (it should land on the same ready-to-pair handoff as caregiver flow)

Wait for approval.
