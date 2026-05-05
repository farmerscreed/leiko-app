# Component — Bottom Sheet

The **primary modal pattern** in Kena. Full-screen modals are reserved for paywall and onboarding only. Centered dialog modals are NOT used.

Sourced from D8 §3.7. Implementation at `apps/mobile/src/components/BottomSheet.tsx`.

> **Sprint 1 risk note** (D10 §7 Sprint 1 risk): the bottom sheet is the trickiest component — drag-to-dismiss + reduced-motion + keyboard avoidance. Budget extra time.

---

## Anatomy

- **Surface**: `color.surface.elevated` (white), `radius.l` on top corners, `radius.none` on bottom.
- **Drag handle**: 4pt high, 32pt wide, `color.border.default`, centered, `spacing.s` from top.
- **Backdrop**: navy at `opacity.scrim` (0.55).
- **Padding**: `spacing.2xl` horizontal, `spacing.l` vertical.
- **Optional header**: title (`type.title`) + close button (top-right, 24pt `X`).
- **Content**: scrolls if exceeds 70% of screen height; otherwise sized to content.
- **Optional action row**: primary CTA full-width OR primary + ghost cancel side-by-side.

---

## Behaviour

- **Open**: slide up from bottom over `motion.slow` (320ms) with `ease.decelerate`.
- **Dismiss**:
  - Drag down past 30% of sheet height
  - Tap backdrop
  - Tap close X
- **Confirmed-urgent action sheets do NOT dismiss on backdrop tap** — require explicit acknowledge tap on the primary action.
- At keyboard open, sheet pushes up to keep input visible (`KeyboardAvoidingView`). Keyboard dismiss returns sheet to original height.

### Reduced motion (`docs/02-design-tokens.md` §6.3)
- `motion.slow` → `motion.fast` (120ms).
- **Per CLAUDE.md anti-pattern**: "bottom-sheet appears as hard cut, not slide" under reduced motion. Use `motion.instant` (0ms) to make it a hard cut.
- Drag-to-dismiss still works; visual transitions are instant.

---

## Sizing variants

| Variant | Initial height | Expandable to | Used for |
| --- | --- | --- | --- |
| `compact` | Sized to content (max 50% screen) | Not expandable | Quick action sheet, simple confirm |
| `default` | 60% screen | 90% on drag-up | **Default** — Inline Explainer (`docs/08-learn-module.md`), reading actions |
| `tall` | 80% screen | 95% on drag-up | Bottom-sheet forms (add note, add manual reading) |
| `full` | 95% screen | n/a | Edge case only — prefer a navigation push |

---

## Confirmed-urgent variant

When used as the dispatcher for a confirmed-urgent reading:
- Backdrop is non-dismissible (no backdrop-tap close).
- Drag-to-dismiss is **disabled**.
- Primary action is required to dismiss ("OK, I've called").
- Surface still white (not crimson — the banner above provides the urgency cue).

---

## Accessibility

- Trap focus inside the sheet while open.
- `accessibilityViewIsModal: true` on iOS.
- On Android, `importantForAccessibility="yes-hide-descendants"` on the underlying screen.
- Close button has `accessibilityLabel: "Close"` and `accessibilityRole: "button"`.
- Backdrop tap announces "Closes sheet" via `accessibilityHint`.
- Drag handle has `accessibilityLabel: "Drag to dismiss"` and is reachable via screen reader.

---

## Voice rules

- Title is a single short phrase, sentence case ("Add a note", "Pair watch").
- Action row: primary verb + object; cancel is a single word ("Cancel", "Not now").
- No fear language. No countdown timers in sheets.

---

## Sprint 1 deliverables

- `BottomSheet.tsx` with `compact`, `default`, `tall` sizing variants
- Drag-to-dismiss with 30% threshold
- Reduced-motion path (hard cut)
- Keyboard-avoidance behaviour
- Confirmed-urgent variant (non-dismissible backdrop)
- Component tests: opens, closes, dismisses on drag, traps focus
- Storybook entry showing each sizing variant + confirmed-urgent variant
