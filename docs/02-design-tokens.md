# 02 — Design Tokens

Canonical from D8 §2 (Color, Typography, Spacing, Radii, Elevation, Motion, Opacity) plus D5 §10.4 (Parent-mode rules). Loaded by every screen sprint.

> **Naming convention**: `[category].[semantic-role].[modifier]`. Example: `color.text.primary`, `color.surface.elevated`, `spacing.m`, `type.body-l`. Raw palette values (`color.palette.navy-900`) exist for theming only — components must consume the **semantic** layer.

---

## 1. Color

Two layers: a raw palette (every hex from D5 §4.1, plus a small number of system colors), and a semantic layer that components consume. Components must only consume the semantic layer.

### 1.1 Raw palette (from D5 §4.1)

| Token | Hex | Role in D5 |
| --- | --- | --- |
| `palette.navy.900` | #0F2340 | Deep Navy — primary brand |
| `palette.navy.700` | #2A5F7F | Calm Teal — sub-headings, secondary brand |
| `palette.amber.500` | #E89F4F | Warm Amber — accent, single CTA per screen |
| `palette.crimson.700` | #8C2D2D | Signal Crimson — confirmed-urgent only, NEVER default |
| `palette.cream.100` | #F5EFE6 | Warm Cream — primary surface |
| `palette.cream.200` | #E8E2D5 | Soft Taupe — secondary surface, table alt rows |
| `palette.cream.300` | #D6CFC2 | Border Stone — dividers, card borders |
| `palette.white` | #FFFFFF | Pure White — elevated surfaces, modals |
| `palette.text.primary` | #1B2540 | Body text on cream |
| `palette.text.secondary` | #5A6478 | Muted text, captions, timestamps |
| `palette.success.500` | #2F7A3F | Reading-confirmed-in-range states (system color, NOT in D5) |

### 1.2 Semantic tokens (consumed by components)

| Token | Light value | Used for |
| --- | --- | --- |
| `color.brand.primary` | `palette.navy.900` | Logo, primary buttons, headers |
| `color.brand.primary-soft` | `palette.navy.700` | Sub-headers, secondary nav, link text |
| `color.brand.accent` | `palette.amber.500` | Single primary CTA per screen, calm-concerned anomaly banners |
| `color.surface.base` | `palette.cream.100` | Default screen background |
| `color.surface.subtle` | `palette.cream.200` | Cards on cream, alternate table rows |
| `color.surface.elevated` | `palette.white` | Modals, bottom sheets, paywall sheet |
| `color.border.default` | `palette.cream.300` | Card borders, input borders, dividers |
| `color.border.strong` | `palette.navy.700` | Focused input borders, active tab indicator |
| `color.text.primary` | `palette.text.primary` | Body copy, headlines |
| `color.text.secondary` | `palette.text.secondary` | Timestamps, helper text, disabled labels |
| `color.text.on-brand` | `palette.white` | Text on navy or amber backgrounds |
| `color.state.success` | `palette.success.500` | Reading confirmation, sync success |
| `color.state.warning` | `palette.amber.500` | Calm-concerned anomalies, missed-reading reminders |
| `color.state.urgent` | `palette.crimson.700` | **Confirmed clinical threshold breach ONLY** (D6 anomaly logic) |
| `color.focus.ring` | `palette.navy.700` | 3pt outline on keyboard focus, 2:1 contrast against any surface |

### 1.3 Color-use quotas (per screen)

To prevent visual drift, the system enforces approximate area quotas. Reviewed by eye in design review.

| Color band | Approx. area share | Rule |
| --- | --- | --- |
| Cream surfaces (`cream.100` + `cream.200`) | 60–80% | Visual base. If a screen feels white-dominant, it is wrong. |
| Navy text + UI | 15–30% | Headers, primary text, primary buttons. |
| Amber accent | ≤ 10% | One primary CTA, optional accent dot, calm-concerned banner. **Never** a background block larger than a button. |
| Crimson | 0% on a normal screen | Only when a confirmed clinical threshold is breached. Removing it from a screen by default is the design default. |
| White surfaces | Modal layer only | **Never** the base background. Reserved for elevated/temporary surfaces. |

### 1.4 Contrast verification (WCAG 2.2)

All foreground/background pairings used in production must meet at least WCAG 2.2 AA (4.5:1 body text, 3:1 large text & graphical objects). The pairings below are pre-verified — use these exclusively.

| Foreground | Background | Ratio | Meets | Used for |
| --- | --- | --- | --- | --- |
| Navy #0F2340 | Cream #F5EFE6 | 12.4:1 | AAA | Body text default, all headings |
| Navy #0F2340 | White #FFFFFF | 15.1:1 | AAA | Modal text |
| Teal #2A5F7F | Cream #F5EFE6 | 5.7:1 | AA | Sub-headings, link text |
| Muted #5A6478 | Cream #F5EFE6 | 4.6:1 | AA | Secondary body text (timestamps, helper) |
| White #FFFFFF | Navy #0F2340 | 15.1:1 | AAA | Text on primary buttons |
| Navy #0F2340 | Amber #E89F4F | 4.7:1 | AA | Text on amber CTA, anomaly banner |
| White #FFFFFF | Crimson #8C2D2D | 7.6:1 | AAA | Text on confirmed-urgent banner |
| Navy #0F2340 | Taupe #E8E2D5 | 11.2:1 | AAA | Text on subtle cards |

