# ADR-0005: Add @kingstinct/react-native-healthkit + react-native-health-connect to the mobile stack

- **Status**: Accepted
- **Date**: 2026-05-09
- **Sprint**: 9.5 (Apple Health + Health Connect Integration)
- **Extends**: `docs/00-tech-stack.md` Mobile section

## Context

`docs/00-tech-stack.md` does not pin a platform-health library. The choice was deferred until Sprint 9.5, when D13 §12 promoted Apple Health + Health Connect integration from v1.1 to v1.0 ("Apple-of-Healthcare positioning — not having Apple Health integration would be a credibility wound").

The sprint card (`plans/sprint-09-5-health-platform-integration.md` §Open prompt #1) proposes `react-native-health` for iOS and `react-native-health-connect` for Android, qualified with "confirm against `docs/00-tech-stack.md` or propose alternatives."

When we evaluated the iOS pick, three facts moved us off the proposal:

1. **`react-native-health` is stale.** Latest release `1.19.0` is from 2024-10-15 — ~18 months old at the time of writing. Peer-dependency ceiling is `react-native >= 0.67.3`; nothing in the package metadata or recent commits indicates New Architecture (Fabric / TurboModules / Nitro) compatibility.
2. **Our app runs the New Architecture.** `apps/mobile/app.json` has `"newArchEnabled": true`. Expo SDK 54 + React 19 + RN 0.81.5 + new arch is the same envelope that forced the MMKV 2.x → 4.x bump (`docs/00-tech-stack.md` line 22). MMKV 4.x runs on **Nitro Modules**.
3. **A maintained, Nitro-native alternative exists.** `@kingstinct/react-native-healthkit` `14.0.0` was published 2026-04-08 (~4 weeks ago). Its peer dependencies are `react >= 19`, `react-native >= 0.79`, `react-native-nitro-modules >= 0.35` — exactly the stack we already run. It ships an Expo config plugin (`app.plugin.js`) for native module installation.

For Android the proposal stands: **`react-native-health-connect` `3.5.0`** was published 2025-11-22, peers on `@expo/config-plugins >= 6.0.2`, supports the Health Connect record types D13 §12.4 names (`BloodPressureRecord`, `HeartRateRecord`, `OxygenSaturationRecord`, `SleepSessionRecord`, `StepsRecord`, `ActiveCaloriesBurnedRecord`).

## Decision

Add three packages to the locked mobile stack:

- `@kingstinct/react-native-healthkit@14.0.0` — iOS HealthKit bindings (Nitro)
- `react-native-health-connect@3.5.0` — Android Health Connect bindings
- `react-native-nitro-modules@0.35.6` — promote from transitive (via MMKV 4.x) to direct dep, so the kingstinct lib's peer dep is satisfied explicitly and a future MMKV bump cannot drift it

Wire them per their standard Expo config-plugin install:

1. Add both Expo plugins to `apps/mobile/app.json` `expo.plugins`.
2. Add `NSHealthShareUsageDescription` + `NSHealthUpdateUsageDescription` to `app.json` `ios.infoPlist` (Sprint 9.5 Task 9 authors the copy through the voice gate).
3. Add Health Connect permissions to `app.json` `android.permissions` (Sprint 9.5 Task 9).
4. `npx expo prebuild --clean` to regenerate native folders so autolinking picks both up.
5. Hand-rolled Jest mocks for both libraries in `apps/mobile/jest.setup.ts` (jest-expo does not ship moduleMocks for either — same pattern as the gesture-handler / reanimated mocks per the `jest_expo_deferred` memory note).

Update `docs/00-tech-stack.md` Mobile section to record the three pins.

## Rationale

1. **New Architecture compatibility is non-negotiable.** Disabling new arch to ship `react-native-health` would also break MMKV 4.x and reanimated 4.x (both depend on it). That cost is structural, not a one-time fix.
2. **Nitro is already in the stack.** MMKV 4.x runs on Nitro per ADR-0002's downstream consequences. Adding a second Nitro consumer doesn't widen our native-module surface area; it amortises the runtime cost.
3. **Maintenance velocity.** April 2026 vs October 2024. An 18-month-stale BLE-adjacent library on a regulated medical app is a risk we don't need to take when an actively-maintained equivalent exists.
4. **API parity for our needs.** D13 §12.2 names six iOS HealthKit identifiers (BP correlation, HR, SpO2, Sleep with stages, StepCount, ActiveEnergyBurned). All six are first-class in `@kingstinct/react-native-healthkit`. The kingstinct API is typed end-to-end (no `any` escape hatches like react-native-health uses for its options bags), which means TypeScript strict catches mistakes the older lib would shrug off.
5. **Adapter isolation.** All platform-specific imports live behind `services/health-platform/` (Sprint 9.5 Task 3). The rest of the codebase imports the unified surface, never the lib directly. If the kingstinct project ever stalls, swapping libs is a one-folder change.

## Consequences

- `apps/mobile/package.json` gains three dependencies pinned exactly to `14.0.0`, `3.5.0`, `0.35.6`.
- `apps/mobile/app.json` `expo.plugins` gains two entries (`@kingstinct/react-native-healthkit`, `react-native-health-connect`). Info.plist + Android manifest entries land in Task 9.
- `apps/mobile/android/` and (newly) `apps/mobile/ios/` are regenerated via `npx expo prebuild --clean` so both libraries are auto-linked.
- `apps/mobile/jest.setup.ts` gains hand-rolled mocks for both modules, joining the existing reanimated / gesture-handler / MMKV mock stack. Per the `jest_expo_deferred` memory: don't simplify the mock layout.
- App Store review now requires HealthKit entitlement justification (Apple-flagged review category, ~2 days extra per the sprint card's Risk Notes). Captured in Task 9 + the Sprint 17 launch checklist.
- Health Connect on Android < API 26 silently degrades — toggle disabled with calm explainer, no error. Min SDK 24 in `apps/mobile/android/build.gradle`; the missing-HC code path must be covered by a unit test.
- iOS deployment target stays at Expo SDK 54's default (15.1). Sleep-stage subtype identifiers `inBedToAsleep` / `asleepCore` / `asleepDeep` / `asleepREM` exist on iOS 16+; on iOS 15.x the mapper falls back to `inBed` + `asleep` only. Runtime check, not a build-target bump.

## Alternatives considered

- **Stay with `react-native-health`.** Rejected: see Context #1. Our New Architecture posture makes it an active liability, not just a trade-off.
- **Disable New Architecture.** Rejected: cascades into MMKV / reanimated downgrades, which themselves were the subject of Sprint-2-era ADR work. Walking back two prior decisions to enable a third one is a poor trade.
- **Build a thin Swift module ourselves.** Rejected: the exact bindings we'd write are what kingstinct ships, with type tests + a four-week-fresh release cadence. Not where engineering time should go.
- **Defer the iOS path to v1.1 and ship Android-only at v1.0.** Rejected: D13 §12 explicitly promoted iOS to v1.0 for credibility reasons. Caregiver demographic (45–60 in the US market) skews iOS; shipping HC-only would fail the "Apple-of-Healthcare" framing.
