# Screen — Caregiver Onboarding

> **RECONCILED 2026-06-02 — legacy path only. Superseded by
> [ADR-0006](../_adr/0006-unified-caregiver-self-buyer-model.md).** New users
> no longer reach this flow: the onboarding fork was removed and everyone now
> onboards through the unified `self-buyer-onboarding.md` path. This
> caregiver-specific onboarding still exists in code for **existing accounts
> created with `account_type = 'caregiver'`** but is not part of the current
> new-user journey. "Caring for someone" is now an action available from the
> constellation home / Settings via the Connect invite (ADR-0007), not a
> persona chosen at onboarding. Retained below for history.

Sourced from D8 §4.2 (3 onboarding intro screens) + D8 §4.4 (Family Setup, 3 sub-screens). Routed from `account_type = 'caregiver'` on the fork screen.

---

## Audience
Newly-signed-up caregiver. Has just chosen "Someone I love" on the fork screen.

## Purpose
1. Set the emotional register (3 intro screens).
2. Capture caregiver own name + relationship pronoun.
3. Capture parent name + relationship + timezone.
4. Decide watch path: pair-now vs ship-to-parent (Shopify hand-off, US only at launch).

---

## Flow

### Sub-screen 1 — Intro (D8 §4.2.1)

| Field | Value |
| --- | --- |
| Headline | "Stay close to the people who shaped you." |
| Body | "Leiko is a calm way to keep an eye on a parent's health, even from far away." |
| CTA | `button.primary` "Continue" |
| Layout | Centred 240×180pt illustration, headline (`type.display-l`), body (`type.body-l`, max-width 280pt), CTA at bottom of safe area. 3-dot page indicator, active = navy. |

### Sub-screen 2 — Intro

| Field | Value |
| --- | --- |
| Headline | "Their watch. Your peace of mind." |
| Body | "When your parent's blood pressure changes, we let you know — gently. No surveillance, no panic." |
| CTAs | `button.primary` "Continue" + `button.ghost` "Skip" |

### Sub-screen 3 — Intro

| Field | Value |
| --- | --- |
| Headline | "You drive. They wear." |
| Body | "You set up the watch and pay. They wear it and tap once a day. Everyone sees the same readings." |
| CTAs | `button.accent` "Get started" + `button.ghost` "Skip" |

> Per D8 §4.2: skip is only visible from screen 2; it routes directly into family setup. Once completed, intros are never shown again (flag in MMKV).

### Sub-screen 4 — Family Setup: You (D8 §4.4.1)

| Field | Value |
| --- | --- |
| Headline | "Tell us about you." |
| Inputs | `input.text` "What should we call you?" (caregiver own name); chip-select pronoun: Daughter / Son / Niece / Nephew / Other |
| CTA | `button.primary` "Continue" (disabled until both filled) |

Writes to `public.users.display_name` and a `relationship` field on `family_members` after family creation.

### Sub-screen 5 — Family Setup: Who you're looking after (D8 §4.4.2)

| Field | Value |
| --- | --- |
| Headline | "Who are you looking after?" |
| Inputs | `input.text` parent name (e.g. "Mama Linda"); chip-select relationship (Mum / Dad / Aunt / Uncle / Other:custom); timezone picker (auto-suggest from user's current location, override-able) |
| CTA | `button.primary` "Continue" |

Writes to `public.families` (`parent_display_name`, `parent_relationship`, `parent_residence` if user adds it later).

### Sub-screen 6 — Family Setup: Watch (D8 §4.4.3)

| Field | Value |
| --- | --- |
| Headline | "Where's the watch right now?" |
| Body | "We'll set it up the right way for where it lives." |
| Two large cards | "I have the watch with me" → routes to Sprint 5 BLE pairing (`watch-pairing.md`) — caregiver-local path |
| | "Ship one to them" → Shopify hand-off (US only at launch) — opens external Shopify checkout in `react-native-webview`, passes the family_id as a URL param |

---

## Voice

Per `docs/05-voice-and-claims.md`:
- **Reassuring tone** throughout. Never fear hooks.
- "Mama Linda" / "Aunt Tola" examples in placeholder text — cultural specificity per D5 §3.3 pillar 4.
- Never "patient", "loved one" as category — but "the people who shaped you" is acceptable as a respectful framing.

---

## Behaviour

- All writes are **MMKV-first**, then Supabase. Network failure does not block flow — pending writes flush on next sync.
- Back navigation: full back-stack within onboarding; cannot back out of intros once dismissed; can back from sub-screens 4–6 within family setup.
- Skip during intros routes directly to sub-screen 4 (You). Skip is **not available** during sub-screens 4–6 (these are required to function).

---

## Accessibility

- Headlines: `accessibilityRole: "header"`.
- Page indicator (3 dots): announce "Page 2 of 3".
- Pronoun chip-select: `accessibilityRole: "radiogroup"`; each chip has `accessibilityState: { selected: boolean }`.
- Timezone picker: searchable list, screen-reader-friendly labels ("America / New_York, current selection").

---

## Sprint 3 acceptance criteria
- All 6 sub-screens render with correct tokens.
- Family + family_members rows created on completion of sub-screen 5.
- account_type immutability re-asserted (no fork branch shown).
- Voice gate passes.
- Component + integration tests covering the full flow with at least one branch (pair-now path).

---

## D8a status — UNCHANGED

D8a §4 SUPERSEDES D8 §4.4 (Family Setup) for the **self-buyer track only**. Caregiver Onboarding (this file) is **UNCHANGED** by D8a per the diff convention.

D8a §3.2 confirms screens 4.2.1–4.2.3 (the three caregiver intros) are UNCHANGED — they only appear after "Someone I care for" is chosen on the fork screen.
