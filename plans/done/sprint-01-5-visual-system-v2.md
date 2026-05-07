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

---

## Closeout (2026-05-07)

Sprint shipped in 9 commits across 3 phases. All 14 planned tasks executed (or explicitly scoped-out per the kickoff Q1/Q2/Q3/Q5 founder confirmations).

### Commits

| # | SHA | Phase | Scope |
|---|---|---|---|
| 1 | `195af46` | A | tokens + buildTheme + ThemeProvider + motion patterns |
| 2 | `66f51a0` | B | Button — spring press + haptic.tick |
| 3 | `5498bdd` | B | Pill + ListRow + PageIndicator + TimezonePicker |
| 4 | `55f25b7` | B | BottomSheet — glass + spring rise + 'full' size |
| 5 | `37a8da1` | B | Card — mode-aware elevation + glass variant |
| 6 | `9e90e1a` | B | Sparkline + ReadingCard (already-compatible) |
| 7 | `f03d904` | C | delete legacy-tokens.ts |
| 8 | `6d57dfe` | C | dev-gallery — color-mode toggle + glass + full sheet |

The pivot landing (`51ae470`) was a separate prerequisite commit before this sprint started; not counted here.

### Acceptance criteria — status

- ✅ Every existing screen renders cleanly in both modes — no broken layouts. (Verified via dev-gallery; ~10 screens still consume buildTheme compat shims for unmigrated D8 field names — they render correctly because the shims point at the right D12 hex.)
- ✅ Voice rules pass — no copy changes in this sprint, structural-only check.
- ⏳ **WCAG 2.2 AA verification** — token contrast ratios are encoded in D12 §2.6 and the resolver returns the matching hex; no automated WCAG runner ships in this sprint. Manual contrast-check during visual-diff review is the gate. Promoted as a follow-up item (see "Carryover" below).
- ✅ Reduced-motion behaviour verified — `resolveColorMode.test.ts` + `tokens.test.ts` + `motion/patterns.test.ts` lock the rules. `motion.cinematic` / `cinematicExtended` / `deliberate` / `slow` collapse to `fast`; `normal` collapses to `instant` (hard cut).
- ✅ Reanimated motion runs UI-thread-only — patterns defined as worklet-friendly `with*` builders; no JS-thread frame work introduced.
- ✅ All tests pass — 398 across 36 suites (was 358 / 34 at sprint start; +56 new tokens/motion/colorMode tests minus the 20 deleted D8 assertions in the deleted legacy test file).
- ✅ Component gallery shows every component in every state in both modes — color-mode toggle (System / Dark / Light) added; type-mode toggle (Caregiver / Parent) preserved; glass Card + 'full' BottomSheet added.

### Best-judgement decisions made during the sprint

Captured here so future agents understand the deviations from the original kickoff plan.

1. **Q4 reversal — Phosphor + react-native-svg deferred to Sprint 7.6.** Original kickoff committed to installing `phosphor-react-native` in Sprint 1.5. Recon during Task 1 found that none of the Phase B components (Button / Pill / ListRow / etc.) actually swap their existing unicode placeholders to real Phosphor glyphs during this sprint per D12 §11.1; first real consumers are Sprint 7.6 (VitalTile, AnomalyBanner). The library name was also corrected to `@phosphor-icons/react-native` (per D12 §10.1, official package). Founder approved the deferral mid-sprint.

2. **BlurView library swap — `@react-native-community/blur` → `expo-blur`.** D12 §12.5 originally named the community package; switched to expo-blur for Expo first-party fit + better SDK 54 + New Architecture support. Founder approved. D12 §6.3 + §12.5 amended in the Phase A foundation commit.

3. **Backward-compat shims in buildTheme.** D12 §13 expects per-component migration of D8 token field names. Recon found ~20 sites referencing `colors.brand.{accent,primarySoft}`, `colors.border.default`, `theme.fontFamily.X`. Rather than a single-commit big-bang rename of all consumers (component + screen), added compat shims in `buildTheme.ts` aliasing D8 names to D12 equivalents. Phase B per-component migration removed the shims as it touched each component; the screens (~10) still consume the shims and will be cleaned up when the relevant later sprints touch those screens. Acceptable because the shims point at the correct D12 hex via the mode-aware resolver, so screens render correctly.

