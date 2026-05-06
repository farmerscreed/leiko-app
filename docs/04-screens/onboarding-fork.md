# Screen — Onboarding Fork

The single most important screen in the app. Sets `account_type` (immutable per D8a §14.1).

Sourced from D6 US-1, D8a §3 (full ADDS — this is a new screen 4.2.0 inserted before D8 §4.2).

> **Per CLAUDE.md + D8a §1.3**: `account_type` is **IMMUTABLE** after onboarding. There is no migration path. Switching modes requires support intervention. This is intentional — it forces a clean implementation rather than a leaky toggle.

---

## Audience
First-time users (after splash, **before sign-in**). The fork itself does not yet know which persona is in front of it.

## Purpose
Capture the single most important fact about this user: are they buying for someone else, or for themselves?

| `account_type` | Track |
| --- | --- |
| `caregiver` | D8 caregiver track (`caregiver-onboarding.md`) |
| `self_buyer` | D8 + D8a self-buyer track (`self-buyer-onboarding.md`) |
| `parent` | Set by invitation acceptance (skips this screen) |

---

## Skip rule (Q-D8a-1, default Yes)

Users who arrive via a caregiver invitation link (Universal Link → `leiko://pair?token=...` or `https://pair.leiko.app/{url_token}`) **never see this fork**. The invitation flow sets `account_type = 'parent'` before the fork screen renders.

---

## Layout (D8a §3.1)

| Element | Spec |
| --- | --- |
| Container | Standard screen, `color.surface.base` (cream) |
| Logo | Leiko mark, 96pt, centred top, `color.brand.primary` |
| Headline | `type.display-l`, `color.text.primary` |
| Body | `type.body-l`, `color.text.secondary`, max-width 280pt |
| CTA 1 (top) | **`button.primary`** — "Someone I care for" |
| CTA 1 caption | `type.caption`, `color.text.secondary`, centred, `spacing.xs` above |
| CTA 2 (bottom) | **`button.primary`** — "Myself" |
| CTA 2 caption | Same style as CTA 1 caption |
| Spacing between buttons | `spacing.l` (16pt) |
| Sign-in link (Sprint 2 addition) | `type.body-m`, prose `color.text.secondary` + "Sign in" word `color.brand.primary` weight 600. Centred below CTA 2 with `spacing.xxl` above. **Tertiary** — not a CTA. Equal-visual-weight rule for the two CTAs (D8a §3.1.2) is preserved because this link sits below them and at smaller type. |
| No back button | This is the first interactive screen |
| Tab bar | Hidden during onboarding |

> **Why both CTAs are `button.primary`** (D8a §3.1.2): in caregiver-only positioning, the temptation is to make "Someone I care for" navy and "Myself" outline. That subtly biases self-buyers toward the wrong path. Equal visual weight respects the user's choice.

---

## Verified copy (D8a §3.1.1)

| Element | String |
| --- | --- |
| Headline | **"Who are you setting up for?"** |
| Body | "Leiko works for both — the path just looks a little different." |
| CTA 1 label | "Someone I care for" |
| CTA 1 caption | "A parent, partner, or other family member" |
| CTA 2 label | "Myself" |
| CTA 2 caption | "I have or want to track my own blood pressure" |
| Sign-in link prose | "Already have an account? Sign in" — sentence-cased, "Sign in" is a verb-action (D8 §6 voice rules). Tap routes to the SignIn screen, which calls `signInWithOtp` with `shouldCreateUser=false` so a typo'd email cannot create a fresh account. |

---

## Behaviour

1. User taps "Someone I care for" → caches `account_type = 'caregiver'` in MMKV → routes to D8 §4.2.1 caregiver onboarding (`caregiver-onboarding.md`).
2. User taps "Myself" → caches `account_type = 'self_buyer'` in MMKV → routes to D8a §3.3 self-buyer onboarding screens 4.2.4–4.2.6 (`self-buyer-onboarding.md`).
3. The MMKV cache is committed to `public.users.account_type` on account creation (after sign-in / sign-up, which happens later in the onboarding flow).

The write happens **client-side then server-side**: an MMKV pending flag is set immediately, then a write to `public.users` via Supabase. If the write fails, MMKV is cleared and the user sees a friendly error sheet ("We couldn't save your choice. Try again?").

---

## Voice (D8a §2.3 anti-patterns + `docs/05-voice-and-claims.md`)

- **Sentence-case headline.** "Who are you setting up for?" — not "Who Are You Setting Up For?".
- Per `docs/05-voice-and-claims.md`: never "patient", never "loved one" as a category — but "someone I care for" is acceptable as the user's framing of the relationship.
- Acknowledge irreversibility implicitly via the framing — D8a §1.3 says switching modes requires support, but **don't** show a scary warning at this stage. The user just wants to start.

---

## Empty / loading / error states

- **No empty state** — this screen has content from the moment it loads.
- **Loading state**: covered by Splash; this screen is rendered already-resolved.
- **Error state on tap**: bottom sheet with friendly cause + "Try again". Do not block — preserve fork choices.

---

## Accessibility

- Each CTA has `accessibilityRole: "button"`, `accessibilityLabel` matching visible text + sub-text caption.
- Headline: `accessibilityRole: "header"`.
- VoiceOver order: logo → headline → body → CTA 1 + caption → CTA 2 + caption.
- Caption text (under each CTA) is grouped with its CTA for screen-reader purposes — read as a single unit, not as a separate element.

---

## Sprint 2 acceptance criteria

- Both CTAs write the correct `account_type` to `public.users` after sign-in / sign-up completes.
- The selection is **immutable** — RLS policy or trigger prevents subsequent updates (`docs/01-data-model.md`).
- Voice gate passes (no forbidden phrases).
- Component tests cover both fork paths.
- Invitation-link path skips the fork entirely (sets `account_type = 'parent'` before render).
- Both CTAs use **`button.primary`** with equal visual weight (verified visually + via component test).
