# Component — Pill / Chip

Sourced from D8 §3.13. Implementation at `apps/mobile/src/components/Pill.tsx`.

---

## Anatomy

- **Padding**: `spacing.s` horizontal, `spacing.xs` vertical, `radius.full` (999pt — fully rounded).
- **Type**: `type.caption` Bold, all sentence case (never UPPERCASE).
- **Optional 12pt leading icon**, `spacing.xs` gap.

---

## Variants

| Variant | Surface | Text | Used for |
| --- | --- | --- | --- |
| `neutral` | `color.surface.subtle` (taupe) | `color.text.primary` (navy) | Time-range selector, filter chips |
| `info` | `color.surface.subtle` (taupe) | `color.brand.primary-soft` (teal) | Informational tags, "Start here" badge |
| `accent` (`warn`) | `color.brand.accent` (amber) | `color.text.primary` (navy) | Anomaly-noted badge on reading card; calm-concerned status |
| `urgent` | `color.state.urgent` (crimson) | `color.text.on-brand` (white) | Confirmed-urgent badge — reading card + banner only |
| `success` | `color.state.success` at 15% on cream | `color.state.success` (green) | Reading-confirmed-in-range, sync-success |
| `outline` | transparent + 1pt `color.border.default` | `color.text.primary` (navy) | Selectable filter chips, multi-select tags, "3 min read" on Learn cards |

---

## States

| State | Visual |
| --- | --- |
| `default` | As specified |
| `pressed` (selectable variants) | Background 8% darker over `motion.fast` |
| `selected` (filter chips) | Variant flips to `accent` styling; icon adds Phosphor `Check` (12pt) |
| `disabled` | `opacity.disabled` (0.40) on the whole chip |

---

## Accessibility

- Static pills (read-only badges): `accessibilityRole: "text"`, `accessibilityLabel` describing what the pill conveys ("Anomaly noted, badge").
- Selectable filter chips: `accessibilityRole: "button"`, `accessibilityState: { selected: boolean }`.
- Color is **never** the sole signal for status — combine with icon + text per `docs/02-design-tokens.md` §1.3 contrast rule.

---

## Voice rules

- Pill text is a noun or short noun phrase, never a sentence. "Anomaly noted", "Today", "Stage 1".
- For status badges: avoid "Alert", "Warning", "Critical". Use "Worth a look" / "Talk to Dad now" patterns from `docs/05-voice-and-claims.md`.

---

## Anti-patterns
- **No count badges** on pills (per CLAUDE.md anti-pattern: "Show count badges, 'new' dots, or unread indicators on Learn cards" — forbidden).
- **No "NEW" pill** that pulses or auto-rotates.
- **Don't use crimson `urgent` outside reading-card and banner** contexts. Crimson is reserved.

---

## Sprint 1 deliverables

- `Pill.tsx` with all 6 variants
- Pressed + selected states for selectable variants
- Component tests: each variant renders + a11y role + label
- Storybook entry showing each variant in default + pressed + selected (where applicable)
