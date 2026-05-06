# ADR-0004: Add react-native-gesture-handler + react-native-reanimated to the mobile stack

- **Status**: Accepted
- **Date**: 2026-05-06
- **Sprint**: 1 (design system — BottomSheet)
- **Extends**: `docs/00-tech-stack.md` Mobile section

## Context

`docs/00-tech-stack.md` does not pin an animation or gesture library. The choice was deferred until a real consumer demanded it.

Sprint 1 ships the BottomSheet (`docs/03-components/bottom-sheet.md`, D8 §3.7) — the **primary modal pattern** in Leiko. Acceptance criteria:

- Drag-to-dismiss with a 30% threshold.
- Slide-up over `motion.slow` (320ms), `ease.decelerate`.
- Reduced-motion → hard cut (CLAUDE.md anti-pattern: "bottom-sheet appears as hard cut, not slide" under reduced motion).
- Keyboard-avoidance (sheet pushes up to keep input visible).
- Focus trap (`accessibilityViewIsModal: true` on iOS, `importantForAccessibility="yes-hide-descendants"` on Android).
- Confirmed-urgent variant — backdrop non-dismissible, drag-to-dismiss disabled.

BottomSheet is reused across many sprints — the Inline Explainer (Sprint 11+), manual reading entry (Sprint 6), the anomaly dispatcher (Sprint 15), settings sub-flows (Sprint 10), paywall (Sprint 10). The interaction quality of this one component has outsized influence on perceived product quality.

The same animation question shows up smaller in Card and Button, where the spec calls for "scale 0.98 over `motion.fast`" press feedback. Both Card and Button currently ship with **static** press transforms (via `Pressable`'s `pressed` callback), since there's no animation library to honour the timing.

## Decision

Add two packages to the locked mobile stack at the SDK 54 `bundledNativeModules` pins:

- `react-native-gesture-handler@2.28.0`
- `react-native-reanimated@4.1.7`

Wire them per their standard install:

1. Add `react-native-reanimated/plugin` as the **last** plugin in `apps/mobile/babel.config.js`.
2. Wrap the React tree in `<GestureHandlerRootView>` at `apps/mobile/App.tsx`.
3. `npx expo prebuild --clean --platform android` to regenerate native folders so the auto-link picks up both libraries.

Update `docs/00-tech-stack.md` Mobile section to record the pin.

## Rationale

1. **Founder brief — "Apple feel in a medical device".** The product target is premium-tier interaction quality. RN's built-in `Animated` + `PanResponder` runs on the JS thread; under load the drag/dismiss feels janky on mid-range Android devices. `reanimated` runs on the UI thread, decoupled from JS, and stays at 60fps regardless of JS busy-ness. `gesture-handler` provides the same UI-thread guarantee for the gesture itself.
2. **One library investment, many consumers.** BottomSheet is the first consumer; Card and Button press feedback are the next; Trends chart drag-to-scrub (Sprint 9) is the third; possible swipe-to-dismiss on family-member rows (Sprint 10) is the fourth. Adding the libraries now amortises the cost across the sprint pipeline.
3. **Spec compliance gap.** Card and Button agents both flagged the "scale 0.98 over `motion.fast`" timing as a thing they couldn't deliver without an animation library. We can upgrade them once these libs are in.
4. **Both are Expo-blessed.** Both packages are pinned in Expo SDK 54's `bundledNativeModules.json` manifest, so the version we install is the version Expo's autolinking and Metro tooling expects. `expo install` would give us the same numbers; we pin them explicitly here for traceability.
5. **Healthcare context.** Caregivers reach for the app in low-trust moments — anomaly notifications, manual readings on a sick parent. Interactions that feel reassuring, not stuttery, contribute to clinical trust. Calm-before-clever doesn't mean calm-and-stuttery.

## Consequences

- `apps/mobile/package.json` gains two dependencies pinned exactly to `2.28.0` and `4.1.7`.
- `apps/mobile/babel.config.js` gains `react-native-reanimated/plugin` (last in the plugin array — required by reanimated; the worklet transform must run after every other plugin).
- `apps/mobile/android/` is regenerated via `npx expo prebuild --clean --platform android` so both libraries are auto-linked into the native build.
- `apps/mobile/App.tsx` wraps the tree in `<GestureHandlerRootView style={{ flex: 1 }}>` (gesture-handler's prerequisite — gestures don't fire without it).
- Future SDK bumps must re-pin both packages to the new SDK's `bundledNativeModules.json` manifest. Add this to the Sprint 17 launch checklist.
- Component tests run under `jest-expo`, which auto-mocks both libraries via its `moduleMocks` directory — no test setup change required.

## Alternatives considered

- **Path A — RN built-ins only (`Animated` + `PanResponder`).** Rejected: founder brief is premium feel; the spec's `motion.slow` 320ms ramp is satisfiable, but the UX-thread JS jank is not what a medical app should ship with. Card + Button's static press feedback is the canary — agents already flagged it.
- **Path C — `gesture-handler` only, drop `reanimated`.** Rejected: hybrid leaves animations on the JS thread, defeating the main reason to add gesture-handler. We'd add a library and still not deliver the UX target.
- **`@gorhom/bottom-sheet`.** Rejected per CLAUDE.md anti-pattern *"Don't use a heavy UI lib. The Kena look is calm-before-clever; Material/Chakra/NativeBase will fight that."* Gorhom's library is excellent but ships with its own opinions about content layout, snap points, and theming that would fight our token system. We need the primitives, not the abstraction.
- **Defer the libraries until Sprint 11** (first BottomSheet consumer). Rejected: BottomSheet itself is a Sprint 1 deliverable. Shipping it static-only would mean a re-write when the libraries land. Better to pay the addition cost once.
