# Component — Button

Sourced from D8 §3.1. Implementation lives at `apps/mobile/src/components/Button.tsx`. Storybook story at `apps/mobile/src/components/Button.stories.tsx` enumerates every state.

---

## Anatomy

- **Container**: padding `spacing.l` horizontal, `spacing.m` vertical, `radius.m`, **min-height 48pt** (touch target — 64pt in parent mode per `docs/02-design-tokens.md` §8).
- **Optional leading icon**: 16pt, `spacing.xs` gap before label.
- **Label**: `type.label` (caregiver) or `type.body-l` (parent flows).
- **Optional trailing icon**: only for "external" or "navigate" affordance, never for primary action.

---

## Variants

| Variant | Background | Text | Border | Used for |
| --- | --- | --- | --- | --- |
| `primary` | `color.brand.primary` (navy) | `color.text.on-brand` (white) | none | Single primary action per screen |
| `accent` | `color.brand.accent` (amber) | `color.text.primary` (navy) | none | CTA on paywall, confirm-pairing, confirm-anomaly-noted. **Reserved.** |
| `secondary` | transparent | `color.brand.primary` (navy) | 1pt `color.brand.primary` | Secondary action on the same screen as primary |
| `ghost` | transparent | `color.brand.primary-soft` (teal) | none | Tertiary or text-style actions ("Cancel", "Skip") |
| `destructive` | transparent | `color.state.urgent` (crimson) | 1pt `color.state.urgent` | Remove family member, delete account, sign out from all devices |

> **Rule**: only one `primary` per screen. If a screen has two equally-weighted actions, both are `secondary` and the more-positive verb gets `accent`.

---

## States (apply to every variant)

| State | Visual change |
| --- | --- |
| `default` | As specified in variant table |
| `pressed` | Background darkens 8% (or lightens 8% for ghost/secondary). Scale 0.98 over `motion.fast`. |
| `disabled` | `opacity.disabled` (0.40) on whole button. No press feedback. Cursor `not-allowed` on web. |
| `loading` | Label hidden; spinner (Phosphor `CircleNotch`, rotating, `motion.linear` duration 1s) replaces it. Button keeps pressed-look. |
| `focused` | 3pt `color.focus.ring` outline at 2pt offset — keyboard / TalkBack only. |

---

## Accessibility

- `accessibilityRole: "button"`
- `accessibilityLabel`: same as visible label, plus state suffix when relevant ("Sign in, button, loading").
- `accessibilityHint`: only when action is non-obvious from label ("Opens paywall").
- Min 48×48pt hit area enforced via padding — **never** via marginless invisible padding.
- Disabled buttons: `accessibilityState: { disabled: true }`.

---

## Voice rules

Per `docs/05-voice-and-claims.md`:
- **Verb + object** CTAs: "Pair watch", "Add a family member", "Sign in".
- Avoid "Continue", "OK", "Submit", "Next" alone — they don't tell the user what will happen.
- One word for cancel: "Cancel", "Skip", "Not now".
- Friendly when irreversible: "Yes, sign me out everywhere" — not "Confirm".

---

## Sprint 1 deliverables

- `Button.tsx` with all 5 variants
- All 5 states implemented
- Parent-mode (large-text, 64pt min height) variant
- `accessibilityRole`, `accessibilityLabel` on every render
- Component test (RNTL): renders default + each state + a11y label
- Storybook / `/dev/components` route entry showing every variant × state matrix
