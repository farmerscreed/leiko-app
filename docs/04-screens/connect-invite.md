# Screen — Connect / Invite

Sourced from **ADR-0007** (unified "Connect" invite — one code, backend infers
direction), which supersedes the two-direction invite UX of **ADR-0006 §3**
(its wearer-consent + pending-invite plumbing are retained). This documents the
**shipped** flow: one code to share, one sheet to accept, and server-side
direction resolution from watch ownership.

> Divergence note (code vs ADR): ADR-0007 calls for the family invite surface
> to collapse to exactly **two symmetric rows** — "Connect with someone" and
> "Enter a code" — with direction-free copy. The **client** still ships the
> ADR-0006 visual shell: the share row is labelled "Invite someone to follow"
> (gated on the viewer wearing a watch) and the accept row is "Care for
> another person"; Home keeps a separate "+ Add someone I care for"
> (`CareInviteSheet`). **What changed under the hood:** both share sheets now
> call `createConnect` and the accept sheet calls `acceptConnect`, so direction
> is resolved server-side regardless of which button was pressed. The copy
> relabel is not yet done. Spec below documents the **code**.

---

## Audience
- Caregiver (sharing a code, or entering one to follow someone)
- Self-buyer (sharing a code so family can follow them)
- Either party of a symmetric "connect" — direction is never chosen by the user

## Purpose
Let any two users link their accounts with **one code**. The user never declares
who-follows-whom; the backend infers it from who actually wears a watch at
accept time.

---

## Entry points

| Entry | Where | Opens | Calls |
| --- | --- | --- | --- |
| Home "+ Add someone I care for" | `CaregiverHome` empty-state / add CTA (`apps/mobile/src/screens/Home/CaregiverHome.tsx:613,691`) | `CareInviteSheet` (share a code) | `createConnect` |
| Home "Enter a code" / "Someone invited me" | `CaregiverHome` empty-state CTA (`CaregiverHome.tsx:472,520,679`) | `AcceptInviteSheet` | `acceptConnect` |
| Settings → "Invite someone to follow" | `SettingsScreen.tsx:806` (only shown when the viewer wears a watch — `wornCircle`) | inline invite `BottomSheet` (share a code) | `createConnect` (`SettingsScreen.tsx:1555`) |
| Settings → "Care for another person" | `SettingsScreen.tsx:865` ("Add someone" section, always shown) | `AcceptInviteSheet` (`settings-accept`) | `acceptConnect` |
| Onboarding "Someone invited me" | `screens/Onboarding/Caregiver/FamilyWatch.tsx:323` | `AcceptInviteSheet` | `acceptConnect` |
| Deep link `…/join?token=…` | parsed by `deepLinkParser.ts`, dispatched by `deepLinks.ts:83` | routes to Settings with code/email prefilled → `AcceptInviteSheet` auto-opens | `acceptConnect` |

The share/accept components: `apps/mobile/src/components/CareInviteSheet.tsx`,
`apps/mobile/src/components/AcceptInviteSheet.tsx`. Client service wrappers:
`apps/mobile/src/services/families/manageInvites.ts` (`createConnect`,
`acceptConnect`). Edge functions: `supabase/functions/connect-create/index.ts`,
`supabase/functions/connect-accept/index.ts`.

---

## Share flow (generate one code)

The sharer enters the **invitee's email** (required) and an optional first-name
label, then taps the send button. `createConnect` → `connect-create` does:

1. Generates a 6-digit numeric code (`000000`–`999999`, retried up to 6× on
   collision) and a `url_token`.
2. Records the inviter and their **current** watch-circle (if they wear a
   watch) as a hint on the `invitations` row; `family_id` is **nullable** when
   the sharer has no watch yet — direction is still resolved at accept time.
3. Inserts with `kind = 'parent_pairing'` (a single connect kind; the
   `caregiver` / `parent_pairing` split no longer drives direction).
4. Sets `expires_at` = **7 days** from now.
5. Best-effort emails the code to the invitee via Resend (when
   `RESEND_API_KEY` + `RESEND_FROM_EMAIL` are set); returns `emailSent`.
6. Audit-logs `connect.created` with **email domain only** (no PHI, no full
   address) per the no-PHI rule.

Returns: `{ invitationId, pairingCode, urlToken, expiresAt, emailSent }`.

The sheet then shows the code and a **"Share invite"** button that opens the OS
share sheet with **dual delivery** — a tappable link **and** the 6-digit code in
one message, so the sharer needn't know whether the recipient already has Leiko:

```
Tap to join: https://leiko.app/join?token=<urlToken>
Already have Leiko? Enter code <code>. Works for 7 days.
```