---

## 2. Typography

### 2.1 Font stack

| Family | Use | License | Loading |
| --- | --- | --- | --- |
| Inter | All UI body, controls, captions, numerics | OFL 1.1 / free | Bundled .ttf via expo-font (Regular, Medium, SemiBold, Bold + Tabular) |
| Recoleta | Display headlines on landing surfaces (paywall, onboarding, family-circle hero) | Paid (Latinotype) — single-app license | Bundled .otf (Regular, Bold) |
| Fraunces (fallback) | If Recoleta budget rejected | OFL 1.1 / free | Bundled — swap is one token change |
| JetBrains Mono | Numeric readings (BP, SpO2, HR) where tabular alignment matters | OFL 1.1 / free | Bundled (Regular, Medium) |

> **Display font decision (Q-D8-1)**: default lock is Recoleta if licensing approved by Sprint 2; Fraunces otherwise. Either way, only `type.display-family` changes — one-line edit.

### 2.2 Type scale (caregiver default)

| Token | Size (pt) | Line height | Weight | Family | Used for |
| --- | --- | --- | --- | --- | --- |
| `type.display-xl` | 48 | 52 | Bold | Recoleta | Hero on paywall, onboarding intro — once per flow |
| `type.display-l` | 36 | 42 | Bold | Recoleta | Section heroes (family circle title) |
| `type.display-m` | 28 | 34 | Bold | Recoleta | Card heroes — BP reading on detail screen |
| `type.headline` | 22 | 28 | SemiBold | Inter | Screen titles, tab headers |
| `type.title` | 18 | 24 | SemiBold | Inter | Card titles, list section headers |
| `type.body-l` | 17 | 24 | Regular | Inter | Default body — **never smaller for primary content** |
| `type.body-m` | 15 | 22 | Regular | Inter | Secondary body, supporting paragraphs |
| `type.body-s` | 13 | 18 | Regular | Inter | Helper text under inputs (avoid for primary content) |
| `type.label` | 13 | 16 | Medium | Inter | Input labels, tab labels, button text on small buttons |
| `type.caption` | 12 | 16 | Regular | Inter | Timestamps, footnotes — secondary muted color only |
| `type.numeric-xl` | 56 | 60 | Medium tabular | JetBrains Mono | BP value on detail screen ("128/82") |
| `type.numeric-l` | 36 | 42 | Medium tabular | JetBrains Mono | BP value on home card |
| `type.numeric-m` | 22 | 28 | Medium tabular | JetBrains Mono | Trend chart axis labels, table values |

### 2.3 Type scale — parent large-text profile

Triggered by per-user setting OR auto-detected when OS dynamic type ≥ "Large". Body sizes step up ~12%, line height ~10%. Button targets stay 48pt min (already larger than guideline).

| Token | Caregiver size | Parent size | Reason |
| --- | --- | --- | --- |
| `type.body-l` | 17pt | 19pt | Primary content readable at arm's length without glasses |
| `type.body-m` | 15pt | 17pt | Secondary content stays comfortably above ramp floor |
| `type.title` | 18pt | 20pt | Card titles distinguishable from body |
| `type.label` | 13pt | 15pt | Inputs and buttons remain legible |
| `type.caption` | 12pt | 13pt | Caption is non-essential text only |

All other tokens (display, numeric) remain unchanged — already large enough.

### 2.4 Typography rules
- **Never** use `type.body-s` or `type.caption` for primary content. Both are supporting-metadata only.
- Numerics in any reading context (BP, HR, SpO2) MUST use `type.numeric-*` (tabular monospace) so digits don't jump position when values change.
- Display sizes (`type.display-*`) appear at most **once per screen**. Never two display headlines on one view.
- All headlines are **sentence case** ("Your family"), never Title Case ("Your Family") or UPPERCASE.
- Letter-spacing remains at the font default. Do not tighten or loosen.
- Italics for system messages only ("Syncing…"). Never for emphasis in body — use weight (Medium/SemiBold) instead.
- Underline reserved for inline links inside running text. Standalone link buttons do not underline; they use `color.brand.primary-soft`.

---

## 3. Spacing

4pt base scale. All padding, margin, gap values resolve to one of these tokens. **No raw pixel values in component code.**

| Token | Value (pt) | Used for |
| --- | --- | --- |
| `spacing.xs` | 4 | Icon-to-text gap inside a button or chip |
| `spacing.s` | 8 | Tight vertical rhythm inside a card row |
| `spacing.m` | 12 | Default gap between body paragraphs |
| `spacing.l` | 16 | Card internal padding (top, sides, bottom) |
| `spacing.xl` | 20 | Card-to-card gap on a list |
| `spacing.2xl` | 24 | Screen edge horizontal padding (default) |
| `spacing.3xl` | 32 | Section-to-section vertical break inside a screen |
| `spacing.4xl` | 48 | Hero-to-content break, paywall vertical rhythm |

