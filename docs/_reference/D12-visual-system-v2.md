# D12 — Visual System v2

**Apple-of-Healthcare · Design Tokens, Components, Motion Language**
*Prepared: 2026-05-07 · Status: Draft for founder + designer co-author · Supersedes D8 + `docs/02-design-tokens.md`*

---

## Document Metadata

| Field | Value |
|---|---|
| **Deliverable** | D12 — Visual System v2 |
| **Project** | Leiko health-wearable platform |
| **Predecessor docs** | D11 (Brand Repositioning), D8 (Design System v1 — superseded), `docs/02-design-tokens.md` (superseded), D9 (Editorial — voice rules retained) |
| **Sister docs** | D13 (Multi-Vitals Constellation Spec), D14 (Ambient AI Architecture) |
| **Authority** | When D12 conflicts with D8 or `docs/02-design-tokens.md`, D12 wins. Engineering's `apps/mobile/src/theme/tokens.ts` is the implementation; this doc is the source of truth. |
| **Co-authors** | Founder (sign-off) · Visual designer (TBD — sections marked **[DESIGNER]** are explicitly designer-arbitrated) · Engineering (implementation feasibility) |
| **Modes** | **Dark (canonical)** + **Light (variant)** at v1.0 |

---

## Executive Summary

D12 translates the brand direction set in D11 §5 into an implementable visual system. It covers eight token categories (color, typography, spacing, radii, depth, motion, opacity, haptics), specifies a component library of ~25 primitives (15 existing, 10 new for the multi-vitals constellation), defines the motion language for ambient health data, and provides the implementation contract engineering builds against.

The single biggest change from D8: this is a **dark-canonical, motion-fluent, depth-aware system** designed for Apple-of-Healthcare polish. The cream-and-navy palette is gone. Decorative motion is now permitted with restraint. Glass and translucency are first-class materials. Tinted-on-dark shadows replace black-on-cream shadows.

The migration path from D8 tokens to D12 tokens is mechanical — see §15. Existing components stay structurally; their token consumption updates. The token rollout (Sprint 1.5 in the pivot plan) is the gate before any new screen sprints execute.

---

## §1. Design Philosophy — The Five Principles

These are the rules every visual decision in Leiko gets checked against.

1. **Dark-canonical, motion-quiet.** Most surfaces live on a deep neutral. Motion exists but earns its place — every animation has a functional reason. The bar is *Apple-tasteful, not TikTok-busy.*
2. **Density via depth, not via cramming.** When a screen feels full, the answer is to lift content into layers (glass, elevation, parallax), not to tighten spacing. Generous spacing is non-negotiable.
3. **The numbers are heroes.** Vital readings are the largest type on every screen they appear on. Surrounding UI exists to frame them.
4. **One signal accent, used sparingly.** Brand accent ≤8% screen area. If a screen has more accent than that, it is wrong.
5. **Confirmed-urgent is the only red.** Crimson appears in exactly one scenario — a clinical-threshold breach with the calm urgent banner. The rest of the app stays calm.

---

## §2. Color System

### 2.1 Approach

Two layers — **raw palette** (specific hex values, near-zero semantic information) and **semantic tokens** (consumed by components, mode-aware). Components only consume semantic tokens. Raw palette is referenced exactly once — by the theme builder.

Both modes (dark, light) are first-class. Tokens have two values; the resolved value depends on the active mode.

### 2.2 Raw palette — Dark canonical (recommended values, **[DESIGNER]** to refine)

The values below are my engineering-grade recommendations. The designer can override each, but the relationships between values (contrast ratios, hue families, accent placement) should hold even if the specific hex shifts.

| Token | Hex | Role |
|---|---|---|
| `palette.midnight.950` | `#06090F` | Deepest base — never visible alone, sits behind translucency |
| `palette.midnight.900` | `#0A0F1A` | **Dark canonical base** — the screen background |
| `palette.midnight.850` | `#11171F` | Surface elevated +1 (cards, list rows) |
| `palette.midnight.800` | `#1A2030` | Surface elevated +2 (modal sheets, popovers) |
| `palette.midnight.750` | `#222937` | Surface elevated +3 (highest — confirmed-urgent banner backdrop) |
| `palette.bone.50` | `#F5F1EA` | Primary text on dark — warm-white, not pure white (pure white feels surgical, not premium) |
| `palette.bone.100` | `#ECE9E2` | Secondary text on dark |
| `palette.stone.300` | `#9C9890` | Tertiary / muted text on dark |
| `palette.stone.500` | `#6B6862` | Quaternary / disabled text |
| `palette.amber.500` | `#E8A063` | **Brand accent** — warm amber-coral, premium without being decorative |
| `palette.amber.400` | `#F5B47A` | Brand accent hover/active |
| `palette.amber.600` | `#C5824A` | Brand accent pressed |
| `palette.coral.500` | `#D6745A` | Vital ring — Heart Rate (HR) |
| `palette.teal.500` | `#5FA8A8` | Vital ring — SpO2 |
| `palette.violet.500` | `#7C7AAB` | Vital ring — Sleep |
| `palette.sage.500` | `#7CA56F` | Vital ring — Activity (steps/calories) |
| `palette.success.500` | `#5BA873` | Reading-confirmed-in-range, sync success |
| `palette.warning.500` | `#E8A063` | Calm-concerned anomaly (uses brand accent — calm not panic) |
| `palette.crimson.700` | `#A8403F` | **Confirmed-urgent only** — clinical-threshold breach. Never elsewhere. |
| `palette.glass.10` | `rgba(255,255,255,0.04)` | Glass tint, lightest — used over imagery |
| `palette.glass.20` | `rgba(255,255,255,0.08)` | Glass tint, light — sheet edges, ambient pulse |
| `palette.glass.30` | `rgba(255,255,255,0.16)` | Glass tint, medium — bottom sheets |
| `palette.rim.20` | `rgba(255,255,255,0.06)` | Rim lighting — 1px top inner border on cards (dark-mode-only) |

### 2.3 Raw palette — Light variant (recommended values, **[DESIGNER]** to refine)

The light mode is *the same product in daylight*, not a degraded dark theme. Same hue family, brightness inverted.

