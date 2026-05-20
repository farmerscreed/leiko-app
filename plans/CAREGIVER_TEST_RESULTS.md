# Caregiver Two-Phone Test Results

Sprint 16.6 — Pre-Launch Validation & Hardening, deliverable A.4.

Fill in one row per scenario in `CAREGIVER_TEST_FLOW.md`. Run twice:
once mid-week, once at sprint end. Use a new section for each pass.

**Status values:** `PASS` / `FAIL` / `BLOCKED` / `SKIP`

- **PASS** — all expectations met.
- **FAIL** — at least one expectation missed. Capture a screen
  recording and reference it in the Notes column.
- **BLOCKED** — couldn't run because a prerequisite is missing
  (e.g. SMTP not yet wired for S3, multi-day data not yet seeded
  for S7).
- **SKIP** — intentionally not running this pass.

---

## Run 1 — 2026-05-19 / 2026-05-20 Lagos

**Date:** 2026-05-19 evening → 2026-05-20 night
**Build:** dev-client serving Metro bundle from
`apps/mobile/`. Branch `claude/competent-goldberg-737194` at tip
`404bf02` plus 2 uncommitted hotfixes (F2, F3 below).
**P1 fixes shipped at this point:** none of the Sprint-16.6 §B items
(SEC-1 MMKV encryption, FUN-1 SMTP, etc.) shipped this session.
**Phone 1 (caregiver) Android version:** Pixel 8, Android 15
(43230DLJH001YY). Watch 1 paired, BP history intact, account
`biebele@gmail.com`. **NOT WIPED** (per handoff hard rule).
**Phone 2 (self-buyer) Android version:** OnePlus Nord N30 CPH2513,
Android 14 OxygenOS (8fae80bc). Wiped this session via Settings →
Apps → Leiko → Clear data (manual; see F1).

Scope this run: invite-code flow end-to-end only. Other scenarios
deferred to a later session.

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| S1  | Caregiver onboarding (Phone 1)            | NOT-RUN | Phone 1 already onboarded; not in scope this session. |
| S2  | Self-buyer onboarding (Phone 2)           | NOT-RUN | Phone 2 went through **caregiver** onboarding (TheOne). Self-buyer onboarding not exercised. |
| S3  | Family invite + accept                    | PASS    | Multiple attempts before landing — see F2 (email-mismatch on initial attempts after fresh signup re-bound to existing auth row; resolved by using a brand new email). New "Someone invited me" path on FamilyWatch (commit `67172b6`) confirmed working. |
| S4  | Watch pairing on Phone 2                  | NOT-RUN | Caregiver-only flow this session; Watch 2 was not paired. |
| S5  | Take reading → caregiver visibility       | NOT-RUN | Deferred (would need scenario 4 + live BP reading). |
| S6  | Anomaly trigger + push                    | NOT-RUN | Deferred. |
| S7  | Trends letter (caregiver of parent)       | NOT-RUN | Deferred. |
| S8  | For-your-doctor PDF                       | NOT-RUN | Deferred. |
| S9  | Settings flows (both)                     | NOT-RUN | Deferred. |
| S10 | Sign-out / sign-back-in resilience        | NOT-RUN | Deferred. |
| S11 | Offline buffering + reconnect             | NOT-RUN | Deferred. |
| S12 | Background-fetch (long-clock)             | NOT-RUN | Deferred. |

### Findings

**F1 — `pm clear` blocked by OxygenOS on OnePlus Nord N30 (Android 14)**

`adb -s 8fae80bc shell pm clear com.leiko.app` returns
`SecurityException: PID does not have permission android.permission.CLEAR_APP_USER_DATA`.
The `--user 0` variant is also blocked. Manual wipe via Settings →
Apps → Leiko → Storage usage → Clear data works. The bench rig docs
suggest `pm clear` as the canonical Phone-2 reset; that works on the
Pixel 8 but not on the OnePlus. For future two-phone tests, wipe
Phone 2 manually via Settings (or uninstall + reinstall the APK).
Worth updating `memory/running_on_phone.md` so future sessions don't
re-debug.

**F2 — `already_member` falls through to generic "couldn't join"
error copy in `AcceptInviteSheet`** *(fixed this session)*

A previously-invited caregiver who re-redeems a fresh code for a
family they're already in receives HTTP 409 `already_member` from
the Edge Function. `apps/mobile/src/components/AcceptInviteSheet.tsx`
only matched `invitation_already_accepted` — not `already_member` —
so the user saw "We couldn't join the circle. Try again in a moment."
This made the real cause invisible. Compounding factor: a wipe of
Phone 2 clears only LOCAL state. The server-side `auth.users` row +
`family_members` row persist, so "fresh signup with the same email"
re-binds to the existing account, which is still a member.