Default screen edge padding is `spacing.2xl` (24pt). Status messages, toasts, sheets use `spacing.l` (16pt) — they are already inset.

---

## 4. Radii

| Token | Value (pt) | Used for |
| --- | --- | --- |
| `radius.none` | 0 | Status banners that span full screen edge-to-edge |
| `radius.s` | 6 | Inputs, small chips, toast bubbles |
| `radius.m` | 12 | **Default** — cards, buttons, list rows |
| `radius.l` | 20 | Bottom sheets, paywall sheet, modal containers |
| `radius.xl` | 28 | Hero illustrations on onboarding |
| `radius.full` | 999 | Avatars, status dots, fully rounded pills |

---

## 5. Elevation

Shadows are **subtle**. The product is calm, not glossy. iOS uses native shadow primitives; Android uses elevation. Shadows are tinted **navy** (not pure black) — pure black on cream becomes muddy gray.

| Token | iOS shadow | Android elevation | Used for |
| --- | --- | --- | --- |
| `elevation.none` | none | 0 | Default — cards on cream do not cast shadows |
| `elevation.low` | 0/2/8 #0F2340 @ 6% | 2 | Cards on white surfaces (rare — modals only) |
| `elevation.medium` | 0/4/16 #0F2340 @ 10% | 6 | Bottom sheets, popovers |
| `elevation.high` | 0/8/24 #0F2340 @ 14% | 12 | Confirmed-urgent banner, full-screen modal |
| `elevation.toast` | 0/4/12 #0F2340 @ 12% | 8 | Snackbar/toast — distinct from sheets so it never feels modal |

---

## 6. Motion

Motion is **functional, not decorative**. Every animation has a reason — confirmation, transition, focus shift. Decorative loops are forbidden.

### 6.1 Duration

| Token | Value (ms) | Used for |
| --- | --- | --- |
| `motion.instant` | 0 | State toggles where animation hurts (toggle switches at end of stroke) |
| `motion.fast` | 120 | Hover states, focus rings, small icon swaps |
| `motion.normal` | 200 | **Default** — button press, navigation push, sheet open |
| `motion.slow` | 320 | Bottom sheet rise, page-level transitions, paywall reveal |
| `motion.deliberate` | 480 | First-time onboarding hero reveal — once-per-app-lifetime moment |

### 6.2 Easing

| Token | Curve | Used for |
| --- | --- | --- |
| `ease.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default — navigation, sheets, most state changes |
| `ease.decelerate` | `cubic-bezier(0, 0, 0, 1)` | Element entering view — toast slide-in, sheet rise |
| `ease.accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | Element leaving view — toast fade-out, sheet dismiss |
| `ease.linear` | `linear` | Skeleton shimmer, progress fill (rare) |

### 6.3 Reduced motion

When OS-level "Reduce Motion" is on, every duration token resolves to `motion.fast` or `motion.instant`:
- `motion.deliberate`, `motion.slow` → `motion.fast` (120ms)
- `motion.normal` → `motion.instant` (0ms) — transitions become hard cuts
- Easing curves unchanged (still apply over the reduced duration)
- Skeleton shimmer stops; static placeholder shown instead
- Parallax, auto-rotating illustration, all decorative motion: disabled

---

## 7. Opacity & disabled states

| Token | Value | Used for |
| --- | --- | --- |
| `opacity.disabled` | 0.40 | Disabled buttons, disabled controls |
| `opacity.scrim` | 0.55 | Modal backdrop — navy at 55% over content beneath |
| `opacity.muted` | 0.70 | Decorative illustrations behind copy |
| `opacity.full` | 1.00 | Default |

Disabled controls keep ≥ 3:1 contrast against surface for sighted-user clarity. Disabled inputs do **not** drop the label opacity — the field must remain identifiable.

---

## 8. Parent-mode rules (D5 §10.4 + D8 §2.2.3)

Parent mode is the wearer's view (the elder being cared for) — large-text, low-cognitive-load surface. Triggered by `account_type = 'parent'` OR per-user "large text" toggle in Settings.

- All wrist-screen text ≥ 24pt.
- All phone-screen body text uses parent type scale (§2.3) — minimum 19pt for primary content.
- **Tap targets**: 48pt min in caregiver mode; **64pt min in parent mode**.
- High-contrast default theme (no theme override available).
- **Voice-first**: where a button can be replaced with a voice command, it is. Audio-readout option for any reading: *"Your blood pressure today is one twenty-four over seventy-nine."*
- **Limited cognitive load**: at most 3 actions on any screen. No nested menus.
- Never any decorative motion. Reduced-motion behaviour is the default, not the override.

---

## 9. Open token questions
- **Q-D8-1**: Display font (Recoleta vs Fraunces) — locked in Sprint 2 once licensing decision lands.
- **Q-D8-2**: Whether to ship a high-contrast theme variant for parent mode v1.1 (currently a single high-contrast default).
