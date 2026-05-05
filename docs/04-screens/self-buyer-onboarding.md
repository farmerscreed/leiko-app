# Screen — Self-Buyer Onboarding

The full self-buyer flow per D8a §3.3 (3 intro screens — ADDS) + D8a §4 (You + Watch — SUPERSEDES D8 §4.4 for self-buyer track only). Routed from `account_type = 'self_buyer'` set on the fork screen.

---

## Audience
Newly-signed-up self-buyer. Has chosen "Myself" on the fork screen.

## Purpose
1. Set the emotional register — *understand your body* (parallel to caregiver's *stay close*).
2. Capture name + timezone + optional year of birth.
3. Decide watch path: pair-now vs order-from-Shopify.

---

## Flow (5 sub-screens)

### Sub-screens 4.2.4 / 4.2.5 / 4.2.6 — Intros (D8a §3.3)

Three screens parallel to the caregiver onboarding intros. **Same visual layout** as the caregiver three (centred 240×180pt illustration, `type.display-l` headline, `type.body-l` body, CTAs at bottom of safe area). Different copy + different illustrations — emotional register shifts from "stay close" to "understand your body".

| Screen | Headline | Body | CTA |
| --- | --- | --- | --- |
| **4.2.4** | "Your blood pressure, in your own words." | "Kena helps you understand what your numbers mean — in plain language, on your terms." | `button.primary` "Continue" |
| **4.2.5** | "Same accuracy as your doctor's cuff." | "The watch uses an inflatable cuff — the same method clinicians use — measured from your wrist instead of your arm." | `button.primary` "Continue" + `button.ghost` "Skip" |
| **4.2.6** | "See your trends. Show them to your doctor." | "A clear weekly summary, the kind you can save and share at your next appointment." | `button.accent` "Get started" + `button.ghost` "Skip" |

> Skip is only visible from screen 4.2.5 onward. It routes directly into setup (sub-screen 4.4.1 below). Once completed, intros are never shown again (flag in MMKV).

### Illustration slots (D8a §3.3.2)
Three new illustrations needed (in addition to D8 §5.3 inventory). Same brief: warm cream/amber palette, organic shapes, no clinical/hospital imagery, diverse representation.

- **4.2.4**: A hand resting open, with a soft glow above the wrist (calm self-attention).
- **4.2.5**: A watch beside a stylised arm-cuff, both equally weighted (parity, not replacement).
- **4.2.6**: A hand passing a folded note across a table (the doctor visit, framed warmly).

### Sub-screen 4.4.1 — You (D8a §4.1)

| Field | Value |
| --- | --- |
| Headline | "Welcome. Let's set you up." |
| Body | "A few quick details. We don't need much." |
| Inputs | `input.text` name; `input.text` year of birth (optional, with skip); timezone picker (auto-detected, editable) |
| CTA | `button.primary` "Continue" (disabled until name filled) |
| Tab bar | Hidden during onboarding |
| Tone | Reassuring |

#### Verified copy (D8a §4.1.1)

| Element | String |
| --- | --- |
| Headline | "Welcome. Let's set you up." |
| Body | "A few quick details. We don't need much." |
| Name field label | "What should we call you?" |
| Name field placeholder | "First name is fine" |
| Year-of-birth label | "Year of birth (optional)" |
| Year-of-birth helper | "Helps us frame your readings in context. You can skip this." |
| Timezone label | "Your timezone" |
| Timezone helper | "Auto-detected. Tap to change." |
| Continue CTA | "Continue" |

Writes to `public.users.display_name`, `public.users.year_of_birth` (if entered), `public.users.timezone`. Per D8a §4 data-model implication: a single-row `public.families` is created where the user holds **both `family_owner` and `parent_owner`** roles.

### Sub-screen 4.4.2 — Watch (D8a §4.2)

| Field | Value |
| --- | --- |
| Headline | "Do you have the watch yet?" |
| Body | "No problem either way — we'll guide you through the next step." |
| CTA 1 (top) | `button.primary` "I have it" — caption "Let's pair it now" — routes to Sprint 5 BLE pairing (`watch-pairing.md`, caregiver-local path, the user is the local pairing party) |
| CTA 2 (bottom) | `button.primary` "I need to order one" — caption "Takes you to our shop" — opens Shopify with email pre-filled, sets `watch_pending` flag on user record |

> Both CTAs are `button.primary` (same equal-weight rule as the fork screen — D8a §3.1.2).

#### Watch-pending state (D8a §4.2.1)
If CTA 2 is chosen, the user lands on the home screen with a friendly empty state explaining the watch is on its way. They can still browse Settings, Learn (D9), and the AI assistant. Home reveals normally as soon as the first reading arrives. Tracking link is shown if a Shopify order webhook (D7 ADR-014) confirms shipment.

---

## Pregnancy disclosure (D8a §14.6)

When the user enters a year of birth that places them in plausible childbearing age range (no specific cutoff — **do not gate by age**), a one-time disclosure appears before completing setup:

> **A note about pregnancy**: Kena is not validated for use during pregnancy. If you are pregnant or trying to conceive, please use a clinician-recommended upper-arm monitor instead. We will let you know when we add pregnancy support.
>
> Acknowledgement: `button.primary` "I understand"

- Appears once. Logged to `public.audit_log` per D3 (HIPAA-aligned consent).
- Self-buyers who change country / region / profile to indicate pregnancy in future can re-trigger this.

---

## Voice (D8a §2.3 + `docs/05-voice-and-claims.md`)

Self-buyer-specific anti-patterns (in addition to D8 §1.3):

- **Never** "patient". **Never** "user" in user-facing copy — always "you".
- **Never** "your family" in self-buyer onboarding or home — only after the user actively invites a family member.
- **Never** "you are at risk", "we detected", "you may have". Reading classification language is descriptive ("Elevated"), not predictive.
- **Never** gamify daily wear with streaks, badges, or progress rings.
- **Never** auto-show the AI assistant. Discoverable + opt-in only.
- **Never** up-sell on the home screen. Paywall fires on the same trigger as caregiver mode (6th reading) — not earlier.
- **Never** urgency in onboarding ("don't wait", "start today", "you owe it to yourself").

---

## Sprint 4 acceptance criteria
- All 5 sub-screens render with correct tokens.
- Family + family_members row created with self-buyer holding both `family_owner` AND `parent_owner` roles.
- account_type immutability check passes (no fork branch shown).
- Voice gate passes (including verified copy strings exact-match).
- Pregnancy disclosure fires once, writes audit-log entry, never repeats unless re-triggered.
- Component + integration tests covering the full flow.

---

## Diff vs caregiver flow
Per D8a §1.1 diff convention — **SUPERSEDES** D8 §4.4 (Family Setup) for the self-buyer track only. Caregiver §4.4 remains as written for `account_type = 'caregiver'`.

| Element | Diff vs caregiver flow |
| --- | --- |
| Intros | **AMENDS** — different copy + illustrations; same 3-screen pattern |
| "You" sub-screen | **AMENDS** — adds optional year-of-birth; pronoun chip-select removed |
| "Who you're looking after" sub-screen | **SUPERSEDES** — REMOVED. No parent record; user is both wearer and watcher. |
| "Watch" sub-screen | **AMENDS** — removes ship-to-parent path; adds Shopify-order-for-self path |
| Data model | **AMENDS** — single-row family, user is both `family_owner` AND `parent_owner` |
