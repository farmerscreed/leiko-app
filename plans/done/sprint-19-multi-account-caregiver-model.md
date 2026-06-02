> **SUPERSEDED 2026-06-02 by ADR-0006 + ADR-0007** (merged to `main` as
> PR #8, `3c1dba7`). The model questions this card raised — the "SELF"
> relationship-label leak, no path to add a second parent, no account
> switcher, per-caregiver relationship labels — were resolved wholesale by
> the unified caregiver/self-buyer model (ADR-0006) and the unified
> "Connect" invite (ADR-0007), rather than as the incremental fixes scoped
> here. See `docs/_adr/0006-unified-caregiver-self-buyer-model.md` and
> `docs/_adr/0007-unified-connect-invite.md`. Filed under `done/` as the
> historical record of the problems that motivated the ADRs.

# Sprint 19 — Multi-account + caregiver-model fixes

**Opened:** 2026-05-22 PM Lagos · supersedes Sprint 18 mid-session pause.
**Branch:** `claude/competent-goldberg-737194` (continues from v5 ship).
**Target build:** v6 APK (single big drop per founder's pick).

## Origin

Discovered during v5 hands-on testing — Phone 1 self-buyer + Phone 2
caregiver flow surfaced four user-visible UX gaps plus an account-mgmt
gap. None block v5 itself (sleep + Halo Ember icon are clean); these are
quality-of-life fixes ahead of launch.

The bugs aren't bugs in the strict sense — the dashboard renders exactly
what the database says. The gaps are in (a) the model's UX exposure
(e.g. "TheOne · SELF" leaking self-buyer onboarding language to a
caregiver) and (b) missing CTAs (no way to add a second parent; no way
to switch between accounts on the same device).

## Goals

1. **Cosmetic fixes** the caregiver hits immediately:
   - Don't render `"SELF"` as a parent's relationship to a caregiver.
   - Don't show "+ Add someone" to non-owners — it 403's silently.
2. **Multi-parent care** — a caregiver who looks after both Mum and Dad
   needs a path to create a second family in-app.
3. **Edit family details** — the family_owner needs a path to fix a
   mis-typed parent name without re-onboarding.
4. **Per-caregiver relationship label** — root-cause fix for the "SELF"
   leakage. Each caregiver labels the wearer their own way ("Husband"
   vs "Friend"). Schema migration.
5. **Account switcher** — multiple Supabase accounts on the same device,
   discoverable delete-account flow, "signed in as X" indicator.

## Non-goals (this sprint)

- True parallel multi-session juggling (parallel signed-in users without
  re-auth). Deferred to a future sprint — needs auth refactor.
- Editing the watch's serial number / un-pairing / re-pairing UX
  surfaces beyond what already exists.
- Onboarding flow redesign — the current fork + invite-code system stays
  shape-stable.

## Ordered blocks

Each block lands as one commit. Pause for review after Block 4 before
applying the Block 5 migration to prod.

### Block 1 · Cosmetic fixes (~45 min)

- `apps/mobile/src/utils/caregiverPerson.ts:152` — when
  `parent_relationship === 'self'`, render `'Wearer'` instead of literal
  `'Self'`. The display-side `relation` field flows through to the
  PersonCard's eyebrow + the legend row.
- `apps/mobile/src/screens/Home/CaregiverHome.tsx` — derive `canInvite`
  from viewer's role in the rendered family (require `family_owner`).
  Replace the static `CAN_INVITE_FOR_NOW = true` gate. The action bar's
  invite button hides for non-owners.
- Tests: `caregiverPerson.test.ts` SELF fallback case;
  `CaregiverHome.test.tsx` invite-hidden-for-caregiver case.

### Block 2 · Care for another person (~2-3h)

- `apps/mobile/src/screens/Family/AddPersonScreen.tsx` — new screen
  (sheet-style) reusing FamilyParent's input shape: name + relationship
  + timezone. No watch step — pairing stays a separate flow.
- `state/onboarding.ts` `addAnotherFamily(input)` — calls the
  `create_family` RPC for an authenticated caregiver. The RPC already
  supports repeated calls; caregiver becomes a family_owner of the
  second family.
- CTA on `CaregiverHome` bottom action bar — labelled
  **"+ Care for another person"** — gated on `family_owner` role on at
  least one family they belong to.
- After success: invalidate `useFamilyReadings` cache → second orb
  appears.
- Tests: AddPersonScreen render, addAnotherFamily happy path + RPC
  failure path, CaregiverHome shows second orb post-success.

### Block 3 · Edit family details — owner (~1-2h)

- Settings → Family → "Edit family details" row — owner-only.
- New sheet `apps/mobile/src/components/EditFamilyDetailsSheet.tsx` —
  editable display_name + relationship picker (mirrors FamilyParent
  UI minus tz).
- `services/families/updateFamilyDetails.ts` — `UPDATE families SET
  parent_display_name = ?, parent_relationship = ? WHERE id = ?`. RLS
  already restricts UPDATE to family_owners; no migration needed.
- Cache invalidation on success.
- Tests: service unit + sheet integration.

### Block 4 · Account switcher (~3-4h)

- `STORAGE_KEYS.knownAccounts` (MMKV) — array of
  `{ email: string, lastSignedInAtMs: number }`. Updated on every
  successful auth.
- `apps/mobile/src/screens/AccountSwitch/AccountSwitchScreen.tsx` —
  lists known accounts, "Sign in with another email" CTA, current
  account chip at top.
- Settings → Profile row "Switch account" → routes to the new screen.
- "Signed in as &lt;email&gt;" chip rendered at the top of every Settings
  screen (`SettingsHeader` extension).
- "Delete this account" row in Settings → Profile (or in the account
  switcher) — wraps existing `services/users/accountActions.ts`
  `deleteAccount()` with a typed-confirm sheet ("Type DELETE to
  confirm").
- Switch flow: tap a known account → sign out current → OTP-in the
  selected email. Existing OTP flow reused.
- Tests: storage round-trip, switcher screen, delete confirm flow.

### Block 5 · Per-caregiver relationship label (~3-4h) — schema migration

- **Migration `supabase/migrations/0024_caregiver_relationship_label.sql`**
  — `ALTER TABLE family_members ADD COLUMN caregiver_relationship_label
  text;`. Nullable. No RLS change (existing policies cover it).
- **Pause before applying to prod.** Founder reviews the migration SQL,
  then explicit go-ahead, then I apply via the supabase MCP.
- `supabase/functions/accept-family-invite/index.ts` — accept
  `caregiver_relationship_label` in body; write to the new column on
  upsert.
- `apps/mobile/src/components/AcceptInviteSheet.tsx` — after the code
  is validated, before the membership is created, prompt
  **"Who is &lt;name&gt; to you?"** — chip select using the existing
  `caregiver_relationship` list (daughter / son / niece / nephew /
  other) plus a custom field.
- `apps/mobile/src/services/families/fetchParentSummaries.ts` — also
  fetch the viewer's `caregiver_relationship_label`.
- `apps/mobile/src/utils/caregiverPerson.ts` — prefer per-caregiver
  label over `families.parent_relationship`. The Block 1 "Wearer"
  fallback only fires when BOTH are missing.
- Settings → Family → "How do you call &lt;name&gt;?" — edit own label.
- Tests: migration round-trip; Edge Function unit; AcceptInviteSheet
  prompt UI; caregiverPerson preference order.

### Block 6 · Test + v6 APK build (~30 min)

- Full Jest on touched modules.
- Voice-check every new user-visible string.
- Update `plans/LAUNCH_ARTIFACTS.md` with the v6 entry (queued).
- Kick EAS build for production-apk profile.
- Update LAUNCH_ARTIFACTS.md with the URL once the build finishes.
- Hand off to founder for Phone 1 + Phone 2 retest.

## Resolved ambiguities (from approval prompt)

| # | Question | Decision |
|---|---|---|
| 1 | Account switcher placement | **Both** — chip in Settings header + row in Settings → Profile that opens the picker. |
| 2 | Care-for-another-person CTA location | **Both** — action bar + Settings → Family. |
| 3 | Per-caregiver label scope | **Relationship only** — display_name stays canonical per family. |
| 4 | Delete-account behaviour | **Soft delete** — existing `deleteAccount()` flow, surfaced with typed-confirm. |
| 5 | Migration timing | I apply via supabase MCP **after explicit founder approval**. |
| 6 | "Wearer" fallback | Use **"Wearer"** when both `caregiver_relationship_label` and `parent_relationship` are missing or 'self'. |

## Acceptance criteria

A sprint is done when:
1. Block 1: caregiver in a self-buyer family no longer sees "SELF" on
   any screen. Non-owners don't see "+ Add someone" anywhere.
2. Block 2: caregiver can create a second family from CaregiverHome,
   and a second orb appears in the constellation after success.
3. Block 3: family_owner can edit `parent_display_name` and
   `parent_relationship` from Settings without re-onboarding.
4. Block 4: signed-in user can switch between two accounts on the same
   device without losing pending readings. "Signed in as X" chip is
   visible. Delete-account flow works end-to-end.
5. Block 5: a fresh accept-invite prompts the new caregiver for their
   relationship label, and the dashboard renders that label instead of
   the family default.
6. Block 6: v6 APK is on EAS, URL recorded, Phone 1 + Phone 2 retests
   pass on real hardware.
7. Voice rules clean on every new string.
8. CI green.

## Hard rules carried forward

- Don't run `expo prebuild` (stomps three Android customizations — see
  `memory/expo_prebuild_android_drift.md`).
- `account_type` is immutable; the account switcher does NOT change
  account_type — switching means signing out + signing in a different
  user.
- audit_log INSERT requires service_role; any new write goes through
  an Edge Function or stays client-only.
- Voice rules pass on every user-visible string.
- One logical change per commit.

## Memory notes to read before resuming

- `memory/sprint_18_audit_pass_close_out.md` — caregiver-scoped
  load/error template, FK-embed traps.
- `memory/sprint_17b_close_out.md` — owner/caregiver permission gates;
  RLS visibility patterns; vital_type ::text cast.
- `memory/dev_account_type_bypass.md` — only relevant if test data
  needs an account_type flip (out of scope this sprint).