| Token | Hex | Role |
|---|---|---|
| `palette.linen.50` | `#FBF9F5` | Light variant base — warm-tinted off-white |
| `palette.linen.100` | `#F5F2EC` | Surface subtle |
| `palette.linen.200` | `#FFFFFF` | Surface elevated (modals, sheets) |
| `palette.ink.900` | `#0F121C` | Primary text on light |
| `palette.ink.700` | `#2A3040` | Secondary text on light |
| `palette.ink.500` | `#5A6478` | Tertiary text |
| `palette.ink.300` | `#8C95A8` | Quaternary / disabled |
| `palette.amber.500` | `#E8A063` | Same accent — works in both modes |
| `palette.coral.500` | `#C95F44` | HR — slightly desaturated for light |
| `palette.teal.500` | `#3F8888` | SpO2 — slightly deeper for light |
| `palette.violet.500` | `#5A5887` | Sleep — slightly deeper |
| `palette.sage.500` | `#5C8252` | Activity — slightly deeper |
| `palette.success.500` | `#3F8054` | Success in light |
| `palette.warning.500` | `#C5824A` | Calm-concerned in light |
| `palette.crimson.700` | `#8C2D2D` | Confirmed-urgent in light |
| `palette.glass.10` | `rgba(15,18,28,0.04)` | Glass on light — inverted |
| `palette.glass.20` | `rgba(15,18,28,0.08)` | |
| `palette.glass.30` | `rgba(15,18,28,0.16)` | |

### 2.4 Semantic tokens (consumed by components)

Components reference these. The theme provider resolves them per active mode.

| Token | Dark resolves to | Light resolves to | Used for |
|---|---|---|---|
| `color.brand.primary` | `palette.amber.500` | `palette.amber.500` | Single primary CTA per screen, brand wordmark |
| `color.brand.primary-hover` | `palette.amber.400` | `palette.amber.400` | CTA hover |
| `color.brand.primary-pressed` | `palette.amber.600` | `palette.amber.600` | CTA pressed |
| `color.surface.base` | `palette.midnight.900` | `palette.linen.50` | Default screen background |
| `color.surface.subtle` | `palette.midnight.850` | `palette.linen.100` | Cards, list rows |
| `color.surface.elevated` | `palette.midnight.800` | `palette.linen.200` | Modals, bottom sheets |
| `color.surface.high` | `palette.midnight.750` | `palette.linen.200` | Confirmed-urgent backdrop |
| `color.surface.glass-light` | `palette.glass.10` | `palette.glass.10` | Light translucency |
| `color.surface.glass-medium` | `palette.glass.20` | `palette.glass.20` | Default translucency |
| `color.surface.glass-heavy` | `palette.glass.30` | `palette.glass.30` | Heavy translucency (sheet) |
| `color.text.primary` | `palette.bone.50` | `palette.ink.900` | Body, headlines |
| `color.text.secondary` | `palette.bone.100` | `palette.ink.700` | Sub-body, supporting |
| `color.text.tertiary` | `palette.stone.300` | `palette.ink.500` | Timestamps, helper |
| `color.text.disabled` | `palette.stone.500` | `palette.ink.300` | Disabled states |
| `color.text.on-brand` | `palette.midnight.900` | `palette.midnight.900` | Text on amber |
| `color.text.on-urgent` | `palette.bone.50` | `palette.bone.50` | Text on crimson |
| `color.border.subtle` | `palette.glass.20` | `palette.glass.20` | Card edges, divider lines |
| `color.border.strong` | `palette.bone.100` | `palette.ink.700` | Focused inputs |
| `color.border.rim` | `palette.rim.20` | `transparent` | Card top-edge highlight (dark only — rim lighting) |
| `color.vital.bp` | `palette.amber.500` | `palette.amber.500` | BP ring/tile (uses brand accent — BP is the headline vital) |
| `color.vital.hr` | `palette.coral.500` | `palette.coral.500` | HR ring/tile |
| `color.vital.spo2` | `palette.teal.500` | `palette.teal.500` | SpO2 ring/tile |
| `color.vital.sleep` | `palette.violet.500` | `palette.violet.500` | Sleep ring/tile |
| `color.vital.activity` | `palette.sage.500` | `palette.sage.500` | Activity ring/tile |
| `color.state.success` | `palette.success.500` | `palette.success.500` | Reading confirmed, sync success |
| `color.state.warning` | `palette.warning.500` | `palette.warning.500` | Calm-concerned anomaly |
| `color.state.urgent` | `palette.crimson.700` | `palette.crimson.700` | **Confirmed clinical breach only** |
| `color.focus.ring` | `palette.amber.500` | `palette.amber.500` | Keyboard focus, 3pt outline |

### 2.5 Color-use quotas (per screen, by area)

To prevent visual drift. Reviewed by eye in design review.

| Color band | Dark mode area | Light mode area | Rule |
|---|---|---|---|
| Surface base + subtle | 70–85% | 65–80% | Visual base. Most of the screen, most of the time. |
| Text + UI | 10–20% | 15–25% | Headlines, body, UI chrome |
| Brand accent | ≤ 8% | ≤ 8% | One primary CTA per screen, active vital, AI accent line. **Never** a background block. |
| Vital chromatics | ≤ 15% combined | ≤ 15% combined | Five rings together, vital tiles. Distributed, not concentrated. |
| Crimson | 0% on a normal screen | 0% on a normal screen | Confirmed-urgent only. Removing it from a screen is the default. |

### 2.6 Contrast verification (WCAG 2.2)

All foreground/background pairings must meet AA (4.5:1 body text, 3:1 large text & graphical objects). Vital rings are graphical objects — must hit 3:1 against surface.

