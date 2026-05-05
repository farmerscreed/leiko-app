# Component — List Row

Sourced from D8 §3.5. Implementation at `apps/mobile/src/components/ListRow.tsx`.

---

## Anatomy

- **Min height** 56pt, padding `spacing.l` horizontal.
- **Optional leading**: avatar (40pt) or icon (24pt).
- **Title**: `type.body-l`.
- **Optional subtitle**: `type.body-s`, `color.text.secondary`, below title.
- **Optional trailing**: chevron, switch, status pill, badge, value (`type.body-l`, monospace if numeric).
- **Divider**: 1pt `color.border.default` below the row, full width except first/last in section.

---

## Variants

| Variant | Trailing | Use |
| --- | --- | --- |
| `navigation` | Chevron right (Phosphor `CaretRight`, 16pt, `color.text.secondary`) | Settings rows, family-member rows, history rows |
| `toggle` | Native switch | Notification preferences, large-text mode |
| `action` | None | Sign out, delete account — pair with `destructive` text style |
| `data` | Value (right-aligned, monospace if numeric) | Profile fields ("Phone: +234…"), reading history rows |
| `select` | Check icon when selected (Phosphor `Check`, 20pt, `color.brand.primary`) | Single-select option lists — timezone, language |

---

## States

| State | Visual |
| --- | --- |
| `default` | As specified |
| `pressed` (tappable variants) | Background `color.surface.subtle` over `motion.fast` |
| `disabled` | `opacity.disabled` on row content; divider stays at full opacity |
| `selected` (`select` variant) | Check icon visible; row background unchanged |

---

## Accessibility

- `accessibilityRole`: `"button"` for `navigation`/`action`/`select`; `"switch"` for `toggle`; `"none"` for `data`.
- `accessibilityLabel`: title + subtitle composed; for `data` rows, append the value.
- Toggles: `accessibilityState: { checked: boolean }`.
- Min 56pt height already meets 48pt touch target. In parent mode (`docs/02-design-tokens.md` §8), bump to 64pt min.

---

## Voice rules

- Title is a noun phrase, not a sentence ("Notifications", "Privacy & data").
- Sub-title gives context, not duplication ("Daily, weekly, anomaly", not "Notification settings").
- For `action` rows: verb + object ("Sign out", "Delete account"). Use `destructive` style for deletions.

---

## Sprint 1 deliverables

- `ListRow.tsx` with all 5 variants
- Pressed + disabled states for tappable variants
- Switch wired to `Animated` with reduced-motion fallback (instant toggle)
- Component tests: each variant renders + a11y role + label
- Storybook entry showing each variant in default + pressed + disabled