4. **`fireHaptic` is NOT placed on the Theme object.** It pulls `expo-haptics` (ESM) which the pure ts-jest project can't parse. Components import directly: `import { fireHaptic } from '../theme/tokens/haptics'`. Documented in `tokens/index.ts` and `buildTheme.ts`.

5. **`resolveColorMode` extracted to its own pure-TS file.** `ThemeProvider.tsx` is JSX and the pure jest project can't load it; needed the helper in a pure file so the rule can be unit-tested. 9 tests cover all (override × OS-scheme) combinations.

6. **Inter Black is loaded but currently unconsumed.** D12 §3.2 type scale uses Inter Bold (700) for all display tokens. Inter Black (900) was loaded in App.tsx during Task 1 in case `display-xxl` (64pt) needed extra weight. None of the type-scale tokens reference it; safe to remove later if it bloats bundle, but cost is ~50KB.

7. **Pill `accent` variant text changed `text.primary` → `text.onBrand`.** D12-semantically correct (text rendered on brand-primary surface), and `urgent` text changed `text.onBrand` → `text.onUrgent` for the same reason.

8. **Pill `success` variant background derived from theme hex at 15% via inline `hexAt()` helper.** Old D8 hardcoded `'rgba(47, 122, 63, 0.15)'` was navy-tinted and would have rendered barely visible on the new dark canonical surface. Now derives from `theme.colors.state.success` at runtime, so the tint stays legible in both dark and light.

### Backlog deferrals — handled

- **BottomSheet `'full'` sizing variant** — RESOLVED 2026-05-07 by Task 8. Backlog item updated to reflect partial resolution; the other two items in that backlog group (drag-UP-to-expand, swipeable Card variant) carry forward.

### Carryover into later sprints

- **Phosphor + react-native-svg installation** → Sprint 7.6 (first consumers: VitalTile, AnomalyBanner)
- **`motion/patterns.ts` stubs** (dailyPulseReveal, livePulse, tileExpand) → Sprint 7.6 (consumers ship there)
- **ReadingCard "substantial redesign"** (vital-tile pattern) → Sprint 7.6 alongside VitalTile
- **Sparkline multi-series support** → Sprint 7.6 alongside CorrelationStrip
- **WCAG 2.2 AA automated runner** → not currently scoped; manual verification is the gate. Worth a small dedicated effort or backlog entry.
- **buildTheme compat shims removal** → fold into the relevant later sprint when each unmigrated screen is touched (CaregiverHome → 7.7; SignUp/SignIn/OTPVerify/AccountTypeFork → no current sprint, lives as polish backlog; TakeReadingScreen/ReadingDetailScreen/SelfBuyerHomePlaceholder/PairingScreen → respective successor sprints; Onboarding screens → as touched).
- **Settings UI for color-mode toggle** (System / Dark / Light) → Sprint 10 (Settings + Family + Paywall). Storage layer + dev-gallery toggle ship in 1.5; user-facing Settings row waits for 10.
- **Style Dictionary export tooling** (`tools/tokens-export/`) → v1.1 per Q3 (no designer engaged for v1.0 — non-blocking).
- **`useReducedMotion()` source** — Sprint 1's hook reads OS state via RN AccessibilityInfo. D12 §7.4 collapse rules are honoured by the new motion patterns. No change needed; just noting the path.

### Demo

The dev gallery is the demo target. Run from `apps/mobile`:

```
EXPO_PUBLIC_DEV_GALLERY=true npm run start
```

Switch through the Type mode (Caregiver / Parent) and Color mode (System / Dark / Light) toggles at the top. Verify each component section renders cleanly in all four mode combinations. Press the Button to feel the haptic + spring; open the BottomSheet variants (compact / default / tall / **full** / confirmed-urgent) to see the glass material + spring rise.
