# Sprint 1.5 — Visual System v2 Token Rollout

## Goal
Migrate `apps/mobile/src/theme/` from the cream/navy/amber tokens (D8) to the dark-canonical Apple-of-Healthcare system (D12). Both modes (dark canonical, light variant) ship together. Every existing component re-skinned. **No new screens or features in this sprint** — pure visual migration. Functional parity required.

## Duration
~1.5 work-weeks.

## Hard dependencies
D12 founder sign-off **(complete — 2026-05-07; see D12 §17)**. No external designer engaged for v1.0; engineering defaults approved in lieu (see Decisions section below). Motion easing tunings remain a "feel-test" item — tunable inside this sprint, not a precondition to start.

## Docs to load
docs/_reference/D12-visual-system-v2.md, CLAUDE.md.

## Decisions (locked 2026-05-07)
The three D12 sign-off items that previously gated this sprint are resolved. The agent picking this up should treat these as final — do not re-litigate during planning.

- **Dark canonical neutral**: `#0A0F1A` (D12 §2 `palette.midnight.900`)
- **Brand accent**: `#E8A063` (D12 §2 `palette.amber.500`)
- **Typeface stack**: **Inter** (display + body + UI, weight-differentiated) + **JetBrains Mono** (tabular numerics). Both free OFL. **No Recoleta**, no Söhne, no Reckless Neue. Display-face roles in D12 §3.2 resolve to Inter Bold / Black. AI narration on Daily Pulse uses Inter Italic SemiBold (D12 §10/§3.1 substitute for the original Recoleta italic-leaning treatment).
- **Premium typeface budget**: **$0**. v1.1 may revisit if brand polish becomes the limiting factor.

## Deliverables
- New `src/theme/tokens/` folder per D12 §12.1: `color.ts`, `typography.ts`, `spacing.ts`, `radii.ts`, `elevation.ts`, `motion.ts`, `opacity.ts`, `haptics.ts`, `icon.ts`, `index.ts`
- `ThemeProvider` rewritten to resolve raw → semantic per active mode (System / Always Dark / Always Light)
- Mode switch persisted in MMKV
- All existing components migrated to new tokens, one at a time: Button, Card, ListRow, Pill, BottomSheet, ReadingCard, Sparkline, TimezonePicker, PageIndicator
- Reanimated 3 spring + heartbeat easing curves wired
- BlurView (`@react-native-community/blur`) installed for glass surfaces
- `tools/tokens-export/` Style Dictionary config produces JSON for Figma sync
- Old `tokens.ts` deleted after last consumer migrates
- Visual diff captured per component (before/after screenshots in dark + light)

## Acceptance criteria
- Every existing screen renders cleanly in both modes — no broken layouts, no contrast failures
- Voice rules continue to pass on every user-visible string (no copy changes in this sprint)
- WCAG 2.2 AA verified on every foreground/background pairing in both modes
- Reduced-motion behaviour verified — `motion.cinematic`/`slow` collapse to `fast`/`instant`
- Reanimated motion runs UI-thread-only (no JS-thread frame work) — verify with Reactotron Performance Monitor
- All `apps/mobile/__tests__/` tests pass
- Component gallery (`src/dev/ComponentGallery.tsx`) shows every component in every state in both modes
- Tokens-export JSON validates against Style Dictionary schema

## Open prompt
Sprint 1.5 — Visual System v2 Token Rollout. Read CLAUDE.md, then docs/_reference/D12-visual-system-v2.md.

Propose:

1. Migration order — which component first, which last (Button first is recommended)
2. ThemeProvider API surface — does any consumer need to break?
3. BlurView strategy on Android < 12 (fallback to opacity-tinted overlay per D12 §12.5)
4. Visual-diff capture method (Detox snapshots? manual?)
5. Whether SVG → Skia migration for VitalRing happens here or deferred to Sprint 7.6

Wait for approval.

## Risk notes
- Token migration cascades. Plan for at least one round of "this component looks slightly off in dark" before sign-off.
- Inter-only typography (no Recoleta) means hierarchy is carried entirely by weight + size. Watch the Daily Pulse hero and AI narration in particular — if they read "utilitarian" rather than "premium," flag it during the visual-diff review. Re-opening the typeface budget is a v1.1 conversation, not a Sprint 1.5 detour.
- Reduced motion is testing-easy-to-miss. Ship with explicit checks in CI.
- Motion easing values in D12 §7 are starting points. Feel-test inside the sprint and adjust if anything reads wrong; don't block on a designer for tuning.
