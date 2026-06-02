# Screen — Switch account

Sourced from D8a §10.6 (account management) + D6 US-88 (delete account), built
by **Sprint 19 Block 4** (multi-account on one device) and refined by **Block 9**
(post-sign-out auth routing). The on-device account switcher: a list of every
email that has signed in on this phone, with switch / forget / delete actions.

> **Implementation**: `apps/mobile/src/screens/AccountSwitch/AccountSwitchScreen.tsx`.
> Registered on **both** the caregiver and self-buyer stacks in
> `apps/mobile/src/navigation/RootNavigator.tsx` as `AccountSwitch`. Backed by
> `apps/mobile/src/state/knownAccounts.ts` (MMKV list of known emails) and
> `apps/mobile/src/services/users/accountActions.ts` (`deleteAccount`).

---

## Audience

Both personas — `account_type` is irrelevant here. The screen operates on
**device-local sign-in identities** (emails), not on circles or roles. It is
about *which Leiko account is signed in on this phone*, independent of the
unified circle model. Anyone with at least one prior sign-in on the device can
reach it.

## Purpose

- List every email that has successfully signed in on this device
  (`useKnownAccounts`, MMKV-persisted, most-recent first).
- Switch to another known account: sign out current, then send a 6-digit OTP
  to the chosen email and land on OTP entry.
- Forget a known account (remove it from this device only — server data
  untouched).
- Delete the **current** account (typed-DELETE confirm → soft-delete on the
  server → sign out).
- Sign in with a brand-new email (sign out → AuthStack `SignIn`).

---

## When reached

- **Settings → Account → "Switch account"** (`SettingsScreen.tsx`,
  `stackNavigation.navigate('AccountSwitch')`). The Settings row subtitle reads
  "Signed in as {email}" when a profile email is present, else "Manage accounts
  on this device."

This is the only entry point in the app. There is no deep link and no nav
param.

---

## Layout (top to bottom)

| Element | Detail |
| --- | --- |
| Back affordance | Text "Back", `brand.primary`, `accessibilityRole="button"` |
| Header | "Switch account" (`displayM`, `accessibilityRole="header"`) |
| Subhead | "Tap an account to sign in, or sign in with a new email." (`bodyL`, `text.secondary`) |
| **Signed in** section | *Only when a current email exists* — current-account row + "Delete account" action |
| **On this device** section | Known accounts other than the current one, each a `navigation` row → switch sheet |
| **Manage** section | *Only when ≥1 known account* — a "Forget {email}" action row per non-current known account |
| Primary button | "Sign in with a different email" → sign out + route to AuthStack `SignIn` |

### Signed-in section

- `data` row: current email, subtitle "Signed in on this device." when
  `status === 'authenticated'`, else "Hydrating…".
- `action` row: "Delete account", subtitle "Removes your data from our
  servers." → opens the delete sheet.

### On-this-device section

Lists `accounts` filtered to exclude the current email (lowercased). Each row:
title = email, subtitle = "Last signed in {relative}" via `formatLastSignedIn`
("just now" / "{n} min ago" / "{n}h ago" / "{n}d ago" under 30 days, then a
locale date). Tapping opens the **switch** sheet. When the known-accounts list
is empty, this section shows "No other accounts saved on this device yet."
(`account-switch-empty`).

### Manage section

One "Forget {email}" `action` row per non-current known account, subtitle
"Remove from this device. Your data stays on our servers." → opens the
**forget** sheet. The section is hidden entirely when there are no known
accounts.

---

## Sheets

### Switch (`size="compact"`)

Title "Switch to this account?". Body: "We'll sign you out and send a 6-digit
code to {email}." On confirm (`confirmSwitch`): `signOut()` → `signInWithOtp(email)`
→ reset the AuthStack to `OTPVerify` (with `email` + `mode: 'signin'`) so the
user lands directly on code entry. Errors surface inline in `state.urgent`
copy; the confirm button reads "Switching…" while pending.