(`CareInviteSheet.tsx:79`; `SettingsScreen.tsx:1372`.)

---

## Accept flow (enter a code)

`AcceptInviteSheet` collects:
- **Email** — must match the email the sharer entered (the email-match guard).
- **6-digit code**.
- Optional **"Who are they to you?"** relationship chip (Mum / Dad / Aunt /
  Uncle / Spouse / Friend / Other-with-custom). Encoded and passed as
  `caregiverRelationshipLabel`; stored on the resulting `family_members` row,
  preferred over `families.parent_relationship` for display.

`acceptConnect` → `connect-accept` validates the code shape, looks up the
invite by `pairing_code`, and rejects with a specific error for: not found
(404), cancelled (410), already accepted (409), expired (410), email mismatch
(403), self-invite (400). **Single-use**: a successful non-pending accept sets
`accepted_at` / `accepted_by`, so the code can't be reused.

### Server-side direction resolution

Direction is **re-derived at accept time** from current watch ownership (not
trusted from the stored `family_id`, since either party may have paired since
the code was created). "Wears a watch" = the user owns a self-circle
(`families.parent_user_id = user`) with an active, paired device
(`devices.unpaired_at IS NULL`).

| Sharer wears? | Accepter wears? | Outcome (`outcome`) | What's wired | `familyId` | `canFollowBack` |
| --- | --- | --- | --- | --- | --- |
| Yes | No | `accepter_follows` | Accepter added as **caregiver** of sharer's circle | sharer's circle | false |
| No | Yes | `sharer_follows` | Sharer added as **caregiver** of accepter's circle | accepter's circle | false |
| Yes | Yes | `accepter_follows` | Accepter follows sharer **now**; sharer is **offered** follow-back (NOT auto-mutual, per ADR-0007 resolved decision #1) | sharer's circle | **true** |
| No | No | `pending` | Nothing wired; invite left **open** (not marked accepted) | `null` | false |

"Following" = a `role = 'caregiver'` row on the **wearer's** circle
(`family_members`), inserted idempotently (skipped if already an active
member). The wearer's existing per-vital visibility controls are unchanged —
following grants membership, not unrestricted visibility.

Audit-logs `connect.accepted` with `{ invitation_id, outcome, can_follow_back }`
(no PHI).

### Pending resolution (neither wears a watch)

When neither party wears a watch, the invite is **held open** and the relationship
resolves once one of them pairs a watch — whoever pairs first becomes the wearer,
the other their follower. Under ADR-0007 a stashed deep-link code can **no longer
be silently auto-resolved** (accept now requires the accepter's email for the
match guard, which a link doesn't carry reliably): `tryResolvePendingCareInvite`
is now a no-op (`apps/mobile/src/services/families/pendingCareInvite.ts:36`). The
person finishes by entering the code **with their email** in the "Enter a code"
sheet.

---

## Deep-link `join` route

`https://leiko.app/join?token=<urlToken>` (and `leiko://join?...`) is parsed by
`parseDeepLink` into `category: 'join'` carrying `inviteToken` / `inviteCode` /
`inviteEmail` (`apps/mobile/src/services/notifications/deepLinkParser.ts:50`).
Dispatch (`deepLinks.ts:83`):
1. Stashes any `code` (`stashPendingCareInvite`) for the pre-pairing case.
2. Navigates to **Settings** with `{ inviteCode, inviteEmail, inviteToken }`.
3. `SettingsScreen` reads `route.params` (`SettingsScreen.tsx:268`) and
   auto-opens `AcceptInviteSheet` with the code + email prefilled.

The share link carries only a `token`; the code variant (`?code=…`) is also
parsed if present, but generated share messages use the token form plus the
plain code in the body.

---

## States

| State | Sheet behaviour |
| --- | --- |
| `idle` (share) | Email + optional label inputs; "Send invite" |
| `code ready` (share) | Code displayed in a framed block; "Share invite" + "Done" |
| `idle` (accept) | Email + code inputs + relationship chips; "Join family circle" |
| `success` (accept) | "You're in" confirmation; family appears on Home via realtime; "Done". Onboarding consumers skip this state (`showSuccessState=false`) to finalize atomically. |
| `error` (accept) | Inline, code-specific message (see Voice) |
| `pending` | `familyId` is `null`; consumers that need an id ignore it until the connection resolves on pairing |

State resets every time a sheet opens, so a dismissed-but-incomplete prior
attempt doesn't leak (`AcceptInviteSheet.tsx:108`, `CareInviteSheet.tsx:40`).

---

## Voice

Per `docs/05-voice-and-claims.md` — copy is calm, plain, no "patient" / fear
language, and direction-free analogies ("keep a gentle eye on each other"):

- Share intro (Settings): *"Let my daughter keep an eye on me."* / *"We'll
  create a 6-digit code you can share. They enter it in their own Leiko app to
  follow your readings."*
- Share intro (Care): *"Let me keep an eye on Mum."* / *"Invite someone whose
  readings you'd like to follow."*
- Accept intro: *"Type the email the inviter used and the 6-digit code they
  shared with you."*
- Accept success: *"You've joined the circle. Their readings will appear on
  your home screen."*
- Email body: *"…would like to connect with you on Leiko so you can keep a
  gentle eye on each other's readings."*
- Error copy maps server codes to plain language: not-found → *"We couldn't
  find that code. Double-check and try again."*; email mismatch → *"That email
  doesn't match the invite."*; expired → *"That code has expired. Ask for a new
  one."*; already used → *"That code has already been used."*

---

## Accessibility

- Code display: `accessibilityLabel` spells the digits individually
  (`"Invite code, 1 2 3 4 5 6"`) so VoiceOver reads it cleanly
  (`CareInviteSheet.tsx:115`, `SettingsScreen.tsx:1348`).
- Relationship chips: wrapped in `accessibilityRole="radiogroup"` labelled
  "Your relationship to the wearer" (`AcceptInviteSheet.tsx:269`).
- Accept submit button: `accessibilityLabel="Join family circle"`.

---

## Data rules

- Invitee **email is required** at create time and matched (case-insensitive)
  at accept time — the email-match guard against mistyped/forwarded codes
  (ADR-0007 resolved decision #2).
- Codes are **single-use** and **expire in 7 days**.
- Reading values never appear in any analytics event; audit logs carry email
  **domain** only, never the full address or any vital.
- `account_type` is untouched by connect — following grants a caregiver
  membership, not a type change.

---

## Open / not-yet-done

- **Copy + row consolidation** to ADR-0007's two symmetric rows ("Connect with
  someone" / "Enter a code") is **not shipped**; the client keeps ADR-0006
  labels and the watch-gated "Invite someone to follow" row.
- **Follow-back UX**: `connect-accept` returns `canFollowBack: true` when both
  wear watches, but the in-app prompt offering the sharer the follow-back is a
  separate explicit action (second connect/accept) — no dedicated UI documented
  here.
- **Back-compat window**: the four legacy edge functions
  (`send-family-invite`, `accept-family-invite`, `send-care-invite`,
  `resolve-care-invite`) and their wrappers in `manageInvites.ts` remain for
  already-issued codes; removal length is the ADR's open question.

---

## Files read (this doc reflects the code as of 2026-06-02)

- `docs/_adr/0007-unified-connect-invite.md` — the design.
- `docs/_adr/0006-unified-caregiver-self-buyer-model.md` §3 (Decision item 3) —
  superseded invite/consent context + retained pending plumbing.
- `supabase/functions/connect-create/index.ts` — code generation, 7-day
  expiry, email, watch-circle hint, audit.
- `supabase/functions/connect-accept/index.ts` — email-match guard, direction
  resolution table, follow-back flag, pending case.
- `apps/mobile/src/components/CareInviteSheet.tsx` — Home share sheet
  (`createConnect`).
- `apps/mobile/src/components/AcceptInviteSheet.tsx` — accept sheet
  (`acceptConnect`), relationship chips.
- `apps/mobile/src/services/families/manageInvites.ts` — `createConnect` /
  `acceptConnect` wrappers (+ retained legacy wrappers).
- `apps/mobile/src/services/families/pendingCareInvite.ts` — stash + no-op
  resolve under unified connect.
- `apps/mobile/src/screens/Settings/SettingsScreen.tsx` — "Invite someone to
  follow" + "Care for another person" rows, dual-delivery share, deep-link
  prefill.
- `apps/mobile/src/screens/Home/CaregiverHome.tsx` — "+ Add someone I care
  for" + "Enter a code" entry points.
- `apps/mobile/src/services/notifications/deepLinkParser.ts` +
  `deepLinks.ts` — `join` route parse + dispatch.
- `docs/04-screens/reading-detail.md` — house format.
- `docs/05-voice-and-claims.md` — voice rules applied to quoted copy.

**Confirmation:** every behaviour above was read from the cited source. Where the
shipped client diverges from ADR-0007 (row labels / copy not yet consolidated,
Settings invite row still watch-gated, follow-back prompt absent), this doc
documents the **code** and flags the divergence in the note at the top and the
"Open / not-yet-done" section.