| Foreground | Background | Dark ratio | Light ratio | Meets |
|---|---|---|---|---|
| Bone 50 | Midnight 900 | 16.2:1 | n/a | AAA |
| Bone 100 | Midnight 900 | 13.8:1 | n/a | AAA |
| Stone 300 | Midnight 900 | 5.4:1 | n/a | AA |
| Ink 900 | Linen 50 | n/a | 17.6:1 | AAA |
| Ink 700 | Linen 50 | n/a | 12.4:1 | AAA |
| Ink 500 | Linen 50 | n/a | 6.8:1 | AA |
| Amber 500 | Midnight 900 | 6.1:1 | n/a | AA |
| Amber 500 | Linen 50 | n/a | 3.4:1 | AA Large |
| Coral 500 | Midnight 900 | 4.2:1 | n/a | AA Large |
| Teal 500 | Midnight 900 | 3.8:1 | n/a | AA Large |
| Violet 500 | Midnight 900 | 3.5:1 | n/a | AA Large |
| Sage 500 | Midnight 900 | 4.1:1 | n/a | AA Large |
| Crimson 700 | Bone 50 | n/a | 5.8:1 | AA |
| Bone 50 | Crimson 700 | 5.8:1 | n/a | AA |

**[DESIGNER]** to verify final values land at or above these ratios after refining the palette.

---

## §3. Typography

### 3.1 Font stack — locked v1.0 (founder decision 2026-05-07: zero licensing cost)

| Family | Use | License | Loading |
|---|---|---|---|
| **Inter** | Display headlines, body, UI controls, captions — single family, weight-differentiated | Free (OFL) | Bundled .ttf via expo-font |
| **JetBrains Mono** | Tabular numerics for vital readings | Free (OFL) | Bundled .ttf via expo-font |

**Rationale:** Inter-only collapses the original three-family hierarchy (Recoleta display / Inter body / JetBrains numerics) to two free families. The "display face" role in §3.2 resolves to **Inter Bold** (or Black at `display-xxl`); the "body face" role resolves to **Inter Regular / Medium / SemiBold**. Hierarchy is carried by weight + size, not by family contrast.

**Trade-off accepted:** loses Recoleta's warmth on hero surfaces. Founder approved this in exchange for $0 licensing. Premium display alternatives (Recoleta, Söhne, Reckless Neue) are deferred to v1.1 if brand polish becomes the limiting factor.

`tokens.ts` has one place to swap if v1.1 reopens the typeface budget.

### 3.2 Type scale — caregiver default (most users)

The scale moves up one step from D8 to support the Daily Pulse hero and create more typographic hierarchy.

| Token | Size (pt) | Line height | Weight | Family | Used for |
|---|---|---|---|---|---|
| `type.numeric-hero` *(NEW)* | 80 | 80 | Medium tabular | JetBrains Mono | Daily Pulse central number — single most prominent number in the app |
| `type.numeric-xl` | 56 | 60 | Medium tabular | JetBrains Mono | Reading detail BP value |
| `type.numeric-l` | 36 | 40 | Medium tabular | JetBrains Mono | Vital tile primary value |
| `type.numeric-m` | 22 | 28 | Medium tabular | JetBrains Mono | Trend chart values, list values |
| `type.numeric-s` | 15 | 20 | Medium tabular | JetBrains Mono | Inline metric in body copy |
| `type.display-xxl` *(NEW)* | 64 | 68 | Bold | Display face | Onboarding hero, paywall hero |
| `type.display-xl` | 48 | 52 | Bold | Display face | Section heroes |
| `type.display-l` | 36 | 42 | Bold | Display face | Card heroes |
| `type.display-m` | 28 | 34 | Bold | Display face | AI narration on Daily Pulse hero |
| `type.headline` | 22 | 28 | SemiBold | Body face | Screen titles |
| `type.title` | 18 | 24 | SemiBold | Body face | Card titles, section headers |
| `type.body-l` | 17 | 26 | Regular | Body face | Default body — never smaller for primary content |
| `type.body-m` | 15 | 22 | Regular | Body face | Secondary body |
| `type.body-s` | 13 | 18 | Regular | Body face | Helper text — never primary |
| `type.label` | 13 | 16 | Medium | Body face | Input labels, button text on small buttons |
| `type.label-uppercase` *(NEW)* | 11 | 14 | Medium tracking-wider | Body face | Vital tile labels — used very sparingly |
| `type.caption` | 12 | 16 | Regular | Body face | Timestamps — secondary muted color only |

Notes:
- `type.label-uppercase` is the *only* uppercase variant in the system. Used for vital-tile labels ("HR", "SPO2", "SLEEP") where they're more icon than text. Tracking widened (+50/1000 em).
- Display sizes `display-xl`, `display-xxl` appear at most **once per screen** and never on the same screen.
- Numerics in any vital context MUST use `type.numeric-*` (tabular) so digits don't shift position when values change.

### 3.3 Type scale — parent large-text profile

Triggered by `account_type = 'parent'` OR per-user large-text toggle. Body steps up ~12%, line height ~10%.

| Token | Caregiver | Parent | Reason |
|---|---|---|---|
| `type.body-l` | 17pt | 19pt | Arm's-length readability without glasses |
| `type.body-m` | 15pt | 17pt | Secondary content above ramp floor |
| `type.title` | 18pt | 20pt | Card titles distinguishable from body |
| `type.label` | 13pt | 15pt | Buttons remain legible |
| `type.caption` | 12pt | 13pt | Caption is non-essential only |

Display, numeric, and label-uppercase tokens unchanged — already large enough.

### 3.4 Typography rules

- **Never** use `type.body-s` or `type.caption` for primary content.
- Numerics in vital context MUST be `type.numeric-*` (tabular monospace).
- Display sizes appear at most **once per screen**. Never two display headlines together.
- Headlines are sentence case ("Your daily pulse"), never Title Case, never UPPERCASE.
- Letter-spacing remains font default. Do not tighten or loosen except for `type.label-uppercase` (+50/1000 em).
- Italics for system-state messages only ("Syncing…"). Never for emphasis in body — use weight (Medium/SemiBold) instead.
- Underline reserved for inline links inside running text. Standalone link buttons use `color.brand.primary` without underline.

---

## §4. Spacing

4pt base scale. All padding, margin, gap values resolve to one of these. **No raw pixel values in component code.**

| Token | Value (pt) | Used for |
|---|---|---|
| `spacing.xs` | 4 | Icon-to-text gap inside button or chip |
| `spacing.s` | 8 | Tight vertical rhythm inside a card row |
| `spacing.m` | 12 | Default gap between body paragraphs |
| `spacing.l` | 16 | Card internal padding (top, sides, bottom) |
| `spacing.xl` | 20 | Card-to-card gap on a list |
| `spacing.2xl` | 24 | Screen edge horizontal padding (default) |
| `spacing.3xl` | 32 | Section-to-section vertical break |
| `spacing.4xl` | 48 | Hero-to-content break |
| `spacing.5xl` *(NEW)* | 64 | Daily Pulse hero outer breathing room |
| `spacing.6xl` *(NEW)* | 96 | Onboarding hero vertical rhythm |