### Forget (`size="compact"`)

Title "Forget this account?". Body explains the entry is removed from this
device and "signing in again brings it back." On confirm (`confirmForget`):
`knownAccounts.forget(email)` only — no server call. Closes the sheet.

### Delete (`size="tall"`)

Title "Delete this account?". Body warns the account + data are removed from
the servers and the email can't sign in again. Requires typing `DELETE`
(case-insensitive, trimmed) into a `TextInput`; a non-matching value shows
"Type DELETE in the box above to confirm." On confirm (`confirmDelete`):
`deleteAccount(currentEmail)` (→ `delete-account` Edge Function, soft-delete) →
`signOut()` → `forget(currentEmail)` → reset AuthStack to `SignIn`. Button reads
"Deleting…" while pending.

All three sheets carry a "Cancel" / secondary escape, and dismissal is blocked
while `pending` is true.

### Auth-stack routing (Block 9 note)

`resetAuthTo` dispatches through the root `navigationRef` on a `setTimeout(0)`
tick so the AuthStack has remounted after sign-out before the reset fires.
Pre-Block-9 the screen navigated via the local stack ref *after* sign-out had
unmounted it, silently no-op'ing and stranding the user. This is documented in
the screen's own comments.

---

## States

| State | What renders (`testID`) |
| --- | --- |
| `signed-in` | "Signed in" section present (current email known) |
| `no-current` | "Signed in" section omitted when `currentEmail` is null |
| `empty` | "No other accounts saved on this device yet." (`account-switch-empty`) when no known accounts |
| `default` | Known-account rows + Manage section |
| `action pending` | Sheet confirm shows "Switching…" / "Deleting…"; sheet cannot be dismissed |
| `action error` | Inline `state.urgent` text inside the active sheet (`accessibilityLiveRegion="polite"`) |

There is no network "loading" state for the list itself — the known-accounts
list is read synchronously from MMKV, so it renders immediately.

---

## Relationship to settings.md + ADR-0006

- This screen sits **outside** the ADR-0006 circle model. ADR-0006 §4 collapses
  the *Family* surface to two role-aware sections; account-switching is a
  separate concern (device identity, not circle membership) and is unaffected
  by the unified model. `account_type` is inert here as everywhere.
- `settings.md` documents the Account section (sign out) and the Privacy "Delete
  my account" action. This screen **duplicates the delete-account path** as a
  convenience on the current-account row — both routes call the same
  `delete-account` Edge Function via `services/users/accountActions.ts`. The
  `settings.md` hardening deferrals (full OTP reauth, 30-day restore-grace,
  hard-delete cron — Sprint 17) apply to this delete path too.
- Sign-out from `settings.md` does **not** clear the known-accounts list by
  design (`knownAccounts.ts`): the switcher's whole purpose is to remember
  emails across sign-outs. Only delete-account removes an entry.

---

## Voice

Per `docs/05-voice-and-claims.md`:
- No "patient", no fear language. Destructive copy states the consequence
  ("Removes your data from our servers.", "won't be able to sign in … again")
  and, where reversible, the recovery ("signing in again brings it back").
- Verb-first CTAs: "Switch account", "Forget", "Delete account", "Sign in with
  a different email".
- "6-digit code" in plain language — matches the email + 6-digit-code invite
  convention (D8a §10), never "token".
- Errors name a calm cause + retry; no codes or stack traces.

---

## Accessibility

- Header `accessibilityRole="header"`; Back `accessibilityRole="button"`.
- The DELETE confirm input carries `accessibilityLabel="Type DELETE to confirm"`,
  `autoCapitalize="characters"`, and meets `minTapTarget`.
- Sheet error text uses `accessibilityLiveRegion="polite"` so screen readers
  announce a failed switch/delete without a focus jump.
- Known-account rows are `navigation` variant; current-account info is `data`
  (inert), so the reader does not announce the signed-in row as actionable.
