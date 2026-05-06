# Sprint 1 — Design System

## Goal
Implement the design tokens from D8 §2 as a ThemeProvider, then build the five base components every screen will use: button, card, list-row, bottom-sheet, pill. Each in three states (default, pressed, disabled) plus parent-mode large-text variant.

## Duration
~1 work-week.

## Hard dependencies
Sprint 0.

## Docs to load
docs/02-design-tokens.md, docs/03-components/button.md, docs/03-components/card.md, docs/03-components/list-row.md, docs/03-components/bottom-sheet.md, docs/03-components/pill.md, docs/05-voice-and-claims.md.

## Deliverables
- apps/mobile/src/theme/ — tokens, ThemeProvider, useTheme hook
- apps/mobile/src/components/Button.tsx with variants: primary, secondary, ghost, destructive
- apps/mobile/src/components/Card.tsx with elevation variants: low, medium, high
- apps/mobile/src/components/ListRow.tsx with variants: standard, navigation, value, switch
- apps/mobile/src/components/BottomSheet.tsx with drag handle, backdrop, dismiss
- apps/mobile/src/components/Pill.tsx with status variants: neutral, info, warn, urgent
- Storybook OR a `/dev/components` route that renders every component for visual review

## Acceptance criteria
- Each component renders correctly at default size
- Each component renders correctly in parent-mode (large-text) variant
- Each component's tap-target is at least 48pt (or 64pt in parent-mode)
- Each component has accessibilityRole and accessibilityLabel
- Reduced-motion: bottom-sheet appears as hard cut, not slide
- Color tokens match D8 §2.1 hex values exactly

## Test plan
- Component test for each of the 5 components: renders, snapshot, accessibility props
- Theme test: useTheme returns expected token values

## Open prompt
Sprint 1 — Design System. Read CLAUDE.md, then docs/02-design-tokens.md and the 5 component files in docs/03-components/.

Propose:

1. The folder structure under apps/mobile/src/theme/ and src/components/
2. The order in which you'll build the 5 components and why
3. The /dev/components route OR Storybook setup — your recommendation, with a one-line justification
4. Any token in D8 §2 that's ambiguous to implement directly

Wait for approval.

## Risk notes
- The bottom-sheet is the trickiest — drag-to-dismiss + reduced-motion + keyboard avoidance. Budget extra time.
- Don't use a heavy UI lib. The Leiko look is calm-before-clever; Material/Chakra/NativeBase will fight that.