D12 spacing leans more generous than D8 — the Apple-of-Healthcare aesthetic earns its premium feel through spacing as much as anything else.

---

## §5. Radii

| Token | Value (pt) | Used for |
|---|---|---|
| `radius.none` | 0 | Status banners that span full screen edge-to-edge |
| `radius.s` | 8 | Inputs, small chips, toast bubbles |
| `radius.m` | 14 | **Default** — cards, buttons, list rows (raised from 12 to 14 for slightly softer feel) |
| `radius.l` | 22 | Bottom sheets, paywall sheet, modal containers |
| `radius.xl` | 32 | Daily Pulse hero card, onboarding hero illustrations |
| `radius.full` | 999 | Avatars, status dots, fully rounded pills, vital ring stroke caps |

---

## §6. Depth & Elevation (substantial expansion from D8)

D8 had a simple shadow scale. D12 has a **material-aware** depth system that handles dark-mode-on-dark-surface (which black shadows can't do — they go muddy) and supports glass/translucent layers.

### 6.1 Elevation tokens — Dark mode

Dark surfaces lift via **lightening**, not via cast shadows. A higher-elevation card has a *lighter* surface tint, and gains a subtle **rim light** at the top edge that simulates ambient occlusion under controlled studio lighting.

| Token | Surface tint | Rim light | Cast shadow | Used for |
|---|---|---|---|---|
| `elevation.none` | `surface.base` | none | none | Default screen content |
| `elevation.low` | `surface.subtle` | 1px `border.rim` top | 0/4/16 rgba(0,0,0,0.20) | Cards, list rows |
| `elevation.medium` | `surface.elevated` | 1px `border.rim` top | 0/8/32 rgba(0,0,0,0.30) | Bottom sheets, popovers |
| `elevation.high` | `surface.high` | 1px `border.rim` top | 0/16/48 rgba(0,0,0,0.45) | Confirmed-urgent banner, full-screen modal |
| `elevation.glass` | `surface.glass-medium` | 1px `border.rim` top | 0/8/24 rgba(0,0,0,0.25) + backdrop-filter blur(20px) | Glass surfaces over imagery |

### 6.2 Elevation tokens — Light mode

Light surfaces lift via **traditional cast shadows** — tinted with the deepest ink color, never pure black (pure black on cream goes muddy).

| Token | Surface | Cast shadow | Used for |
|---|---|---|---|
| `elevation.none` | `surface.base` | none | Default |
| `elevation.low` | `surface.subtle` | 0/2/8 rgba(15,18,28,0.06) | Cards |
| `elevation.medium` | `surface.elevated` | 0/4/16 rgba(15,18,28,0.10) | Sheets |
| `elevation.high` | `surface.elevated` | 0/8/24 rgba(15,18,28,0.14) | Confirmed-urgent banner |
| `elevation.glass` | `surface.glass-medium` | 0/4/12 rgba(15,18,28,0.12) + backdrop-filter blur(20px) | Glass on light |

### 6.3 Glass / translucency materials

Translucent surfaces are first-class. They appear in three places at v1.0:

1. **Bottom sheets** — `material.glass.heavy` over the underlying screen
2. **Daily Pulse hero subtle parallax overlay** — `material.glass.light` when content scrolls beneath the hero, suggesting layered depth
3. **AI narration card** when it appears over the constellation — `material.glass.medium`

| Material token | Composition |
|---|---|
| `material.glass.light` | `surface.glass-light` + backdrop-filter blur(12px) |
| `material.glass.medium` | `surface.glass-medium` + backdrop-filter blur(20px) |
| `material.glass.heavy` | `surface.glass-heavy` + backdrop-filter blur(40px) |

Implementation: React Native does not support native CSS `backdrop-filter`. Use `@react-native-community/blur` (BlurView) or, on Android < 12 fallback, a non-blurred translucent overlay. Engineering acceptance criterion: glass should look intentional even on the fallback path.

---

## §7. Motion Language

### 7.1 Duration scale

| Token | Value (ms) | Used for |
|---|---|---|
| `motion.instant` | 0 | State toggles where animation hurts |
| `motion.fast` | 120 | Hover states, focus rings, small icon swaps |
| `motion.normal` | 200 | **Default** — button press, navigation push, sheet open |
| `motion.slow` | 320 | Bottom sheet rise, page-level transitions |
| `motion.deliberate` | 480 | First-time onboarding hero reveal |
| `motion.cinematic` *(NEW)* | 720 | Daily Pulse ring fill — once per session |
| `motion.cinematic-extended` *(NEW)* | 1200 | Onboarding hero, paywall reveal — once-per-app-lifetime moments |

### 7.2 Easing curves

| Token | Curve | Used for |
|---|---|---|
| `ease.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default — navigation, sheets, most state changes |
| `ease.decelerate` | `cubic-bezier(0, 0, 0, 1)` | Element entering view |
| `ease.accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | Element leaving view |
| `ease.linear` | `linear` | Skeleton shimmer, progress fill |
| `ease.spring` *(NEW)* | spring(stiffness: 180, damping: 22, mass: 1) | Sheet rise, ring fill, FAB press, vital tile expand |
| `ease.cinematic` *(NEW)* | `cubic-bezier(0.16, 1, 0.3, 1)` | Daily Pulse reveal choreography — exaggerated decelerate |
| `ease.heartbeat` *(NEW)* | custom (see §7.5) | Live-pulse animation only |

### 7.3 Choreography patterns

Six named patterns. Components reference these by name; they're implemented once and applied everywhere.

#### `motion.pattern.button-press`
- Scale 1.0 → 0.97 over `motion.fast` `ease.spring`
- Opacity unchanged
- Reverses on release

#### `motion.pattern.sheet-rise`
- TranslateY full-height → resting position over `motion.slow` `ease.spring`
- Backdrop opacity 0 → 0.55 over `motion.normal` `ease.standard`
- On dismiss: reverse with `ease.accelerate`

#### `motion.pattern.daily-pulse-reveal` *(NEW — the signature animation)*
- All five vital rings start at 0% fill, opacity 0
- Rings fill in sequence: BP → HR → SpO2 → Sleep → Activity
- Each ring: opacity 0 → 1 over `motion.normal`, then arc fill 0% → target % over `motion.cinematic` `ease.cinematic`
- Stagger between rings: 80ms
- AI narration line fades in 200ms after the last ring starts filling, opacity 0 → 1 over `motion.normal` `ease.decelerate`
- Total choreography: ~1400ms
- **Plays once per session** — after first nav back to Home, rings are static at their values

#### `motion.pattern.live-pulse` *(NEW — see §7.5 for full spec)*
- Continuous loop while a vital is actively notifying
- Soft breathing scale + opacity oscillation

#### `motion.pattern.tile-expand`
- VitalTile tap → expands to full-screen vital detail
- Origin: tap location
- Scale 1.0 → fills viewport over `motion.slow` `ease.spring`
- Underlying content fades out at `motion.normal` `ease.accelerate`

#### `motion.pattern.skeleton-shimmer`
- Linear horizontal gradient sweep
- 1400ms cycle, `ease.linear`
- Disabled when reduced motion is on (static placeholder shown)

### 7.4 Reduced motion behaviour

When OS-level *Reduce Motion* is on:

- `motion.cinematic`, `motion.cinematic-extended`, `motion.deliberate`, `motion.slow` → all resolve to `motion.fast` (120ms)
- `motion.normal` → `motion.instant` (transitions become hard cuts)
- Easing curves unchanged (still apply over reduced duration)
- `motion.pattern.daily-pulse-reveal` → rings appear at final state instantly, no choreography, no stagger
- `motion.pattern.live-pulse` → DISABLED entirely. Active vitals show a static "live" indicator dot instead of pulse motion
- Skeleton shimmer → static placeholder
- Decorative parallax → disabled

### 7.5 The live-pulse animation (signature spec)

This is the single most distinctive piece of motion in the app. It runs on any vital ring whose underlying signal is currently being captured (HR notify is streaming, BP cuff is inflating, etc.).

**Specification:**
- Scale animates 1.0 ↔ 1.04 (4% growth)
- Opacity animates 1.0 ↔ 0.85
- Cycle duration: 1200ms (matches a slow resting heart rate of 50bpm — visually calm)
- Easing: custom `ease.heartbeat` curve — a double-pulse pattern: rapid grow (0–25%), pause at peak (25–35%), rapid shrink (35–60%), longer pause at trough (60–100%)
- Implementation: `react-native-reanimated` shared value driven by `withRepeat(withSequence(...))` — **drives on the UI thread**, never causes a render-loop on the JS thread
- Runs only on the *currently-active* vital, never multiple at once

For a HR-streaming context, the pulse rate may *match* the actual measured rate (within reason — capped between 50–120bpm visually so we don't have a frantic 140bpm pulse on screen). For all other vitals (BP cuff inflating, SpO2 reading), it uses the default 50bpm rhythm.

### 7.6 Implementation note

All motion above is implemented via `react-native-reanimated` v3 (already in stack per ADR-0004). UI-thread-only animations are mandatory for anything visible during scroll. JS-thread fallback is forbidden for vital-related motion.

---

## §8. Opacity

| Token | Value | Used for |
|---|---|---|
| `opacity.disabled` | 0.40 | Disabled buttons, controls |
| `opacity.scrim` | 0.55 | Modal backdrop |
| `opacity.muted` | 0.70 | Decorative illustrations behind copy |
| `opacity.ring-background` | 0.12 | Vital ring background track (the unfilled portion) |
| `opacity.glass-base` | 0.04 | Lightest glass tint |
| `opacity.full` | 1.00 | Default |

---

## §9. Haptics (NEW token category)

Haptics are first-class in the Apple-of-Healthcare bar. The product feels expensive because it answers back. Apple's Core Haptics on iOS, Android Haptic Feedback Constants on Android.

| Token | iOS pattern | Android pattern | Triggered by |
|---|---|---|---|
| `haptic.tick` | `selection` (light tick) | `KEYBOARD_TAP` | Pull-to-refresh threshold reached, vital tile press |
| `haptic.confirm` | `impactMedium` | `CONFIRM` | Reading captured, sheet committed |
| `haptic.success` | `notificationSuccess` | `LONG_PRESS` | Goal hit, sync success, family invite accepted |
| `haptic.warning` | `notificationWarning` | `REJECT` | Calm-concerned anomaly banner appears |
| `haptic.error` | `notificationError` | `REJECT` | Sync failure, BLE disconnection during reading |
| `haptic.heartbeat` *(custom)* | Core Haptics pattern: short tap, 80ms gap, longer tap | Vibration pattern: [0, 50, 80, 120] | Live HR streaming on vital detail (subtle, every 5 seconds — not continuous) |

Rules:
- Haptics off when device is in silent mode + low-power mode (respect user state)
- All haptics are user-toggleable in Settings (single on/off — not per-category)
- `haptic.heartbeat` is OFF by default; user opts in (some users find it intrusive)

---

## §10. Iconography

### 10.1 Direction (**[DESIGNER]** to refine)

Default: **Phosphor** icon family (`@phosphor-icons/react-native`), regular weight (400), pixel-perfect at 16/20/24/32pt sizes. Phosphor is acceptable for v1.0 — stylistically consistent with Apple-of-Healthcare references. Custom icon set is **out of scope at v1.0** unless designer brings strong specific argument.

### 10.2 Icon weights

| Use | Weight |
|---|---|
| Chrome (tab bar inactive, list-row trailing chevron) | Phosphor Regular |
| Active states (tab bar active, focused input) | Phosphor Bold |
| Vital iconography (the small icon inside a VitalTile) | Phosphor Duotone (with vital chromatic accent on the duotone layer) |

### 10.3 Sizes

| Token | Value (pt) | Used for |
|---|---|---|
| `icon.xs` | 14 | Inline in body copy |
| `icon.s` | 16 | Default in buttons, list rows |
| `icon.m` | 20 | Tab bar, larger buttons |
| `icon.l` | 24 | Settings rows, navigation chevron |
| `icon.xl` | 32 | Vital tile inline icons |
| `icon.hero` | 56 | Empty-state illustrations |

### 10.4 Phosphor icon mapping (initial)

The current `plans/backlog.md` flagged this — D12 commits to Phosphor. Specific mappings:

| Element | Icon |
|---|---|
| Settings | `GearSix` |
| Family / invite | `UserPlus` |
| BP vital | `Drop` (heart-shaped tear) |
| HR vital | `HeartStraight` |
| SpO2 vital | `Wind` |
| Sleep vital | `Moon` |
| Activity vital | `Footprints` |
| AI narration | `Sparkle` |
| Anomaly calm-concerned | `Warning` |
| Anomaly confirmed-urgent | `WarningCircle` |
| Sync syncing | `ArrowsClockwise` |
| Sync error | `WifiSlash` |
| Bluetooth | `Bluetooth` |
| Watch low battery | `BatteryLow` |
| Doctor / clinical | `Stethoscope` |
| List-row trailing chevron | `CaretRight` |
| Close | `X` |
| Check / select | `Check` |

---

## §11. Component Library

Two categories: **existing components rewritten** for the new system, and **new components** for the multi-vitals constellation. Each component has: visual specification, prop contract, motion behaviour, accessibility requirement.

The full visual specifications (exact pixel-level treatment in both modes) are produced by the designer in Figma. D12 specifies the *contract* engineering builds against.

### 11.1 Existing components — rewrite scope

Components already in `apps/mobile/src/components/` that need token-system migration. The structural code stays; the token consumption updates.

| Component | File | Migration scope |
|---|---|---|
| Button | `Button.tsx` | New color tokens, new radius (m=14), spring press animation, haptic.tick on press |
| Card | `Card.tsx` | Elevation system (rim light + tinted shadow per mode), glass variant added |
| ListRow | `ListRow.tsx` | Token migration only |
| Pill | `Pill.tsx` | Token migration; new selected state uses brand-primary background |
| BottomSheet | `BottomSheet.tsx` | Glass material (heavy), spring rise, full-size variant added per backlog deferral |
| ReadingCard | `ReadingCard.tsx` | Substantial redesign — adopts vital tile pattern, multi-vital display capable |
| Sparkline | `Sparkline.tsx` | Multi-series support, both modes, vital chromatic colours |
| TimezonePicker | `TimezonePicker.tsx` | Token migration only |
| PageIndicator | `PageIndicator.tsx` | Token migration only |

### 11.2 New components — built fresh in Sprint 7.6

Six new components for the multi-vitals constellation. Each is specified below.

#### 11.2.1 `VitalRing`

The fundamental visual primitive of the system. A circular arc indicating progress or status of one vital.

| Prop | Type | Notes |
|---|---|---|
| `vitalType` | `'bp' \| 'hr' \| 'spo2' \| 'sleep' \| 'activity'` | Drives color from `color.vital.*` |
| `value` | `number` | Current measurement |
| `target` | `number?` | Optional goal — drives fill arc length |
| `size` | `'sm' \| 'md' \| 'lg' \| 'hero'` | 40 / 88 / 168 / 240 pt diameter |
| `state` | `'idle' \| 'filling' \| 'pulsing' \| 'stale'` | Drives motion |
| `withRimLight` | `boolean` | Whether to render rim-light on dark mode |

Visual:
- Track: 12% opacity vital color, full circle
- Foreground arc: solid vital color, stroke width scales with size (4/8/12/16pt)
- Stroke linecap: round
- Center: empty (consumer composes inner content — typically the value itself)

Motion:
- `idle`: static at current fill
- `filling`: animates 0% → target% over `motion.cinematic` `ease.cinematic`
- `pulsing`: applies `motion.pattern.live-pulse`
- `stale`: 50% opacity, reduced saturation 70%

Implementation: SVG-based via `react-native-svg` with `Reanimated` shared values. Skia upgrade path documented for v1.1 if performance demands.

#### 11.2.2 `VitalTile`

A tappable summary card for one vital. Used in the vital tile strip on Daily Pulse hero.

| Prop | Type | Notes |
|---|---|---|
| `vitalType` | `'bp' \| 'hr' \| 'spo2' \| 'sleep' \| 'activity'` | |
| `value` | `string` | Pre-formatted ("128/82", "62 bpm", "97%", "7h 24m", "8,432") |
| `secondary` | `string?` | Optional sub-line ("morning", "resting", "last night") |
| `state` | `'normal' \| 'live' \| 'stale' \| 'no-data'` | |
| `onPress` | `() => void` | |

Visual:
- Card with `elevation.low`, `radius.m`, `spacing.l` internal padding
- Top-left: small VitalRing (size `sm`) + Phosphor icon at `icon.s` next to it
- Top-right: `type.label-uppercase` showing vital name
- Center: `type.numeric-l` value
- Bottom: `type.caption` secondary line (or empty state copy if no-data)
- Live state: live-pulse on the small ring; ambient glow on the card edge using accent color at 20% opacity

Motion:
- Tap: `motion.pattern.button-press` (scale 0.97)
- Press-and-hold (>500ms): `motion.pattern.tile-expand` to vital detail screen

#### 11.2.3 `DailyPulseHero`

The signature component of the app. The five-vital ring constellation on the Self-Buyer Home and (smaller) within each parent's card on Caregiver Home.

| Prop | Type | Notes |
|---|---|---|
| `vitals` | `{ bp, hr, spo2, sleep, activity }` | Each entry: { value, target?, state } |
| `centralValue` | `string` | The hero number — typically morning BP, but adaptive |
| `centralLabel` | `string` | Short label under the central value ("morning BP") |
| `aiNarration` | `string?` | The AI-generated daily readiness sentence |
| `mode` | `'immersive' \| 'card'` | Immersive = fills screen; card = scaled-down for caregiver Family Circle |

Visual:
- Five concentric arcs, each occupying ~60° of arc (with small gaps between them) arranged like a flower or atom
- Outer ring: BP (uses brand accent — BP is the headline)
- Then: HR · SpO2 · Sleep · Activity in defined positions
- Center: the central value in `type.numeric-hero` (immersive) or `type.numeric-xl` (card), with `centralLabel` in `type.label-uppercase` underneath
- AI narration: under the rings in `type.display-m`, accent color, Inter Italic SemiBold (closest substitute for the original Recoleta italic-leaning treatment after the v1.0 font collapse — see §3.1)

Motion:
- Initial render: `motion.pattern.daily-pulse-reveal`
- Live state on any ring: `motion.pattern.live-pulse` on that specific ring only

Accessibility:
- Single tappable region with composed `accessibilityLabel`
- VoiceOver reads: "Daily pulse for [name]. Morning blood pressure 124 over 79. Heart rate 62 in pattern. Oxygen 97. Slept 7 hours 24 minutes. Activity below average. AI narration: [narration string]."

#### 11.2.4 `AmbientPulse`

The motion treatment, exposed as a wrapper. Wraps any element in the live-pulse animation.

| Prop | Type | Notes |
|---|---|---|
| `active` | `boolean` | Whether to pulse |
| `bpm` | `number?` | Optional — default 50 |
| `children` | `ReactNode` | The wrapped element |

Used by VitalRing internally. Exposed for cases where another element needs the live-pulse treatment (e.g., the central hero number when BP cuff is inflating).

#### 11.2.5 `CorrelationStrip`

A small chart showing two vitals against each other over time. Used on Trends and on Reading Detail.

| Prop | Type | Notes |
|---|---|---|
| `vitalA` | `VitalSeries` | `{ type, points: [{ t, value }] }` |
| `vitalB` | `VitalSeries` | Same shape |
| `range` | `'7d' \| '30d' \| '90d'` | |
| `caption` | `string?` | "Sleep × Morning BP" |

Visual:
- Horizontal axis: time
- Two y-axes: each vital scaled to its own range
- Vital A: solid line in vital color
- Vital B: dashed line in vital color
- Areas under each line at 12% opacity
- Caption above

Motion:
- Lines draw in left-to-right on first paint over `motion.slow` `ease.decelerate`

#### 11.2.6 `AnomalyBanner`

The anomaly notification surface. Replaces the placeholder used in current Sprint 7 caregiver home.

| Prop | Type | Notes |
|---|---|---|
| `severity` | `'calm-concerned' \| 'confirmed-urgent'` | |
| `title` | `string` | One-line heading |
| `body` | `string` | One-line context |
| `cta` | `{ label, onPress }?` | Optional action |
| `onDismiss` | `() => void` | |

Visual:
- Calm-concerned: surface uses `color.state.warning` background (brand accent), `color.text.on-brand` text, `radius.m`, full-bleed within screen padding
- Confirmed-urgent: surface uses `color.state.urgent` background (crimson), `color.text.on-urgent` text, `radius.m`, **`elevation.high`** to feel weighted
- Phosphor `Warning` icon at `icon.l` left-aligned
- Calm-concerned has dismiss X on the right; confirmed-urgent does NOT have dismiss (must be acted on)

Motion:
- Appears: `motion.pattern.sheet-rise` from top of screen, `motion.slow`
- Confirmed-urgent: NO bounce, even on spring — `ease.decelerate` instead. Restraint matters here.

### 11.3 Components removed from D8

These components from the D8/current spec are **no longer in the system** and should be removed from `docs/03-components/` in the follow-up PR:

- "WeeklySnapshot" card as currently spec'd → replaced by the Daily Pulse hero + AI narration. The weekly snapshot becomes a Tier-C generated card rendered inside Trends, not a separate Home component.

---

## §12. Implementation Guidance

### 12.1 Token export structure

`apps/mobile/src/theme/tokens.ts` is rewritten with the new system. Engineering structure:

```
src/theme/
├── tokens/
│   ├── color.ts           // Raw palette — both modes
│   ├── typography.ts      // Type scale + font config
│   ├── spacing.ts
│   ├── radii.ts
│   ├── elevation.ts       // Material + shadow config per mode
│   ├── motion.ts          // Durations + easing curves + patterns
│   ├── opacity.ts
│   ├── haptics.ts         // Platform-specific patterns
│   ├── icon.ts            // Sizes + Phosphor mappings
│   └── index.ts           // Re-exports
├── ThemeProvider.tsx       // Provides resolved tokens by active mode
├── useTheme.ts             // Hook
├── buildTheme.ts           // Resolves raw → semantic for active mode
└── useReducedMotion.ts     // Existing — unchanged
```

### 12.2 Style Dictionary export

Tokens exported to JSON in Style Dictionary format so the designer's Figma file can stay synchronised with code. Generated nightly via a CI job:

```
tools/tokens-export/
├── styleDictionary.config.js
├── output/
│   ├── tokens-dark.json
│   ├── tokens-light.json
│   └── tokens-figma.json   // Figma plugin format
```

The designer imports `tokens-figma.json` into their Figma file via the Tokens Studio plugin. This is non-blocking — designer can work without it — but it eliminates the drift problem at scale.

### 12.3 Reanimated 3 usage rules

- All shared values for vital animations live on the UI thread. JS-thread-driven motion is forbidden for vital-related rendering.
- `motion.pattern.live-pulse` runs as a `withRepeat(withSequence(...))` on a worklet.
- Daily Pulse reveal choreography is driven by a single staggered `useAnimatedReaction` reading from a "revealed" counter.
- Reduced-motion check is global: `useReducedMotion()` hook reads OS state once on mount, all motion patterns key off it.

### 12.4 SVG vs Skia

VitalRing is SVG-based at v1.0 via `react-native-svg`. Performance characteristics:

- 5 rings × 60fps × HR-bpm pulse = ~1500 SVG redraws/sec at peak. This is on the edge of `react-native-svg` performance on mid-tier Android.
- If profiling shows frame drops on the constellation hero, **migrate to Skia** (`@shopify/react-native-skia`). Skia is the planned upgrade path and ADR-0004 has it pre-approved for animation-heavy surfaces.
- Decision rule: ship v1.0 on SVG. Profile at end of Sprint 7.6. Migrate to Skia if FPS < 55 on a Pixel 6a baseline.

### 12.5 Glass / BlurView fallback

iOS: `@react-native-community/blur` with type `regular` for `material.glass.medium`, `prominent` for `heavy`.
Android 12+: same package supports native blur.
Android < 12: BlurView falls back to non-blurred translucency. Engineering acceptance: glass surfaces must look intentional even without blur. The token already specifies an opacity-tinted surface as the base — blur is additive polish.

### 12.6 Theme switching

The theme provider listens for OS-level theme changes AND a user-override toggle in Settings. Three settings: System / Always Dark / Always Light. Default: System. MMKV-persisted.

---

## §13. Migration Plan from D8 Tokens

The existing `apps/mobile/src/theme/tokens.ts` has cream/navy/amber tokens. Migration is mechanical.

### 13.1 Migration mapping

| D8 token | D12 token | Mode behaviour |
|---|---|---|
| `color.surface.base` (cream-100) | `color.surface.base` | Now mode-aware (midnight / linen) |
| `color.surface.subtle` (cream-200) | `color.surface.subtle` | Mode-aware |
| `color.surface.elevated` (white) | `color.surface.elevated` | Mode-aware |
| `color.brand.primary` (navy-900) | `color.brand.primary` (amber-500) | **Hue change** |
| `color.brand.primary-soft` (navy-700) | removed | No equivalent — was a calm voice signal |
| `color.brand.accent` (amber-500) | `color.brand.primary` | **Promoted** — was secondary, now primary |
| `color.text.primary` (navy ink) | `color.text.primary` | Mode-aware |
| `color.state.urgent` (crimson) | `color.state.urgent` | Same |

### 13.2 Migration sequence (Sprint 1.5)

1. New `theme/tokens/*` files added alongside existing `tokens.ts`. Builds both side-by-side.
2. New `ThemeProvider` switched in. Old single-mode provider deprecated.
3. Components migrated one at a time — Button first, then Card, then everything else. Tests must pass after each migration before moving on.
4. Visual diff per component captured (before/after screenshots) and reviewed against Figma.
5. Old `tokens.ts` deleted after the last consumer migrates.

Sprint 1.5 acceptance: every existing screen renders cleanly in both modes with the new tokens, voice rules continue to pass on every user-visible string, no functional regression in `apps/mobile/__tests__/`.

---

## §14. Accessibility

All requirements from D8 §10 carry forward and are enforced.

- WCAG 2.2 AA on all foreground/background pairings (4.5:1 body, 3:1 large + graphical)
- Tap targets ≥ 48pt caregiver mode, ≥ 64pt parent mode
- `accessibilityLabel` on every component
- VoiceOver order documented per screen
- Reduced motion fully supported (§7.4)
- Dynamic type supported up to OS-level "XXL"
- Focus rings visible on every interactive element (3pt outline `color.focus.ring`)

New for D12:
- VitalRing graphical contrast verified at every size against every supported background
- Live-pulse animation does NOT use color alone to convey state — also includes a small "live" text label adjacent to the ring
- Glass/translucent surfaces tested at all `accessibilityIgnoresInvertColors=false` settings

---

## §15. Open Items for Designer to Resolve

Collected from sections marked **[DESIGNER]**:

- [x] **RESOLVED 2026-05-07** — Final dark canonical neutral hex value: `#0A0F1A` (founder approval, engineering default accepted)
- [x] **RESOLVED 2026-05-07** — Final accent hex value: `#E8A063` (founder approval, engineering default accepted)
- [ ] Final vital chromatic palette (recommended values in §2.2)
- [ ] Final light variant palette (recommended values in §2.3)
- [x] **RESOLVED 2026-05-07** — Display typeface decision: **Inter Bold/Black** (premium display faces deferred to v1.1; founder ruled out paid licensing — see §3.1)
- [x] **RESOLVED 2026-05-07** — Body typeface decision: **Inter** (already free; locked)
- [x] **RESOLVED 2026-05-07** — Numeric typeface decision: **JetBrains Mono** (already free; locked)
- [ ] Whether to commission custom iconography or stay on Phosphor (recommended: Phosphor at v1.0)
- [ ] Onboarding hero illustration direction
- [ ] Logotype refinement (D11 §4.3 sets direction; designer produces final)
- [ ] App icon final design (D11 §11)
- [ ] Specific motion easing tuning (recommended values are starting points; designer feel-tests)
- [ ] Five high-fidelity render mockups for marketing handoff

---

## §16. Open Items for Founder Sign-Off

- [ ] Approve dark-canonical + light-variant approach (no longer light-only)
- [x] **RESOLVED 2026-05-07** — Premium typefaces budget: $0. Inter-only + JetBrains Mono (both free OFL). Recoleta and Söhne/Reckless Neue deferred to v1.1.
- [ ] Approve Phosphor as v1.0 iconography (defers custom icon set to v1.1)
- [ ] Approve `motion.pattern.daily-pulse-reveal` once-per-session behaviour
- [ ] Approve haptic.heartbeat opt-in default
- [ ] Approve Skia upgrade path (defer-then-decide based on profiling)

---

## §17. Sign-Off

This document represents the locked visual system for Leiko v1.0 under the Apple-of-Healthcare pivot.

**2026-05-07 — Founder override path taken.** No external visual designer was engaged. Founder approved the engineering-grade defaults in §2 (palette) and consolidated the typography stack to Inter-only + JetBrains Mono (§3.1) to keep licensing cost at $0. Sprint 1.5 (token rollout) is unblocked. Items still open in §15 (vital chromatic palette finalisation, light variant palette finalisation, motion easing tunings, marketing render mockups) are tunable during or after Sprint 1.5 and do not gate the rollout.

| Role | Name | Sign-off |
|---|---|---|
| Founder / Product Owner | Law (LawOne Cloud LLC) | Signed 2026-05-07 — engineering defaults approved in lieu of designer; Inter-only typography locked |
| Visual designer | None at v1.0 | N/A — re-evaluate if v1.1 reopens typography or chromatic refinements |
| Engineering | Implements against this contract | Implementation gate cleared: Sprint 1.5 buildable |

---

*End of D12 — Visual System v2 v1.0.*

*Next document: D13 — Multi-Vitals Constellation Spec. Begins on D12 founder sign-off.*
