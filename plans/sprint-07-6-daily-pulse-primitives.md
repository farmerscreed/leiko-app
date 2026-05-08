# Sprint 7.6 — Daily Pulse + Vital Tile Component Primitives

## Goal
Build the D12 component library required by every screen sprint that follows. **No screens consume in this sprint** — purely the primitives. Storybook-equivalent gallery shows every component in every state.

## Duration
~1.5–2 work-weeks.

## Hard dependencies
Sprint 1.5 (token system). Sprint 7.5 (state slices and classifiers).

## Docs to load
docs/_reference/D12-visual-system-v2.md (§11.2), docs/_reference/D13-multi-vitals-constellation-spec.md (§7), CLAUDE.md.

## Deliverables
- `VitalRing.tsx` per D12 §11.2.1 (SVG-based via `react-native-svg`, four sizes, four states)
- `VitalTile.tsx` per D12 §11.2.2 (one-vital summary card, four states, expand-on-press)
- `DailyPulseHero.tsx` per D12 §11.2.3 (the constellation, immersive + card modes, adaptive central value per D13 §7.2)
- `AmbientPulse.tsx` per D12 §11.2.4 (live-pulse motion wrapper)
- `CorrelationStrip.tsx` per D12 §11.2.5 (two-vital overlap chart)
- `AnomalyBanner.tsx` rewrite per D12 §11.2.6 (calm-concerned amber, confirmed-urgent crimson)
- Component gallery extended (`src/dev/ComponentGallery.tsx`) — every component in every state, both modes
- Reduced-motion behaviour verified — live-pulse disables, daily-pulse-reveal collapses to instant final state
- Unit + component tests for all six primitives
- Skia performance check on Pixel 6a baseline — if < 55 fps on the constellation hero with five rings + one pulsing, document the migration path per D12 §12.4

## Acceptance criteria
- All six primitives render in dark + light modes
- `motion.pattern.daily-pulse-reveal` (the signature animation) fires on first paint, ~1400ms total, sequenced BP→HR→SpO2→Sleep→Activity stagger
- Live-pulse animation runs UI-thread-only — Reactotron Performance Monitor confirms zero JS-thread frame work during 60s of pulse
- Reduced motion verified
- Adaptive central value logic per D13 §7.2 (BP if fresh ≤8h → resting HR if today ≤12h → last night's sleep → "—") covered by unit tests
- All vital-color contrast ratios verified per D12 §2.6 (3:1 against surface for graphical objects)
- Snapshot tests cover every (component × state × mode) combination

## Open prompt
Sprint 7.6 — Daily Pulse + Vital Tile Component Primitives. Read CLAUDE.md, then docs/_reference/D12-visual-system-v2.md and docs/_reference/D13-multi-vitals-constellation-spec.md.

Propose:

1. SVG vs Skia decision for VitalRing at v1.0 (D12 recommends ship SVG, profile, migrate if needed)
2. Component test strategy for animated components (snapshot per frame? key-frame only?)
3. Composition pattern for DailyPulseHero — single component vs composed of VitalRings
4. ComponentGallery navigation — by component or by state matrix?
5. How to test reduced-motion deterministically in CI

Wait for approval.

## Risk notes
- The daily-pulse-reveal choreography is the signature visual moment of the app. Spend the time to get the easing right — `ease.cinematic` is the recommended starting point, but feel-test on real device.
- Live-pulse on JS thread is forbidden — if Reanimated worklets aren't holding up, that's a stop-the-line bug, not a "ship it for now."
- Five concurrent SVG arcs at 60fps with one pulsing is on the edge of `react-native-svg` performance. Have the Skia migration ready if profiling fails.

## On-device verification (user-driven, required for sprint close)

The implementation work is complete in code; two acceptance items can only
be measured on a physical device. Both run from `apps/mobile` on the
Pixel 8 (USB + adb reverse per `memory/running_on_phone.md`).

1. **Live-pulse JS-thread check.** Open the dev gallery's "Replay motion"
   button so the live-pulse drives on a VitalRing for at least 60s. With
   Reactotron's Performance Monitor open (or `adb shell dumpsys gfxinfo
   <pkg>` if Reactotron isn't wired), confirm zero JS-thread frame work
   during the 60s window. Pass criterion per the sprint card: live-pulse
   is UI-thread-only.

2. **Constellation FPS profile.** From the same dev gallery section, scroll
   to "DailyPulseHero — immersive" and tap "Replay motion" so the
   choreography fires while one ring is also pulsing. Capture FPS for 60s
   via Reactotron Performance Monitor. The D12 §12.4 baseline is a
   Pixel 6a, but the project's only test device is a Pixel 8 — record on
   the Pixel 8 with the device-gap noted.

   - **≥ 55 fps on Pixel 8** → presumed pass; the Pixel 6a result is
     unverified but the migration path stays available. Sprint closes.
   - **< 55 fps on Pixel 8** → stop-the-line. Open a Sprint 7.6.1 to
     migrate `VitalRing` to `@shopify/react-native-skia` per D12 §12.4.
     The prop contract is the boundary; consumers don't change.

Once both checks land, paste the FPS number + any Reactotron screenshot
into the close-out commit / sprint card body and move the card to
`plans/done/`.

## What this sprint explicitly does NOT ship
- No screens that consume these primitives (Sprint 7.7, 8, 8.5 do that)
- No AI narration generator (Sprint 12.5)
- No real watch data flowing through — primitives consume mock data in this sprint
