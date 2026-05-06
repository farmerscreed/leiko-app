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

---

## Session status — completed 2026-05-06

### Acceptance criteria
- ✅ Each component renders correctly at default size
- ✅ Each component renders correctly in parent-mode (large-text) variant
- ✅ Each component's tap-target meets 48pt (caregiver) / 64pt (parent) — `theme.minTapTarget`
- ✅ Each component has `accessibilityRole` and `accessibilityLabel`
- ✅ Reduced-motion: bottom-sheet appears as hard cut (motion.normal → 0ms)
- ✅ Color tokens match D8 §2.1 hex values exactly (asserted in `tokens.test.ts`)
- ✅ 106 tests pass across 8 suites
- ✅ Voice rules pass on every gallery string (manually reviewed)
- ✅ CI green (`gh run` 25435213833)
- ✅ Demoed on Pixel 8 (founder confirmed gallery renders correctly, 2026-05-06)

### Commit chain
1. `0e17047` feat(theme): add design tokens, ThemeProvider, useTheme, useReducedMotion
2. `c426b55` chore(test): wire jest-expo + RNTL via jest projects split
3. `bf15513` feat(components): add Pill with 6 variants
4. `0dfb340` feat(components): add Card with elevation + behavioural variants
5. `b806ffa` feat(components): add ListRow with 5 variants
6. `24df8f7` feat(components): add Button with 5 variants × 5 states
7. `57e1a98` chore(deps): add gesture-handler + reanimated for premium animations (ADR-0004)
8. `69c2cc0` feat(components): add BottomSheet with drag-dismiss and reduced-motion
9. `0eefd5d` feat(dev): add component gallery + App.tsx dev/prod split

Three rebrand commits also landed during this sprint between the Sprint 0
close and Sprint 1 kickoff (Kena → Leiko, see `memory/brand_pivot_leiko.md`).

### Key decisions
- **ADR-0004** added `react-native-gesture-handler@2.28.0` + `react-native-reanimated@4.1.7` to the locked mobile stack (`docs/_adr/0004-gesture-handler-reanimated.md`). Founder brief: *"Apple feel in a medical device."* BottomSheet ships premium-feel; Card and Button press feedback can be upgraded onto the same plumbing later.
- **jest projects split** — pure-TS tests on ts-jest, RN component tests on jest-expo. Pure tests cannot run under jest-expo without hitting the `expo/winter` teardown crash. See `memory/jest_expo_deferred.md`.
- **Reanimated test mock — hand-rolled** in `apps/mobile/jest.setup.rn.js` because the bundled `react-native-reanimated/mock` re-imports the real module under v4 and fails. Mock surface covers `useSharedValue`, `useAnimatedStyle`, `withTiming`, `runOnJS`, `Easing.bezier`, default `Animated.View`. Extend if Sprint 2+ uses additional reanimated APIs.
- **Worklets babel plugin disabled under `NODE_ENV=test`** in `apps/mobile/babel.config.js`. The plugin only matters for runtime UI-thread workletization (which jest mocks anyway); including it under jest interacts poorly with babel TS parsing.
- **Component icon placeholders** — Sprint 1 substituted Unicode glyphs for Phosphor icons (chevron `›`, check `✓`, close `×`) and `<ActivityIndicator>` for the spinner. See `plans/backlog.md` for the icon-library item.

### Deferred to backlog
- Phosphor (or alternative) icon library — replaces 4 placeholder sites
- `expo-system-ui` package — `userInterfaceStyle: "automatic"` is currently a no-op on Android
- Card / Button animated press feedback — upgrade onto the new reanimated plumbing
- BottomSheet polish: `'full'` size variant, drag-up-to-expand, `'swipeable'` Card variant

### Where to start next
Sprint 2 — Auth + Fork Screen (`plans/sprint-02-auth-and-fork.md`).
Hard dependency on Sprint 1 ✅. Reads: CLAUDE.md, `docs/04-screens/onboarding-fork.md`, `docs/01-data-model.md`, `docs/05-voice-and-claims.md`. Risk note: `account_type` immutability **must** be DB-enforced (RLS or trigger), not client-only.
