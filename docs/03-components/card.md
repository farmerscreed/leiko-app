# Component — Card

Generic surface container used across Home, Settings, Trends, and Reading Detail. Specialised variants exist for readings (`reading-card.md`) and for empty states (D8 §3.11). This file describes the **base Card**.

Sourced from the implicit pattern across D8 §3 (cards on cream do not cast shadows; cards on white surfaces use `elevation.low`). Implementation at `apps/mobile/src/components/Card.tsx`.

---

## Anatomy

- **Container**: `color.surface.subtle` background (taupe `#E8E2D5`), `radius.m` (12pt), padding `spacing.l` (16pt) all sides, **no shadow on cream**.
- **Optional header row**: title (`type.title`) + optional trailing chevron / value / icon.
- **Optional sub-header**: `type.caption`, `color.text.secondary`.
- **Body**: any content (text, list rows, embedded chart, etc.).
- **Optional footer row**: actions (one-line, right-aligned) or sources / metadata.

---

## Elevation variants (D8 §2.5)

| Variant | Surface | Elevation token | Used for |
| --- | --- | --- | --- |
| `default` | `color.surface.subtle` (taupe) on `color.surface.base` (cream) | `elevation.none` | Default — cards on home, list cards |
| `low` | `color.surface.elevated` (white) on `color.surface.base` (cream) | `elevation.low` | Cards in modals, paywall sub-sections |
| `medium` | `color.surface.elevated` (white) | `elevation.medium` | Bottom-sheet content cards (rare) |
| `high` | `color.surface.elevated` (white) | `elevation.high` | Confirmed-urgent banner card |

> Shadows are tinted **navy** (not pure black). Pure black on cream becomes muddy gray. See `docs/02-design-tokens.md` §5.

---

## Behavioural variants

| Variant | Behaviour |
| --- | --- |
| `static` | Default — non-tappable. |
| `tappable` | Wraps `Pressable`; press feedback `0.98` scale over `motion.fast`. Surfaces pressed background 4% darker. Adds `accessibilityRole: "button"`. |
| `swipeable` | Optional swipe actions (used in Family screen for "remove member"). Implemented with `react-native-gesture-handler` `Swipeable`. Reduced-motion: long-press shows actions instead. |

---

## States

| State | Visual |
| --- | --- |
| `default` | As specified |
| `pressed` (tappable only) | Scale `0.98`, background 4% darker over `motion.fast` |
| `disabled` | `opacity.disabled` (0.40) on the whole card; press feedback removed |
| `loading` | Skeleton overlay (D8 §3.12) over body content; header remains visible |

---

## Accessibility

- Static cards: no `accessibilityRole`.
- Tappable cards: `accessibilityRole: "button"`; `accessibilityLabel` describes the destination ("Mum's reading card, opens reading detail").
- Don't nest tappable elements inside a tappable card — flatten or use a static card with internal buttons.

---

## Anti-patterns (CLAUDE.md)
- **Don't add a shadow on cream**. Cards live flat by default.
- **Don't use white as a base background**. White is for elevated surfaces only.
- **Don't add count badges, "new" dots, or unread indicators** to cards. Per CLAUDE.md anti-pattern list.

---

## Sprint 1 deliverables

- `Card.tsx` accepting elevation variant + behavioural variant + children
- Composes children with `spacing.l` internal padding
- `tappable` variant wraps `Pressable` and exposes `onPress`
- Component tests: renders, props, a11y label
- Storybook entry showing each elevation × behavioural combo
