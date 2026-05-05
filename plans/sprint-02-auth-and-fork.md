# Sprint 2 — Auth + Fork Screen

## Goal
Email-based auth via Supabase (passwordless OTP), and the `account_type` fork screen that branches caregiver vs self-buyer. `account_type` becomes immutable after this point per D8a §14.1.

## Duration
~1 work-week.

## Hard dependencies
Sprint 1.

## Docs to load
docs/04-screens/onboarding-fork.md, docs/01-data-model.md (§ users table), docs/05-voice-and-claims.md, docs/00-tech-stack.md (§ Compliance).

## Deliverables
- Supabase Auth configured for passwordless email OTP
- apps/mobile/src/screens/Auth/SignIn.tsx, SignUp.tsx, OTPVerify.tsx
- apps/mobile/src/screens/Onboarding/AccountTypeFork.tsx (D6 US-1, D8a §3)
- apps/mobile/src/services/supabase.ts — typed client
- apps/mobile/src/state/auth.ts — Zustand auth store
- Migration: `users.account_type` CHECK constraint enum `['caregiver', 'self_buyer', 'parent']`

## Acceptance criteria
- User can sign up with email, receive OTP, verify, and reach the fork screen
- Selecting "I'm caring for someone" sets `account_type='caregiver'` in users table
- Selecting "It's for me" sets `account_type='self_buyer'`
- After fork, attempting to update `account_type` via API returns a 403/forbidden response
- Sign-in returns the correct account_type and routes to the correct onboarding (placeholder for sprints 3, 4)
- Voice: every string passes the `docs/05-voice-and-claims.md` gate

## Test plan
- Integration test: sign-up → OTP → fork → confirm account_type set
- Integration test: attempt to update account_type after fork → fails
- Component test: AccountTypeFork renders both options with correct copy

## Open prompt
Sprint 2 — Auth + Fork. Read CLAUDE.md, then docs/04-screens/onboarding-fork.md, docs/01-data-model.md, docs/05-voice-and-claims.md.

Propose:

1. The Supabase Auth configuration (passwordless settings, email template considerations, expiry)
2. Screen components and routing structure
3. How you'll enforce account_type immutability (RLS policy? trigger? client-side? combination?)
4. Any open questions about the OTP flow on iOS vs Android

Wait for approval.

## Risk notes
- Immutability of account_type must be enforced at the database level (RLS or trigger), not just the client. Client-only is bypassable.
- Test the OTP delivery on a real Nigerian carrier; SMS→email-only delivery is the right pattern, but verify the email actually arrives.