**Fix:** added `already_member` to the same regex branch as
`invitation_already_accepted`. Both surface "You're already in this
circle." `AcceptInviteSheet.tsx:100`.

**F4 — Settings → Family Members shows "Member" instead of real
display_names for every row except the signed-in user** *(fixed this session)*

The screen's data path (`listFamilyMembers` →
`family_members.select('user_id, role, joined_at, users(display_name)')`)
silently returned `users: null` for every member that isn't the
signed-in user. Root cause: the original RLS on `public.users`
allows only `id = auth.uid()` for SELECT — so the join into
`users` resolved nothing for other members, and the mapper fell
back to the generic "Member" label. All three family_members rows
were present in `family_members` (its RLS allows members to see
members) but the display names were unreadable.

**Fix:** migration `0021_users_visibility_in_family.sql` adds a
`shares_family(uuid)` security-definer helper + a second RLS
policy on `public.users` that allows reads when both users share
an active family membership. Display_name is a chosen handle, not
sensitive PII; same-family members already share vital readings so
this is less sensitive than what they already see.

**Verify on phone:** navigate away from Settings → Family Members
and back; the screen re-fetches on mount and renders the real
display_names (Biebele / TheOne / TheTest in the bench setup).

**F3 — Onboarding Continue button visually narrow / off-center**
*(fixed this session)*

The `Button` component's outer `Animated.View` wrapper had no width.
Consumer's `style={{ width: '100%' }}` was applied to the inner
`Pressable`, which resolved its `100%` against the auto-sized wrapper
and collapsed to text+padding width. On column-flex layouts (e.g.
`FamilyYou`) the button visually landed at the left edge with the
label appearing offset. Affected every onboarding screen (the
`OnboardingHero` intros + all 5 form screens via `AccountTypeFork`,
`FamilyYou`, `FamilyParent`, `SelfBuyer/You`, `Watch`).

**Fix:** moved consumer's `style` from the inner `Pressable` to the
outer `Animated.View`. The Pressable now stretches to fill the sized
wrapper by default. `apps/mobile/src/components/Button.tsx`.

**Process notes:**
- Metro's first-cold-start watcher timed out at the hard-coded 4-min
  `MAX_WAIT_TIME` in `metro-file-map/src/Watcher.js`. Second start
  (warm FS cache) succeeded. Installing Watchman would be the proper
  fix if this recurs.
- One typo cost ~10 minutes: Phone 1 issued an invite to
  `bokpokiri@hotmail.com` while Phone 2 had signed up as
  `bokpokiri@gmail.com` (subtle domain difference). A
  pre-flight email-existence check on the Phone-1 side would have
  flagged this. Worth a follow-up enhancement on `send-family-invite`.

**Voice-lint findings (any pass that surfaced a string violation):**

| Scenario | File / location | Phrase | Suggested replacement |
|----------|-----------------|--------|------------------------|
| —        | (none surfaced this run; voice-lint not re-run after F2/F3 fixes) | — | — |

**Bugs filed:** F2 + F3 fixed in working tree, awaiting commit.

---

## Run 2 — end-of-sprint

**Date:** _____
**Build:** APK SHA / commit hash _____
**P1 fixes shipped at this point:** _____

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| S1  | Caregiver onboarding (Phone 1)            |   |   |
| S2  | Self-buyer onboarding (Phone 2)           |   |   |
| S3  | Family invite + accept                    |   |   |
| S4  | Watch pairing on Phone 2                  |   |   |
| S5  | Take reading → caregiver visibility       |   |   |
| S6  | Anomaly trigger + push                    |   |   |
| S7  | Trends letter (caregiver of parent)       |   |   |
| S8  | For-your-doctor PDF                       |   |   |
| S9  | Settings flows (both)                     |   |   |
| S10 | Sign-out / sign-back-in resilience        |   |   |
| S11 | Offline buffering + reconnect             |   |   |
| S12 | Background-fetch (long-clock)             |   |   |

**Regression check vs. Run 1:** which scenarios degraded after
hardening? Investigate before sprint close.

**Voice-lint findings (Run 2):**

| Scenario | File / location | Phrase | Suggested replacement |
|----------|-----------------|--------|------------------------|
|          |                 |        |                        |

**Bugs filed:** (PR / issue links)

---

## Sprint-end summary

- Total PASS / FAIL / BLOCKED / SKIP across Run 2: __ / __ / __ / __
- Acceptance criterion is ≥ 90% PASS — met? Y/N
- Items moved from BLOCKED to PASS between Run 1 and Run 2: _____
- Outstanding FAILs at sprint end (must be commits-in-flight or
  explicit Sprint 17 deferrals): _____
