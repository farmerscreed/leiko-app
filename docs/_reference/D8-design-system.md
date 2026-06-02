> **📎 Historical reference (stamped 2026-06-02).** This is a dated strategy/spec snapshot, kept for context — **not** living spec. For the app's current behaviour see the docs in `docs/00–15`, `docs/04-screens/`, and the decisions in `docs/_adr/`. Where this document and the shipped app disagree, the app + ADRs win.

D8  —  Design System Specification  •  Leiko v1.0

**D8**

**Design System Specification**

Leiko — Caregiver Blood Pressure Monitoring App

**Version 1.0**

Status: Draft for Implementation

Prepared for: LawOne Cloud LLC

Date: May 2026

*Confidential*

*This document defines the Leiko design system: tokens, components, screens, voice and accessibility rules. It is the single source of truth for all UI implementation across iOS and Android.*


# **Document Metadata**

|**Field**|**Value**|
| :- | :- |
|Document|D8 — Design System Specification|
|Version|1\.0|
|Status|Draft for Implementation|
|Owner|Founder / Design Lead|
|Audience|Designers, mobile engineers, copywriters, QA, accessibility reviewer|
|Source documents|D5 Brand Brief v1.0, D6 PRD v1.0, D7 TRD v1.0|
|Implementation target|React Native (Expo bare) — iOS 15+, Android 9+ (API 28)|
|Theme support|Light only at MVP (dark mode V2 — see §8)|
|Locale support|English at MVP; structure supports en-NG, en-US, fr, sw, ar, hi, zh, es, pt-BR|
|Last updated|May 2026|


## **Document Purpose**
This is the implementation contract between design intent and shipped code. Every screen, component, color and string in the Leiko app must trace back to a token, component or rule defined in this document. If something is not specified here, it is not in the system — raise it as a design question (see §10) before adding it to a build.

This document does not replace D5 (which carries the strategic brand rationale) or D7 (which defines the technical architecture). It sits between them: D5 says why the app feels this way, D8 says exactly how to build that feeling, D7 says what code stack delivers it.
## **Reading Order**
Sections are ordered foundation → atoms → molecules → screens → cross-cutting rules. If you are starting a feature, read §2 (tokens) and §7 (accessibility) first — those constraints apply everywhere.


# **Executive Summary**
Leiko is a caregiver-first health app: an adult child checks on a parent’s blood pressure trends from a different city, sometimes a different country. The product wins on emotional fit before it wins on features — the app must feel calm, dignified and non-alarmist on a Tuesday-morning anomaly notification when a daughter is about to walk into a meeting in Lagos and her father in Ibadan slept poorly last night. That emotional contract is what this design system encodes.
## **Six Decisions That Shape Everything Below**

|**Decision**|**What it locks**|**Why**|
| :- | :- | :- |
|Warm cream as primary surface (not white)|background-base = #F5EFE6|Differentiator vs. clinical white — D5 §4.1. Reduces glare; reads as domestic, not hospital.|
|Navy as primary brand, amber as accent only|primary = #0F2340; accent = #E89F4F used ≤ 15% of any screen|Trust over excitement. Amber for one CTA per view, never as base.|
|Typography ramp tops at 36pt for parent UX, body never below 17pt|display-l = 36, body-l = 17|Parent users skew 55+; D5 §10.2 minimum legibility rule.|
|Anomaly banners use Calm-Concerned tone, never Crimson alone|anomaly = amber background + navy icon, crimson reserved for confirmed-urgent only|D5 §3.5 — Crimson on every reading trains alarm fatigue.|
|Light mode only at MVP|No dark token set ships in v1.0|Cream background is the brand. Dark mode is V2 with full a11y re-test — see §8.|
|English copy first, structure i18n-ready|Every string keyed; no hardcoded text|Nigeria + diaspora launch. D7 ADR-016 (i18next) wired before launch even though only en ships.|


## **What This Document Is Not**
- A marketing brand book. D5 covers brand strategy, voice rationale and naming.
- A product spec. D6 PRD owns user stories, acceptance criteria and feature scope.
- A technical architecture document. D7 TRD owns stack, data model, API surface and BLE protocol.
- An exhaustive Figma library. The Figma source-of-truth file lives separately; this document specifies what the Figma file must contain and how it must behave.



|<p>**How to use this document with Figma**</p><p>When a token, component or screen disagrees between this document and Figma, this document wins for v1.0. After launch, the Figma file becomes the daily working surface and changes are reflected back into D8 v1.1 quarterly.</p>|
| :- |


# **1. Foundations & Principles**
## **1.1 Design Principles**
Six principles, in order. When two conflict during a design review, the higher one wins.

|**#**|**Principle**|**Practical implication**|
| :- | :- | :- |
|1|Calm before clever|No animations that draw attention to the app itself. No gamification of health data. No streaks, no badges, no medals.|
|2|Dignity for the parent|Parent never appears as “patient”, “loved one”, “elder”, “monitored user”. Parent’s name first, role second.|
|3|Trust through restraint|One primary CTA per screen. White space is a feature. If unsure whether to add a UI element, do not add it.|
|4|Health is shared, not surveilled|Parent always sees what caregiver sees. No hidden data flows. Permissions explicit and reversible.|
|5|Emotional accuracy of state|A normal reading must feel reassuring. A genuine anomaly must feel like a friend tapping your shoulder, not a fire alarm.|
|6|Implementable, not aspirational|Every spec in this document must work at 320pt screen width on a 3-year-old Android phone with intermittent connectivity.|


## **1.2 The Three Tones in UI**
From D5 §3.5. Each tone maps to specific visual treatments. Designers and copywriters must agree which tone applies before writing copy or choosing colors.

|**Tone**|**When to use**|**Visual treatment**|**Copy treatment**|
| :- | :- | :- | :- |
|Reassuring|Daily readings within range, sync confirmations, routine empty states, quiet weeks.|Cream surface, navy text, optional amber dot for accent. No banners, no icons besides system.|Direct, brief, present tense. “All calm this morning.” “128/82 — within range.”|
|Informative|Education cards, FAQ, onboarding, subscription explainer, what-an-anomaly-means screen.|Cream surface, navy headers, teal sub-headers, supporting illustrations allowed.|Explanatory, second person, no medical claims. “BP varies through the day. Morning readings tend to be higher.”|
|Calm-Concerned|Genuine anomaly (3 of last 5 readings out of range), missed reading streaks, family member needs invitation re-sent.|Amber background banner (NOT crimson), navy icon, navy text on cream. Crimson reserved for confirmed-urgent (e.g., 3 consecutive readings >180 systolic).|“We noticed something. Three readings this week were higher than usual. Worth a chat with Dad.”|


## **1.3 Anti-Patterns We Refuse to Ship**
These are explicitly disallowed across the system. A design review must reject any screen that violates one of these.

- Crimson as a default state color. Crimson appears only when a clinically validated threshold is crossed (see D6 anomaly logic).
- Push notifications outside parent quiet hours (22:00–07:00 in parent’s local timezone) for non-urgent content. See D7 §8.
- Streaks, badges, leaderboards, points, levels, awards. Health is not a game.
- Marketing copy inside the product surface. The paywall explains value, it does not sell.
- The word “patient” in any user-facing string. The word “smartwatch” as the primary noun for the device — use “the watch” after first reference.
- Modal dialogs that require dismissal to view content (paywall is the only exception, and only after first 5 readings).
- Skeleton loaders that animate a shimmer for >800ms. After 800ms, switch to a static placeholder with “Still loading…” copy.
- Auto-play sound or haptics on any non-urgent screen. Haptics allowed only on: confirmed pairing, manual reading completion, urgent alert.



|<p>**D5 voice anti-patterns recap**</p><p>Never “predicts strokes”. Never “AI Pulse Diagnosis”. Never “diagnoses hypertension”. Never “medical-grade”. Never “continuous BP monitoring”. Never “replaces doctor visit”. Never “treats”, “cures”. See D5 §6.4 for the full forbidden-claims list — it applies to every UI string, push notification, paywall, error message and empty state.</p>|
| :- |
## **1.4 Two-User Reality**
Every screen needs to be evaluated against two distinct users:

- Caregiver (primary buyer): adult child, 28–55, Lagos / London / Houston / Toronto. Owns the subscription. Smartphone-native. Checks app 1–3 times per week, mostly when an anomaly notification arrives. Browses trends, leaves comments, asks the AI assistant questions.
- Parent (primary wearer, secondary user): 55–80, Ibadan / Aba / Owerri. Wears the watch. Receives tap-to-confirm interactions and large-text summaries. Possibly takes manual readings on phone if comfortable with the app. Reads in their own timezone, in their preferred language (English, Yoruba, Igbo, Hausa at launch).



Every screen specification in §4 marks which user(s) it serves. Parent-side screens use the large-text profile by default (body-xl = 19pt, display-l unchanged). Caregiver-side screens use the standard ramp.
## **1.5 Platform Stance**
Leiko follows platform conventions where they help and breaks them where they hurt the brand.

|**Element**|**Stance**|**Reason**|
| :- | :- | :- |
|Tab bar|Bottom on iOS and Android|Reachability for parent users, consistent across platforms.|
|Navigation|Native stack on each platform (iOS push, Android slide)|Familiar; cheap to ship via React Navigation v7 (D7 ADR-003).|
|Modals|Bottom sheet (both platforms)|Easier to dismiss for arthritic thumbs; matches modern Android pattern.|
|Date pickers|Native pickers|Localisation handled by OS — critical for diaspora launch.|
|Typography|Custom (Inter + Recoleta)|Brand differentiation; system fonts ship as fallback.|
|Iconography|Phosphor Icons (Regular weight)|Single library both platforms; calm geometric style — see §5.|
|Haptic feedback|iOS UIImpactFeedbackGenerator / Android VIBRATOR\_SERVICE|Native APIs only; no JS-thread haptics that drift.|


# **2. Design Tokens**
Tokens are the atoms of the design system. Every component, screen and CSS-in-JS file references tokens by semantic name — never by raw hex, raw pt, or raw ms. This is enforced in code review.

|<p>**Naming convention**</p><p>Token names follow [category].[semantic-role].[modifier]. Example: color.text.primary, color.surface.elevated, spacing.m, type.body-l. Raw palette values (color.palette.navy-900) exist for theming only — do not reference them in components.</p>|
| :- |
## **2.1 Color**
Two layers: a raw palette (every hex from D5 §4.1, plus a small number of system colors), and a semantic layer that components consume. Components must only consume the semantic layer. The raw palette exists so the semantic layer can be remapped for dark mode (V2) without touching component code.
### **2.1.1 Raw Palette (from D5 §4.1)**

|**Token**|**Hex**|**Role in D5**|
| :- | :- | :- |
|palette.navy.900|#0F2340|Deep Navy — primary brand|
|palette.navy.700|#2A5F7F|Calm Teal — sub-headings, secondary brand|
|palette.amber.500|#E89F4F|Warm Amber — accent, single CTA per screen|
|palette.crimson.700|#8C2D2D|Signal Crimson — confirmed-urgent only, NEVER default|
|palette.cream.100|#F5EFE6|Warm Cream — primary surface|
|palette.cream.200|#E8E2D5|Soft Taupe — secondary surface, table alt rows|
|palette.cream.300|#D6CFC2|Border Stone — dividers, card borders|
|palette.white|#FFFFFF|Pure White — elevated surfaces, modals|
|palette.text.primary|#1B2540|Body text on cream|
|palette.text.secondary|#5A6478|Muted text, captions, timestamps|
|palette.success.500|#2F7A3F|Reading-confirmed-in-range states (system color, NOT in D5)|


### **2.1.2 Semantic Tokens (consumed by components)**

|**Token**|**Light value**|**Used for**|
| :- | :- | :- |
|color.brand.primary|palette.navy.900|Logo, primary buttons, headers|
|color.brand.primary-soft|palette.navy.700|Sub-headers, secondary navigation, link text|
|color.brand.accent|palette.amber.500|Single primary CTA per screen, anomaly banners (calm-concerned)|
|color.surface.base|palette.cream.100|Default screen background|
|color.surface.subtle|palette.cream.200|Cards on cream, alternate table rows|
|color.surface.elevated|palette.white|Modals, bottom sheets, paywall sheet|
|color.border.default|palette.cream.300|Card borders, input borders, dividers|
|color.border.strong|palette.navy.700|Focused input borders, active tab indicator|
|color.text.primary|palette.text.primary|Body copy, headlines|
|color.text.secondary|palette.text.secondary|Timestamps, helper text, disabled labels|
|color.text.on-brand|palette.white|Text on navy or amber backgrounds|
|color.state.success|palette.success.500|Reading confirmation, sync success|
|color.state.warning|palette.amber.500|Calm-concerned anomalies, missed reading reminders|
|color.state.urgent|palette.crimson.700|Confirmed clinical threshold breach ONLY (D6 anomaly logic)|
|color.focus.ring|palette.navy.700|3pt outline on keyboard focus, 2:1 contrast against any surface|


### **2.1.3 Color-Use Quotas (per screen)**
To prevent visual drift, the system enforces approximate area quotas. These are reviewed by eye in design review, not by automated tooling.

|**Color band**|**Approximate area share**|**Rule**|
| :- | :- | :- |
|Cream surfaces (cream.100 + cream.200)|60–80%|The visual base. If a screen feels white-dominant, it is wrong.|
|Navy text + UI|15–30%|Headers, primary text, primary buttons.|
|Amber accent|≤ 10%|One primary CTA, optional accent dot, calm-concerned banner. Never a background block larger than a button.|
|Crimson|0% on a normal screen|Only appears when a confirmed clinical threshold is breached. Removing it from a screen by default is the design default.|
|White surfaces|Modal layer only|Never the base background. Reserved for elevated/temporary surfaces.|


### **2.1.4 Contrast Verification (WCAG 2.2)**
All foreground/background pairings used in production must meet at least WCAG 2.2 AA (4.5:1 for body text, 3:1 for large text and graphical objects). The pairings below are pre-verified and must be used exclusively. New pairings require an accessibility review.

|**Foreground**|**Background**|**Ratio**|**Meets**|**Used for**|
| :- | :- | :- | :- | :- |
|Navy #0F2340|Cream #F5EFE6|12\.4:1|AAA|Body text default, all headings|
|Navy #0F2340|White #FFFFFF|15\.1:1|AAA|Modal text|
|Teal #2A5F7F|Cream #F5EFE6|5\.7:1|AA|Sub-headings, link text|
|Muted #5A6478|Cream #F5EFE6|4\.6:1|AA|Body secondary text (timestamps, helper)|
|White #FFFFFF|Navy #0F2340|15\.1:1|AAA|Text on primary buttons|
|Navy #0F2340|Amber #E89F4F|4\.7:1|AA|Text on amber CTA, anomaly banner text|
|White #FFFFFF|Crimson #8C2D2D|7\.6:1|AAA|Text on confirmed-urgent banner|
|Navy #0F2340|Taupe #E8E2D5|11\.2:1|AAA|Text on subtle cards|


## **2.2 Typography**
### **2.2.1 Font Stack**
Two font families ship in v1.0. Both are loaded as bundled assets to remove first-paint flicker. Fallbacks ensure graceful degradation if a custom font fails to load.

|**Family**|**Use**|**License**|**Loading strategy**|
| :- | :- | :- | :- |
|Inter|All UI body, controls, captions, numerics|OFL 1.1 / free|Bundled .ttf assets (Regular, Medium, SemiBold, Bold + Tabular) via expo-font|
|Recoleta|Display headlines on landing surfaces (paywall, onboarding, family-circle hero)|Paid (Latinotype) — single-app license|Bundled .otf (Regular, Bold) via expo-font|
|Fraunces (fallback)|If Recoleta budget rejected|OFL 1.1 / free|Bundled — swap is one token change, see §2.2.4|
|JetBrains Mono|Numeric readings (BP values, SpO2, heart rate) where tabular alignment matters|OFL 1.1 / free|Bundled (Regular, Medium)|



|<p>**Display font decision (Q-D8-1, see §10)**</p><p>Default lock: Recoleta if licensing approved by Sprint 2; Fraunces if not. Either way, the only token that changes is type.display-family. Switching is a one-line edit.</p>|
| :- |
### **2.2.2 Type Scale (Caregiver default)**

|**Token**|**Size (pt)**|**Line height**|**Weight**|**Family**|**Used for**|
| :- | :- | :- | :- | :- | :- |
|type.display-xl|48|52|Bold|Recoleta|Hero on paywall, onboarding intro — once per flow|
|type.display-l|36|42|Bold|Recoleta|Section heroes (family circle title)|
|type.display-m|28|34|Bold|Recoleta|Card heroes — BP reading on detail screen|
|type.headline|22|28|SemiBold|Inter|Screen titles, tab headers|
|type.title|18|24|SemiBold|Inter|Card titles, list section headers|
|type.body-l|17|24|Regular|Inter|Default body — NEVER smaller for primary content|
|type.body-m|15|22|Regular|Inter|Secondary body, supporting paragraphs|
|type.body-s|13|18|Regular|Inter|Helper text under inputs (avoid for primary content)|
|type.label|13|16|Medium|Inter|Input labels, tab labels, button text on small buttons|
|type.caption|12|16|Regular|Inter|Timestamps, footnotes, captions — secondary muted color only|
|type.numeric-xl|56|60|Medium tabular|JetBrains Mono|BP value on detail screen (“128/82”)|
|type.numeric-l|36|42|Medium tabular|JetBrains Mono|BP value on home card|
|type.numeric-m|22|28|Medium tabular|JetBrains Mono|Trend chart axis labels, table values|


### **2.2.3 Type Scale (Parent large-text profile)**
Triggered by per-user setting or auto-detected when OS dynamic type ≥ “Large”. All body sizes step up by ~12%, line height by ~10%, button targets stay 48pt min height (already larger than guideline).

|**Token**|**Caregiver size**|**Parent size**|**Reason**|
| :- | :- | :- | :- |
|type.body-l|17pt|19pt|Primary content readable at arm’s length without glasses|
|type.body-m|15pt|17pt|Secondary content stays comfortably above ramp floor|
|type.title|18pt|20pt|Card titles distinguishable from body|
|type.label|13pt|15pt|Inputs and buttons remain legible|
|type.caption|12pt|13pt|Caption is only used for non-essential text|



All other tokens (display, numeric) remain unchanged — they are already large enough.
### **2.2.4 Typography Rules**
- Never use type.body-s or type.caption for primary content. Both exist for supporting metadata only.
- Numerics in any reading context (BP, HR, SpO2) MUST use type.numeric-\* (tabular monospace) so digits do not jump position when values change.
- Display sizes (type.display-\*) appear at most once per screen. Never two display headlines on one view.
- All headlines are sentence case (“Your family”), never Title Case (“Your Family”) or UPPERCASE.
- Letter-spacing remains at the font default. Do not tighten or loosen — it disrupts cross-platform rendering.
- Italics are used for system messages only (“Syncing…”). Never for emphasis in body copy — use weight (Medium/SemiBold) instead.
- Underline is reserved for inline links inside running text. Standalone link buttons do not underline; they use color.brand.primary-soft.


## **2.3 Spacing**
A 4pt base scale. All padding, margin and gap values resolve to one of these tokens. No raw pixel values in component code.

|**Token**|**Value (pt)**|**Used for**|
| :- | :- | :- |
|spacing.xs|4|Icon-to-text gap inside a button or chip|
|spacing.s|8|Tight vertical rhythm inside a card row|
|spacing.m|12|Default gap between body paragraphs|
|spacing.l|16|Card internal padding (top, sides, bottom)|
|spacing.xl|20|Card-to-card gap on a list|
|spacing.2xl|24|Screen edge horizontal padding (default)|
|spacing.3xl|32|Section-to-section vertical break inside a screen|
|spacing.4xl|48|Hero-to-content break, paywall vertical rhythm|



Default screen edge padding is spacing.2xl (24pt) on both sides. Status messages, toasts and sheets use spacing.l (16pt) edge padding because they are already inset.
## **2.4 Radii**

|**Token**|**Value (pt)**|**Used for**|
| :- | :- | :- |
|radius.none|0|Status banners that span the full screen edge-to-edge|
|radius.s|6|Inputs, small chips, toast bubbles|
|radius.m|12|Default — cards, buttons, list rows|
|radius.l|20|Bottom sheets, paywall sheet, modal containers|
|radius.xl|28|Hero illustrations on onboarding|
|radius.full|999|Avatars, status dots, fully rounded pills|



The default for any new container is radius.m (12pt). The system has a soft, organic feel — hard 0pt corners are reserved for full-bleed banners.
## **2.5 Elevation**
Shadows in Leiko are subtle. The product is calm, not glossy. iOS uses native shadow primitives; Android uses elevation (which Material translates to shadow).

|**Token**|**iOS shadow**|**Android elevation**|**Used for**|
| :- | :- | :- | :- |
|elevation.none|no shadow|0|Default — cards on cream background do not cast shadows|
|elevation.low|0/2/8 #0F2340 @ 6% opacity|2|Cards on white surfaces (rare — modals only)|
|elevation.medium|0/4/16 #0F2340 @ 10% opacity|6|Bottom sheets, popovers|
|elevation.high|0/8/24 #0F2340 @ 14% opacity|12|Confirmed-urgent banner, full-screen modal|
|elevation.toast|0/4/12 #0F2340 @ 12% opacity|8|Snackbar/toast — distinct from sheets so it never feels modal|



Shadows are tinted navy (not pure black). The cream surface neutralises pure black shadows into a muddy gray. Navy preserves brand cohesion.
## **2.6 Motion**
Motion in Leiko is functional, not decorative. Every animation has a reason — confirmation, transition, or focus shift. Decorative loops are forbidden (see §1.3 anti-patterns).
### **2.6.1 Duration Tokens**

|**Token**|**Value (ms)**|**Used for**|
| :- | :- | :- |
|motion.instant|0|State toggles where animation hurts (toggle switches at end of stroke)|
|motion.fast|120|Hover states, focus rings, small icon swaps|
|motion.normal|200|Default — button press, navigation push, sheet open|
|motion.slow|320|Bottom sheet rise, page-level transitions, paywall reveal|
|motion.deliberate|480|First-time onboarding hero reveal — once-per-app-lifetime moment|


### **2.6.2 Easing Tokens**

|**Token**|**Curve**|**Used for**|
| :- | :- | :- |
|ease.standard|cubic-bezier(0.2, 0, 0, 1)|Default — navigation, sheets, most state changes|
|ease.decelerate|cubic-bezier(0, 0, 0, 1)|Element entering view — toast slide-in, sheet rise|
|ease.accelerate|cubic-bezier(0.3, 0, 1, 1)|Element leaving view — toast fade-out, sheet dismiss|
|ease.linear|linear|Skeleton shimmer, progress fill (rare)|


### **2.6.3 Reduced Motion**
When the user has “Reduce Motion” enabled at OS level, every duration token resolves to motion.fast or motion.instant. Specifically:

- motion.deliberate, motion.slow → motion.fast (120ms)
- motion.normal → motion.instant (0ms) — transitions become hard cuts
- Easing curves are unaffected (still apply over the reduced duration)
- Skeleton shimmer animations stop; static placeholder is shown instead
- Parallax, auto-rotating illustration, and any decorative motion is disabled entirely


## **2.7 Opacity & Disabled States**

|**Token**|**Value**|**Used for**|
| :- | :- | :- |
|opacity.disabled|0\.40|Disabled buttons, disabled controls|
|opacity.scrim|0\.55|Modal backdrop — navy at 55% over content beneath|
|opacity.muted|0\.70|Decorative illustrations behind copy|
|opacity.full|1\.00|Default|



Disabled controls also lower contrast — ensure disabled text retains at least 3:1 contrast against the surface for sighted-user clarity. Disabled inputs do NOT remove the label — the label remains at full opacity so the field remains identifiable.


# **3. Component Library**
Each component below is specified as: anatomy (parts), variants (versions), states (per variant), accessibility, and example use. Components are the molecules of the system — they consume tokens (§2) and are consumed by screens (§4).

|<p>**Implementation note**</p><p>Each component will live in apps/mobile/src/design-system/components/ as a single TSX file with its own props interface, default props, and Storybook story (D7 §12). The Storybook story must enumerate every state listed below — missing states fail PR review.</p>|
| :- |
## **3.1 Button**
### **Anatomy**
- Container: padding spacing.l horizontal, spacing.m vertical, radius.m, min-height 48pt (touch target)
- Optional leading icon (16pt, spacing.xs gap before label)
- Label: type.label (Caregiver) or type.body-l (parent flows)
- Optional trailing icon — only for "external" or "navigate" affordance, never for primary action


### **Variants**

|**Variant**|**Background**|**Text**|**Border**|**Used for**|
| :- | :- | :- | :- | :- |
|primary|color.brand.primary (navy)|color.text.on-brand (white)|none|Single primary action per screen|
|accent|color.brand.accent (amber)|color.text.primary (navy)|none|CTA on paywall, confirm-pairing, confirm-anomaly-noted. Reserved.|
|secondary|transparent|color.brand.primary (navy)|1pt color.brand.primary|Secondary actions on the same screen as primary|
|ghost|transparent|color.brand.primary-soft (teal)|none|Tertiary or text-style actions (Cancel, Skip)|
|destructive|transparent|color.state.urgent (crimson)|1pt color.state.urgent|Remove family member, delete account, sign out from all devices|


### **States (apply to every variant)**

|**State**|**Visual change**|
| :- | :- |
|default|As specified in variant table|
|pressed|Background darkens 8% (or lightens 8% for ghost/secondary). Scale 0.98 over motion.fast.|
|disabled|opacity.disabled (0.40) on whole button. No press feedback. Cursor not-allowed on web.|
|loading|Label hidden, spinner (Phosphor CircleNotch, rotating, motion.linear duration 1s) replaces it. Button remains pressed-look.|
|focused|3pt color.focus.ring outline at 2pt offset — keyboard / TalkBack only.|


### **Accessibility**
- accessibilityRole: "button"
- accessibilityLabel: same as visible label, plus state suffix when relevant ("Sign in, button, loading")
- accessibilityHint: only when action is non-obvious from label ("Opens paywall")
- Min 48x48pt hit area enforced via padding — never via marginless invisible padding
- Disabled buttons: accessibilityState: { disabled: true }


## **3.2 Input**
### **Anatomy**
- Label above the input (type.label, color.text.primary, spacing.xs below)
- Container: 1pt border color.border.default, radius.s, padding spacing.l horizontal / spacing.m vertical, min-height 48pt
- Placeholder: type.body-l, color.text.secondary
- Input text: type.body-l, color.text.primary
- Helper / error text below: type.body-s, color.text.secondary or color.state.urgent


### **Variants**

|**Variant**|**Behaviour**|
| :- | :- |
|text|Default|
|email|autoCapitalize=none, autoCorrect=false, keyboardType=email-address, autoComplete=email|
|password|secureTextEntry=true, with show/hide toggle (eye icon, top-right inside container)|
|phone|keyboardType=phone-pad, country-code prefix component to the left, libphonenumber validation|
|otp|6 individual cells; auto-advance on entry; SMS auto-fill via expo OTP listener|
|multiline|min 3 rows; expands up to 6 rows then scrolls. Used for reading notes / comments.|
|search|Leading magnifying-glass icon, trailing clear-X when value present. Cream surface allowed.|


### **States**

|**State**|**Visual change**|
| :- | :- |
|default|border = color.border.default|
|focused|border = color.border.strong (2pt), elevation.low|
|error|border = color.state.urgent (2pt), helper text = color.state.urgent, accessibilityInvalid: true|
|disabled|opacity.disabled on container, label remains opacity.full so field is still identifiable|
|readonly|no border, surface = color.surface.subtle, no caret|


### **Accessibility**
- Label is always present and associated via accessibilityLabel — never use placeholder as the only label
- Error messages announced via screen reader on validation (LiveRegion polite)
- Phone and OTP variants must work with autofill — critical for parent users


## **3.3 Reading Card**
The unit element of the home screen. One card per parent, displaying the most recent BP reading + status.
### **Anatomy**
- Container: color.surface.subtle background, radius.m, padding spacing.l, no shadow on cream
- Header row: parent name (type.title) + relationship label (type.caption, muted) + avatar (40pt, top-right)
- BP value row: type.numeric-l in tabular monospace ("128/82") + unit suffix ("mmHg", type.body-m)
- Trend indicator: small chevron (▲ ▼ —) + delta vs 7-day average (type.body-s)
- Timestamp + sync state: type.caption, color.text.secondary, format "Today 7:42am" or relative for >24h ago
- Optional anomaly badge: amber pill, type.caption Bold, navy text, leading exclamation icon


### **States**

|**State**|**Trigger**|**Visual**|
| :- | :- | :- |
|fresh|Reading <24h old, in normal range|Default; no badge|
|stale|Reading 24–72h old|Timestamp uses color.text.secondary; subtle "needs sync" hint|
|silent|No reading in >72h|Card shows muted parent block + "Last reading 4 days ago" — calm-concerned tone|
|anomaly-noted|Reading triggers anomaly logic (D6)|Amber pill badge "Worth a chat", calm-concerned tone|
|confirmed-urgent|Reading >180/120 OR three consecutive >160/100|Crimson left-edge stripe (4pt wide), badge "Talk to Dad now". Crimson appears here ONLY.|
|offline|Sync pending|Small cloud-slash icon, type.caption: "Pending sync"|


## **3.4 Anomaly Banner**
Sits at the top of the home screen when the family has at least one parent with a Calm-Concerned or Confirmed-Urgent state. Replaces a native push notification when the app is foregrounded.
### **Anatomy**
- Full-bleed (no horizontal padding from screen edge), radius.none on top, radius.m on bottom
- Padding: spacing.l vertical, spacing.2xl horizontal
- Leading icon: 24pt Phosphor (Info or WarningCircle), color.text.primary on amber, color.text.on-brand on crimson
- Headline: type.title, color.text.primary or color.text.on-brand
- Body: type.body-m, max 2 lines (truncate …)
- Trailing trailing chevron when tappable, opens detail screen


### **Variants & Tones**

|**Variant**|**Surface**|**Foreground**|**Tone**|**Example copy**|
| :- | :- | :- | :- | :- |
|calm-concerned|color.brand.accent (amber)|color.text.primary (navy)|Calm-Concerned|"We noticed something. Three readings this week were higher than usual. Worth a chat with Dad."|
|confirmed-urgent|color.state.urgent (crimson)|color.text.on-brand (white)|Direct, still calm|"Three readings in the last hour were very high. We recommend reaching out to Mum now."|
|informative|color.surface.subtle (taupe)|color.text.primary (navy)|Informative|"Mum hasn’t taken a reading in 4 days. Send a friendly nudge?"|


### **Stacking Rules**
- Maximum one banner visible at a time. If multiple parents have anomalies, the most severe is shown.
- Severity order: confirmed-urgent > calm-concerned > informative.
- A confirmed-urgent banner is non-dismissible until the caregiver opens it (acknowledgment).
- A calm-concerned banner is dismissible (X button, top-right) but reappears if state persists >24h.


## **3.5 List Row**
### **Anatomy**
- Min height 56pt, padding spacing.l horizontal
- Optional leading: avatar (40pt) or icon (24pt)
- Title: type.body-l + optional subtitle (type.body-s, muted) below
- Optional trailing: chevron, switch, status pill, badge, value (type.body-l, monospace if numeric)
- Divider: 1pt color.border.default below the row, full width except first/last in section


### **Variants**

|**Variant**|**Trailing**|**Use**|
| :- | :- | :- |
|navigation|chevron right|Settings rows, family-member rows, history rows|
|toggle|switch (native)|Notification preferences, large-text mode|
|action|no trailing|Sign out, delete account — destructive variant|
|data|value (right-aligned, monospace if numeric)|Profile fields (Phone: +234…), reading history rows|
|select|check icon when selected|Single-select option lists — timezone, language|


## **3.6 Tab Bar**
Bottom of screen on both iOS and Android. Five tabs maximum, three at MVP.
### **Anatomy**
- Surface: color.surface.elevated (white), 1pt top border color.border.default
- Height: 56pt + safe-area inset bottom
- Each tab: 24pt Phosphor icon (Regular for inactive, Bold for active) + type.label below
- Active tint: color.brand.primary (navy)
- Inactive tint: color.text.secondary
- No badge counts at MVP (avoid notification anxiety — see §1.3 anti-patterns)


### **MVP Tabs**

|**Position**|**Icon (Phosphor)**|**Label**|**Destination**|
| :- | :- | :- | :- |
|1|House|Home|Family-circle home (§4.5)|
|2|ChartLineUp|Trends|Trends inventory (§4.7)|
|3|GearSix|Settings|Settings hub (§4.11)|


## **3.7 Bottom Sheet (and Modal)**
Bottom sheet is the primary modal pattern in Leiko. Full-screen modals are reserved for paywall and onboarding only. Centered dialog modals are NOT used.
### **Anatomy**
- Surface: color.surface.elevated (white), radius.l on top corners, radius.none on bottom
- Drag handle: 4pt high, 32pt wide, color.border.default, centered, spacing.s from top
- Backdrop: navy at opacity.scrim (0.55)
- Padding: spacing.2xl horizontal, spacing.l vertical
- Header (optional): title (type.title) + close button (top right, 24pt X)
- Content: scrolls if exceeds 70% screen height; otherwise sized to content
- Action row (optional): primary CTA full-width OR primary + ghost cancel side-by-side


### **Behaviour**
- Open: slide up from bottom over motion.slow with ease.decelerate
- Dismiss: drag down past 30% threshold, tap backdrop, OR tap close X
- Confirmed-urgent action sheets do NOT dismiss on backdrop tap — require explicit acknowledge
- At keyboard open, sheet pushes up to keep input visible (KeyboardAvoidingView)


## **3.8 Toast**
### **Anatomy**
- Surface: color.surface.elevated (white) with 1pt color.border.default, radius.s
- Padding: spacing.l horizontal, spacing.m vertical
- Optional leading 20pt icon (success: Check; error: WarningCircle; info: Info)
- Message: type.body-m, max 2 lines
- Optional trailing action: type.label, color.brand.primary-soft, single word ("Undo", "Retry")


### **Behaviour**
- Anchored bottom, spacing.l above tab bar (or screen edge if no tab bar)
- Auto-dismiss after 4s (info/success); 6s (error with action); never auto-dismiss if action button is "Retry" on a destructive failure — require user dismissal
- Stacks vertically; max 2 visible — oldest auto-dismisses first
- Slide up from bottom over motion.normal with ease.decelerate; fade out over motion.fast with ease.accelerate


## **3.9 Avatar**
### **Anatomy & Sizes**

|**Token**|**Diameter**|**Used for**|
| :- | :- | :- |
|avatar.xs|24pt|Inline mentions, comment threads|
|avatar.s|32pt|List rows, tab bar profile|
|avatar.m|40pt|Reading card header (default)|
|avatar.l|64pt|Family circle hero, settings profile|
|avatar.xl|96pt|Member detail screen|


### **Variants**
- image — user-uploaded photo, fully rounded (radius.full), object-fit cover
- initials — first letter of first name, type.title (or proportional), color.text.on-brand on randomized but stable navy/teal/amber background
- icon — Phosphor User Regular when no name set


### **States**
- online dot — NOT used at MVP (creates surveillance anxiety, see §1.3)
- anomaly ring — 2pt amber ring around avatar when parent has active calm-concerned state. 2pt crimson for urgent.
- selected — 2pt color.brand.primary ring + check overlay (used in family-member picker)


## **3.10 BP Trend Chart**
Implemented with Victory Native XL (D7 ADR-004). The chart is the most data-dense component in the app and gets the most attention to typography and color use.
### **Anatomy**
- Container: color.surface.subtle (taupe), radius.m, padding spacing.l
- Title row: type.title + range selector (chips: 7d / 30d / 90d, default 30d)
- Y-axis: numeric-m tabular, color.text.secondary, 4 ticks max (e.g., 80 / 110 / 140 / 170)
- X-axis: type.caption, color.text.secondary, sparse labels (every 3rd day for 30d view)
- Two lines: systolic (color.brand.primary, 2pt) and diastolic (color.brand.primary-soft, 2pt dashed)
- In-range band: color.surface.base translucent at 50% across the normal-range zone (90–135 systolic, 60–85 diastolic) — visual reassurance, not a clinical claim
- Data points: 4pt navy dots; anomaly points 6pt amber; confirmed-urgent points 6pt crimson
- Trend annotation: optional teal text bubble at the most recent point if a 7-day delta is significant


### **Interaction**
- Tap anywhere on the chart → vertical line + tooltip showing exact reading and timestamp
- Drag horizontally → line follows finger; tooltip updates
- Pinch → NOT supported at MVP (range chips only)


### **Accessibility**
- Above the chart, an accessible "View as table" button switches to a sortable list of values — essential for screen-reader users
- Each data point has accessibilityLabel: "Tuesday March 4, 132 over 86 mmHg"
- Color is never the sole channel: anomaly points also use a larger size (6pt vs 4pt)


## **3.11 Empty State**
### **Anatomy**
- Centered vertically in the available space, max-width 320pt
- Optional illustration (240x180pt, soft cream/amber palette — see §5.3)
- Headline: type.title, color.text.primary
- Body: type.body-m, color.text.secondary, max 2 lines
- Optional CTA: button.primary or button.secondary, single action only


### **Voice Patterns**
- Always Reassuring tone (§1.2). Never Calm-Concerned in an empty state — there’s nothing concerning yet.
- Headline is the situation, not the action. "No readings yet" — not "Add a reading"
- Body explains why this is fine, not what is missing. "Mum’s watch will start syncing as soon as it’s paired."
- CTA verb is the human action, not the system action. "Pair watch" — not "Initiate device handshake"


## **3.12 Skeleton Loader**
### **Behaviour**
- Used for first-load only — not for re-fetches (those use spinners or just keep the previous content)
- Surface matches the container it represents (cream skeleton on cream surface, etc.)
- Shimmer: linear gradient from cream.200 → cream.300 → cream.200, sliding left-to-right over 1.4s, ease.linear
- After 800ms total, if still loading, transition to a static "Loading…" state with a small spinner, no more shimmer
- Reduced motion: skeleton is static (no shimmer) from the start


## **3.13 Pill / Chip**
### **Anatomy**
- Padding: spacing.s horizontal, spacing.xs vertical, radius.full
- Type: type.caption Bold, all sentence case
- Optional 12pt leading icon, spacing.xs gap


### **Variants**

|**Variant**|**Surface**|**Text**|**Used for**|
| :- | :- | :- | :- |
|neutral|color.surface.subtle|color.text.primary|Time-range selector, filter chips|
|accent|color.brand.accent|color.text.primary|Anomaly-noted badge on reading card|
|urgent|color.state.urgent|color.text.on-brand|Confirmed-urgent badge — reading card only|
|success|color.state.success at 15% on cream|color.state.success|Reading-confirmed-in-range, sync-success|
|outline|transparent + 1pt color.border.default|color.text.primary|Selectable filter chips, multi-select tags|


## **3.14 Parent-Side Tap Confirm (Watch + Phone)**
When the watch sends a reading, the parent’s phone shows a single oversized confirmation card. This is the most-used parent screen — simplicity is total.
### **Anatomy**
- Full-screen take-over (when phone is unlocked) or push notification (when locked)
- Single column, centered, padding spacing.4xl
- Headline: "How are you feeling?" type.display-m
- BP value: type.numeric-xl ("128/82"), centered, color.text.primary
- Two oversized buttons stacked, each 64pt min-height, type.body-l label:
- `  `Primary: "I feel fine" (button.primary, navy)
- `  `Secondary: "Not great today" (button.secondary, navy outline)
- Tertiary tap-target: "This wasn’t me" (button.ghost, smaller, opens reason-code soft-delete modal)



|<p>**Parent-side rule**</p><p>Parent screens use type.body-l (19pt in large-text profile) as the absolute minimum. Tap targets are 64pt minimum (vs. 48pt elsewhere). No screens for parent users are denser than this — if a screen requires more than three buttons, redesign as a sequence.</p>|
| :- |


# **3.15 Token Code Output (React Native)**
The tokens defined in §2 ship as a TypeScript file consumed by every component. Below is the canonical structure — every team member must reference theme.\* via this file, never inline values.
### **apps/mobile/src/design-system/theme.ts**
// SPDX: Internal — LawOne Cloud LLC

// Leiko Design Tokens — v1.0

// This file is THE source of truth at runtime.

// Generated from D8 §2. Do not edit values without a D8 amendment.



export const palette = {

`  `navy900:    '#0F2340',

`  `navy700:    '#2A5F7F',

`  `amber500:   '#E89F4F',

`  `crimson700: '#8C2D2D',

`  `cream100:   '#F5EFE6',

`  `cream200:   '#E8E2D5',

`  `cream300:   '#D6CFC2',

`  `white:      '#FFFFFF',

`  `textPrim:   '#1B2540',

`  `textSec:    '#5A6478',

`  `success500: '#2F7A3F',

} as const;



export const color = {

`  `brand: {

`    `primary:     palette.navy900,

`    `primarySoft: palette.navy700,

`    `accent:      palette.amber500,

`  `},

`  `surface: {

`    `base:     palette.cream100,

`    `subtle:   palette.cream200,

`    `elevated: palette.white,

`  `},

`  `border: {

`    `default: palette.cream300,

`    `strong:  palette.navy700,

`  `},

`  `text: {

`    `primary:   palette.textPrim,

`    `secondary: palette.textSec,

`    `onBrand:   palette.white,

`  `},

`  `state: {

`    `success: palette.success500,

`    `warning: palette.amber500,

`    `urgent:  palette.crimson700,

`  `},

`  `focus: {

`    `ring: palette.navy700,

`  `},

} as const;



export const fontFamily = {

`  `display: 'Recoleta',     // swap to 'Fraunces' if licensing rejected

`  `body:    'Inter',

`  `mono:    'JetBrainsMono',

} as const;



export const type = {

`  `displayXL: { fontFamily: fontFamily.display, fontWeight: '700', fontSize: 48, lineHeight: 52 },

`  `displayL:  { fontFamily: fontFamily.display, fontWeight: '700', fontSize: 36, lineHeight: 42 },

`  `displayM:  { fontFamily: fontFamily.display, fontWeight: '700', fontSize: 28, lineHeight: 34 },

`  `headline:  { fontFamily: fontFamily.body,    fontWeight: '600', fontSize: 22, lineHeight: 28 },

`  `title:     { fontFamily: fontFamily.body,    fontWeight: '600', fontSize: 18, lineHeight: 24 },

`  `bodyL:     { fontFamily: fontFamily.body,    fontWeight: '400', fontSize: 17, lineHeight: 24 },

`  `bodyM:     { fontFamily: fontFamily.body,    fontWeight: '400', fontSize: 15, lineHeight: 22 },

`  `bodyS:     { fontFamily: fontFamily.body,    fontWeight: '400', fontSize: 13, lineHeight: 18 },

`  `label:     { fontFamily: fontFamily.body,    fontWeight: '500', fontSize: 13, lineHeight: 16 },

`  `caption:   { fontFamily: fontFamily.body,    fontWeight: '400', fontSize: 12, lineHeight: 16 },

`  `numericXL: { fontFamily: fontFamily.mono,    fontWeight: '500', fontSize: 56, lineHeight: 60 },

`  `numericL:  { fontFamily: fontFamily.mono,    fontWeight: '500', fontSize: 36, lineHeight: 42 },

`  `numericM:  { fontFamily: fontFamily.mono,    fontWeight: '500', fontSize: 22, lineHeight: 28 },

} as const;



export const spacing = {

`  `xs:  4,

`  `s:   8,

`  `m:   12,

`  `l:   16,

`  `xl:  20,

`  `xl2: 24,

`  `xl3: 32,

`  `xl4: 48,

} as const;



export const radius = {

`  `none: 0,

`  `s:    6,

`  `m:    12,

`  `l:    20,

`  `xl:   28,

`  `full: 999,

} as const;



export const elevation = {

`  `none:   { ios: undefined,                                                        android: 0  },

`  `low:    { ios: { shadowColor: palette.navy900, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 },   android: 2  },

`  `medium: { ios: { shadowColor: palette.navy900, shadowOpacity: 0.10, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16 },  android: 6  },

`  `high:   { ios: { shadowColor: palette.navy900, shadowOpacity: 0.14, shadowOffset: { width: 0, height: 8 }, shadowRadius: 24 },  android: 12 },

`  `toast:  { ios: { shadowColor: palette.navy900, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },  android: 8  },

} as const;



export const motion = {

`  `duration: { instant: 0, fast: 120, normal: 200, slow: 320, deliberate: 480 },

`  `ease:     {

`    `standard:   [0.2, 0, 0, 1],

`    `decelerate: [0, 0, 0, 1],

`    `accelerate: [0.3, 0, 1, 1],

`    `linear:     [0, 0, 1, 1],

`  `},

} as const;



export const opacity = {

`  `disabled: 0.40,

`  `scrim:    0.55,

`  `muted:    0.70,

`  `full:     1.00,

} as const;



export const theme = { color, type, spacing, radius, elevation, motion, opacity, fontFamily, palette };

export type Theme = typeof theme;


### **apps/mobile/src/design-system/tokens.json (Figma export)**
A JSON mirror of the same tokens, intended for import into Figma via the Tokens Studio plugin. The TypeScript file above and this JSON file MUST stay in sync — a CI job validates this on every PR.

{

`  `"color": {

`    `"brand": {

`      `"primary":     { "value": "#0F2340", "type": "color" },

`      `"primarySoft": { "value": "#2A5F7F", "type": "color" },

`      `"accent":      { "value": "#E89F4F", "type": "color" }

`    `},

`    `"surface": {

`      `"base":     { "value": "#F5EFE6", "type": "color" },

`      `"subtle":   { "value": "#E8E2D5", "type": "color" },

`      `"elevated": { "value": "#FFFFFF", "type": "color" }

`    `},

`    `"border": {

`      `"default": { "value": "#D6CFC2", "type": "color" },

`      `"strong":  { "value": "#2A5F7F", "type": "color" }

`    `},

`    `"text": {

`      `"primary":   { "value": "#1B2540", "type": "color" },

`      `"secondary": { "value": "#5A6478", "type": "color" },

`      `"onBrand":   { "value": "#FFFFFF", "type": "color" }

`    `},

`    `"state": {

`      `"success": { "value": "#2F7A3F", "type": "color" },

`      `"warning": { "value": "#E89F4F", "type": "color" },

`      `"urgent":  { "value": "#8C2D2D", "type": "color" }

`    `}

`  `},

`  `"spacing": {

`    `"xs":  { "value": "4",  "type": "spacing" },

`    `"s":   { "value": "8",  "type": "spacing" },

`    `"m":   { "value": "12", "type": "spacing" },

`    `"l":   { "value": "16", "type": "spacing" },

`    `"xl":  { "value": "20", "type": "spacing" },

`    `"xl2": { "value": "24", "type": "spacing" },

`    `"xl3": { "value": "32", "type": "spacing" },

`    `"xl4": { "value": "48", "type": "spacing" }

`  `},

`  `"radius": {

`    `"none": { "value": "0",  "type": "borderRadius" },

`    `"s":    { "value": "6",  "type": "borderRadius" },

`    `"m":    { "value": "12", "type": "borderRadius" },

`    `"l":    { "value": "20", "type": "borderRadius" },

`    `"xl":   { "value": "28", "type": "borderRadius" },

`    `"full": { "value": "999","type": "borderRadius" }

`  `}

}


# **4. Screen Inventory**
Each screen below is specified at MVP scope. The table per screen lists: purpose, audience (caregiver / parent), key components used, primary data shown, primary actions, navigation. Anything not listed is out of scope for v1.0 — raise in §10 if needed.
## **4.1 Splash & Initial Routing**

|**Field**|**Value**|
| :- | :- |
|Audience|Both|
|Purpose|Cold-launch wait state and route resolution (signed in? onboarding done? family setup done?)|
|Components|Centered logo (96pt), motion.deliberate fade-in, spinner appears only after 1.5s|
|Data|Local Watermelon DB read for sessionToken; Supabase /auth/refresh if expired|
|Actions|None (auto-routes)|
|Routes to|§4.2 onboarding (first run), §4.3 sign-in (signed out), §4.5 home (signed in)|


## **4.2 Onboarding (3 screens)**
First-run only. Three screens, each one swipe. Skippable from screen 2 onwards. No accounts created until screen 3.

|**Screen**|**Headline**|**Body**|**CTA**|
| :- | :- | :- | :- |
|4\.2.1|Stay close to the people who shaped you.|Leiko is a calm way to keep an eye on a parent’s health, even from far away.|Continue (button.primary)|
|4\.2.2|Their watch. Your peace of mind.|When your parent’s blood pressure changes, we let you know — gently. No surveillance, no panic.|Continue (button.primary) + Skip (button.ghost)|
|4\.2.3|You drive. They wear.|You set up the watch and pay. They wear it and tap once a day. Everyone sees the same readings.|Get started (button.accent) + Skip (button.ghost)|



- Layout: centered illustration (240x180pt, see §5.3), headline (type.display-l), body (type.body-l, max-width 280pt), CTAs at bottom of safe area
- Page indicator: 3 dots, active = navy, inactive = stone, motion.normal animated
- Skip: only visible from screen 2; routes directly to sign-in
- Once completed, never shown again (flag stored in MMKV)


## **4.3 Sign In / Sign Up**

|**Field**|**Value**|
| :- | :- |
|Audience|Caregiver primarily; Parent on invitation flow|
|Purpose|Establish identity (Magic link, Google, Apple)|
|Components|Logo (top), Email input, "Continue with email" (button.primary), divider, "Continue with Apple" / "Continue with Google" (button.secondary), small "By continuing you agree…" footer|
|Validation|Email format check via input.email variant; OTP verify on next screen|
|Tone|Reassuring — "Welcome back" / "Let’s get you signed in"|
|Routes to|§4.4 family setup (new user), §4.5 home (returning)|


## **4.4 Family Setup (caregiver first-time)**
Creates a family record and the first parent placeholder. 3 sub-screens.

|**Sub-screen**|**Purpose**|**Inputs / actions**|
| :- | :- | :- |
|4\.4.1 You|Capture caregiver own name + relationship pronoun (Daughter, Son, Niece, Other)|input.text "What should we call you?"; chip-select pronoun|
|4\.4.2 Who you’re looking after|Capture parent name + relationship + timezone|input.text name; chip-select relationship (Mum, Dad, Other); timezone picker (auto-suggest from contact)|
|4\.4.3 Watch|Decide path: pair now (caregiver has watch) OR ship to parent (Shopify hand-off, US only at launch)|Two large buttons: "I have the watch with me" / "Ship one to them"|


## **4.5 Home / Family Circle**

|**Field**|**Value**|
| :- | :- |
|Audience|Caregiver|
|Purpose|At-a-glance status of every family member you’re caring for|
|Components|Anomaly Banner (§3.4) at top if active; vertically scrolling list of Reading Cards (§3.3), one per parent; floating "+ Invite family member" button bottom-right (only if caregiver is family.owner)|
|Data|For each parent: name, avatar, latest reading (BP, HR), timestamp, anomaly state, sync state|
|Refresh|Pull-to-refresh triggers /sync; auto-refresh on app foreground|
|Empty state|"Your family circle is empty for now. Add your first family member to get started." + button.primary "Add a family member"|
|Tab bar|Visible — Home tab active|


## **4.6 Reading Detail**

|**Field**|**Value**|
| :- | :- |
|Audience|Caregiver primary; parent secondary|
|Purpose|Full context of a single reading: value, time, source, notes, comments|
|Components|Header (parent name + back chevron); BP value (type.numeric-xl); HR + SpO2 secondary stats; timestamp + source ("Watch" / "Manual"); range indicator (chip.success / chip.accent / chip.urgent); reading notes section (read-only display of parent reason if soft-deleted, hidden in list); comment thread (caregiver → caregiver across siblings); action buttons "Mark as not me" (parent only) / "Add to weekly note" (caregiver)|
|Tone|Reassuring (default); Calm-Concerned (if anomaly); Direct (if confirmed-urgent)|


## **4.7 Trends**

|**Field**|**Value**|
| :- | :- |
|Audience|Caregiver primary; parent secondary|
|Purpose|Show BP and HR trends over time per family member|
|Components|Family-member picker (chips, horizontal scroll); BP Trend Chart (§3.10); summary stats card (avg, min, max, anomaly count for selected range); "View as table" toggle (a11y)|
|Default state|Selected = first family member; Range = 30 days|
|Empty state|"Not enough readings yet. We’ll show trends after the first 7 days of regular wear."|


## **4.8 Member Detail**

|**Field**|**Value**|
| :- | :- |
|Audience|Caregiver primary|
|Purpose|Manage one family member: invite/remove, view contact, change role, see device pairing status|
|Components|Avatar.xl + name + relationship; section: contact (phone, email, timezone); section: device (paired? device id?); section: role (owner / caregiver / observer / pairing chip); destructive action at bottom: button.destructive "Remove from family" (only family.owner)|
|Tone|Informative|


## **4.9 Watch Pairing**
Caregiver-side OR parent-side, with the Web Bluetooth fallback (Android Chrome) when caregiver attempts to pair a watch that physically lives with a parent on Android. See D7 §5 and ADR-013.

|**Step**|**Screen**|**Components**|
| :- | :- | :- |
|1|Power on the watch|Illustration of watch with power button highlighted; type.body-l instructions; button.primary "It’s on"|
|2|Scanning|Centered spinner; type.body-m "Looking for the watch nearby…"; cancel button.ghost|
|3a|Watch found (caregiver-local)|Card showing watch model + last 4 of MAC; button.primary "Pair this watch"; button.ghost "Not this one"|
|3b|Watch not found → Web Bluetooth handoff (Android only)|Bottom sheet: "Pair from your parent’s Android phone" with QR code that opens chrome://leiko.app/pair on their device|
|4|Pairing…|Progress indicator with motion.normal pulse; type.body-m "Talking to the watch…"|
|5|Paired|Phosphor CheckCircle (Bold, 64pt amber); type.title "Paired"; button.primary "Continue"|
|Failure|Pair failed (per D7 §5 failure-mode table)|Phosphor WarningCircle; type.title friendly cause; type.body-m suggested fix; button.primary "Try again"|


## **4.10 AI Assistant**

|**Field**|**Value**|
| :- | :- |
|Audience|Caregiver only at MVP|
|Purpose|Conversational answers about readings, trends, what an anomaly means|
|Components|Header with parent-context chip ("About Mum’s readings"); message thread (input.multiline at bottom); typing indicator; tap-to-cite (each AI answer references reading IDs which are tap-tappable)|
|Suggested prompts (empty state)|"What does this anomaly mean?" / "How is Mum doing this week?" / "Is 138/86 high?"|
|Disclaimer footer|Persistent caption: "Leiko offers context, not medical advice. Always check with a clinician."|
|Forbidden phrases|See D5 §6.4 — enforced by copy-lint on prompt template AND output guard (D7 §4)|


## **4.11 Settings**

|**Field**|**Value**|
| :- | :- |
|Audience|Both (different sub-set per role)|
|Sections|Profile (name, photo, timezone), Notifications (quiet hours, types), Accessibility (large-text mode, reduce motion override), Subscription (status, billing portal), Privacy (export data, delete account, view audit log), About (version, terms, privacy policy)|
|Components|list.toggle, list.navigation, list.action (destructive)|
|Tone|Direct|


## **4.12 Subscription / Paywall**

|**Field**|**Value**|
| :- | :- |
|Audience|Caregiver only|
|Trigger|On 6th reading per family OR on tapping a paywalled feature (trend > 30 days, AI assistant beyond 5 questions/month)|
|Layout|Full-screen modal (radius.l top corners), three sections: hero ("Stay close, every day"), value bullets (3 lines, no medical claims), price block ($4.99/mo or $39.99/yr USD with 18% savings annotated)|
|CTAs|button.accent "Start — 7 days free" / button.ghost "Maybe later"|
|Footer|Cancel anytime via App Store / Play Store; “Receipt sent by email”; small links to Terms and Privacy|
|Tone|Informative — explains value, never sells. No urgency banners, no countdowns, no "limited time".|


## **4.13 Parent-Side Tap Confirm (post-reading)**
Spec lives in component §3.14. The screen is the component, full-screen.
## **4.14 Parent-Side Reading History (large-text mode)**

|**Field**|**Value**|
| :- | :- |
|Audience|Parent|
|Purpose|Show last 7 readings in a parent-friendly format|
|Components|Vertical list, each row 80pt min height, type.numeric-l for the reading, type.body-l for "Tuesday morning", chip for in-range status|
|No comments, no charts — simplicity total||

# **5. Iconography**
## **5.1 System Icons**
Phosphor Icons (https://phosphoricons.com) is the system library. Used at three weights:

|**Weight**|**Used for**|
| :- | :- |
|Regular|Default weight for all UI affordances (chevrons, navigation, helpers)|
|Bold|Active state in tab bar; success/error confirmation moments|
|Fill|Reserved for status dots, anomaly badges, ring indicators|


### **Icon Inventory at MVP**
- House, ChartLineUp, GearSix — tab bar
- CaretRight, CaretLeft, X, Check — navigation and confirmations
- Bell, BellSlash — notifications
- Info, WarningCircle — anomaly banners
- User, UsersThree — family circle
- Watch — watch-related affordances
- Heart, Pulse — reading-related affordances (use sparingly — not on every screen)
- Plus, MinusCircle — add/remove actions
- Eye, EyeSlash — password show/hide
- CircleNotch — spinner (animated)
- CloudSlash, ArrowsClockwise — sync states
- Globe, Translate — language picker
- Sparkle — AI assistant entry point ONLY



|<p>**Phosphor licensing**</p><p>Phosphor is MIT-licensed. We bundle the static SVGs we use rather than the full library, to keep app size small (≤1MB). The bundled set is locked at MVP and reviewed quarterly.</p>|
| :- |
## **5.2 Custom Icons**
Two custom marks ship at MVP, both designed in-house:

|**Mark**|**Use**|**Specification**|
| :- | :- | :- |
|Leiko logo (mark)|Splash, tab bar branding, app icon|Geometric K monogram, navy on cream / cream on navy. SVG at 24pt, 64pt, 96pt, 1024pt (app store icon)|
|Anomaly indicator|Subtle dot used in family circle when a reading needs attention|6pt amber dot with 1pt cream stroke; 8pt crimson with 1pt cream stroke for confirmed-urgent. Always paired with a textual indicator (never color-only).|


## **5.3 Illustrations**
Onboarding, empty states, and paywall use a small library of original illustrations. Style brief is set here; production lives in Figma + an illustrator brief.

- Style: soft warm palette (cream, taupe, amber, single touch of navy). Organic shapes, no hard rectangles, no "tech" iconography.
- No depictions of medical settings (clinics, doctors, scrubs). Domestic scenes only — a hand on a watch, two hands holding a phone, a window, a teacup.
- Diverse representation across illustrations: skin tones, body types, ages. The product launches in Nigeria; primary illustrations should reflect Nigerian and West African phenotypes by default.
- Format: SVG (scalable, brand-consistent) at 240x180pt for onboarding/empty, 320x240pt for paywall hero.
- Legibility: each illustration must work at 50% size and on cream surface without losing meaning.
- Motion: illustrations are static at MVP. No subtle animation loops — they undermine the calm-before-clever principle.


### **Illustration Inventory at MVP (8 total)**
- Onboarding 1: Hands cradling a tea cup (warmth)
- Onboarding 2: Watch resting on a folded shirt (calm)
- Onboarding 3: Two phones nudging each other (shared)
- Empty home: Empty chair by a window
- Empty trends: A folded letter (waiting)
- Pairing success: Watch with a soft amber halo
- Paywall hero: Family circle of three abstract figures
- Anomaly explainer: A gentle wave (not a spike)


# **6. Voice Application**
D5 defines the voice strategy. This section turns it into UI strings: every category of copy with rules and verified examples. Every string in the product must pass the copy-lint that enforces these rules (D7 ADR — copy-lint rules below).
## **6.1 Copy-Lint Rules (automated)**
A pre-commit hook (apps/mobile/tools/copy-lint) scans every i18n string file and fails on:

|**Rule**|**Action**|
| :- | :- |
|Contains "patient", "patients", "loved one"|Hard fail — reject commit|
|Contains "smartwatch" without earlier "watch" reference in the same file|Hard fail|
|Contains forbidden medical claim ("predict", "diagnose", "treat", "cure", "medical-grade", "continuous")|Hard fail — lookup against D5 §6.4 dictionary|
|Push notification body >120 chars (iOS) or >180 chars (Android)|Hard fail|
|Title case headlines (e.g., "Your Family Circle")|Soft warning — reviewer must justify|
|Exclamation marks in body copy|Soft warning|
|Multiple exclamation marks anywhere|Hard fail|
|ALL CAPS WORDS in body copy|Hard fail|
|Empty translation in any non-English locale at build time|Hard fail at release; warning during dev|


## **6.2 Headlines & Sub-Headers**
- Sentence case throughout. "Your family", not "Your Family"
- Personal pronoun first: "your", "you" — never "users", "members"
- No medical claims, no symptom language, no clinical jargon
- Short — under 7 words is the target, never above 12
- No questions in headlines except in onboarding screen 1 (where it sets the emotional register)


## **6.3 CTAs (Button Labels)**

|**Pattern**|**Why**|**Examples**|**Avoid**|
| :- | :- | :- | :- |
|Verb + object|Tells the user what will happen|"Pair watch", "Add a family member", "Sign in"|"Continue", "OK", "Submit"|
|Sentence case|Calmer than Title Case|"Add Mum"|"Add Mum" if it would otherwise be "Add Mom"|
|One word for cancel|Reduces friction|"Cancel", "Skip", "Not now"|"No, take me back"|
|Friendly when irreversible|Slow the user down without panic|"Yes, sign me out everywhere"|"Confirm"|


## **6.4 Empty States**
Empty states are first impressions. Every empty state must:

- Use Reassuring tone (§1.2)
- Explain what will happen, not what is missing. "Trends will appear after the first week" — not "No data"
- Have a single action when possible. No action when the user already did the right thing (e.g., “waiting for first reading”).
- Never use the words "empty", "nothing", "none yet"


### **Verified Empty State Copy**

|**Screen**|**Headline**|**Body**|**CTA**|
| :- | :- | :- | :- |
|Home (no parents)|Your family circle is quiet for now|Add a family member to start sharing care.|Add a family member|
|Home (no readings)|No readings yet|Mum’s watch will start syncing as soon as it’s paired.|Pair watch|
|Trends|Trends will appear here next week|We need a few days of readings before we can show a trend.|(none)|
|AI assistant|Ask anything about Mum’s readings|Try: “What does this anomaly mean?” or “How is she doing this week?”|(none)|
|Comments|Be the first to leave a note|Notes are visible to everyone in the family circle.|Write a note|


## **6.5 Error States**

|**Pattern**|**Why**|**Example**|**Avoid**|
| :- | :- | :- | :- |
|Name the cause without blame|Feels like a friend, not an angry system|"We couldn’t reach the watch"|"Bluetooth error 0x21 — device unreachable"|
|Suggest a fix|Recovery is part of trust|"Bring the phone closer to the watch"|"Please retry"|
|Never show a stack trace, error code, or "Something went wrong"|Preserves dignity and trust|Use a friendly cause + fix|"Unexpected error"|
|Crash recovery: "We’re back — you didn’t lose anything." after a recovered crash|Reassures||"App crashed."|


## **6.6 Push Notifications**
Per D7 §8, notifications respect quiet hours and category. Copy templates per category:

|**Category**|**Title pattern**|**Body pattern (≤120 chars iOS)**|
| :- | :- | :- |
|daily-summary|Mum’s morning reading|128/82, in range. Have a good day.|
|anomaly-noted (calm-concerned)|Worth a look|Three of Dad’s readings this week were higher than usual. No rush — worth a chat.|
|confirmed-urgent|Please call Mum|Three high readings in the last hour. We recommend reaching out now.|
|missed-reading|Mum hasn’t worn the watch in 3 days|A friendly nudge might help. Tap to send a hello.|
|family-invite|Your sister joined the circle|You’re both caring for Dad now.|
|subscription-billing|Subscription renewing|Leiko will renew tomorrow for $4.99/month.|
|watch-shipped|Your watch is on the way|Tracking #123: arriving Tuesday.|
|parent-pairing-handoff|Pair the watch on Dad’s phone|Tap to open Dad’s pairing screen on his Android Chrome.|


## **6.7 Voice Examples by Tone (recap)**

|**Tone**|**Trigger**|**Example string**|
| :- | :- | :- |
|Reassuring|Daily, in-range|"All calm this morning. 128/82, within Mum’s usual range."|
|Reassuring|Successful sync|"All up to date."|
|Informative|Education card|"BP changes through the day. Morning readings are usually higher than evening ones."|
|Informative|Paywall|"Leiko helps you stay close to your parent’s health — with calm, contextual updates."|
|Calm-Concerned|Calm-concerned anomaly|"We noticed something. Three of Dad’s readings this week were higher than usual. Worth a chat."|
|Calm-Concerned|Missed readings|"Mum hasn’t worn her watch in 4 days. Want to send a friendly hello?"|
|Direct (urgent only)|Confirmed-urgent threshold|"Three high readings in the last hour. We recommend reaching out to Dad now."|


# **7. Accessibility Implementation**
Leiko commits to WCAG 2.2 AA across all v1.0 screens. Parent users skew older (55–80); accessibility is not a niche concern — it is a primary use case. Every release goes through the checks below before submission.
## **7.1 Screen Reader (VoiceOver / TalkBack)**
- Every interactive element has an accessibilityLabel that reads as a complete sentence ("Pair watch, button" not "pair\_btn\_01")
- Dynamic content announced via accessibilityLiveRegion="polite" — e.g., "New reading received: 128 over 82"
- Decorative illustrations marked accessibilityElementsHidden=true
- Tab order matches visual order; cards group as a single unit when scanning
- Custom focus order specified for any non-linear layout (e.g., paywall sheet)


## **7.2 Dynamic Type**
- All type tokens scale with OS font-size setting up to "Accessibility 5"
- Layout reflows: stacked layouts, no horizontal-only scroll for text content
- Containers use min-height (not fixed height) so they grow with content
- Charts swap to text-list view when the OS is at "Accessibility 3" or higher


## **7.3 Color & Contrast**
- Color is never the sole channel for meaning — every status pairs color + text + (optionally) icon
- All token pairings ship pre-verified at AA (§2.1.4)
- High-contrast mode (when enabled at OS level): increases all border weights to 2pt, swaps text.secondary to text.primary, removes all opacity-dimmed states
- Inverted colors mode: respected by OS — we do not override


## **7.4 Touch Targets**
- 48x48pt minimum for caregiver UI; 64x64pt for parent UI (§1.4)
- Hit-area enforced via padding, never via invisible outer container with internal margin
- Adjacent tap targets separated by spacing.s (8pt) minimum


## **7.5 Motion & Vestibular Sensitivity**
- Reduce Motion respected at OS level (§2.6.3)
- Auto-playing motion is not used anywhere
- Parallax is not used


## **7.6 Audio & Haptics**
- Haptics: only on successful pairing, manual reading complete, urgent banner appearance
- No alarm sounds at MVP
- All system feedback (haptic, sound) can be disabled per category in settings


## **7.7 Forms & Inputs**
- Labels above inputs (never placeholder-only labels)
- Error messages associated with inputs via accessibilityLabel + accessibilityInvalid
- Autofill respected: phone, OTP, email, name
- No CAPTCHA at MVP (auth via magic link / Apple / Google removes the need)


## **7.8 Pre-Release Accessibility Checklist**

|**Check**|**How**|**Pass criteria**|
| :- | :- | :- |
|VoiceOver pass|Manual test of every screen|Every interactive element announced; flow completes without sight|
|TalkBack pass|Manual test on Android|Same as above|
|Dynamic Type at "Accessibility 5"|iOS settings + Android system font scaling|No truncation, no overlap|
|Reduce Motion|OS toggle on, run app|No animations >120ms; chart transitions are hard cuts|
|High Contrast|OS toggle on, run app|Borders thicken; text remains AA|
|Color blindness simulation|OS Color Filters / Stark plugin|Status meaning preserved without color|
|Touch target audit|Automated check via Accessibility Inspector|Every interactive node ≥ 48x48pt|
|Copy-lint|CI pre-commit hook|No forbidden phrases, no medical claims|


# **8. Theme Modes (Light / Dark)**
## **8.1 Decision: Light only at MVP**
Leiko ships LIGHT MODE ONLY in v1.0. Dark mode is a V2 feature, scheduled for re-evaluation at the v1.1 quarterly review.

|**Reason**|**Detail**|
| :- | :- |
|Cream background is the brand|Dark mode would replace the warm-cream surface with a dark surface, which fundamentally changes the emotional register. The decision to ship light-only protects the differentiator while we validate it at launch.|
|Re-test load|Every contrast pairing in §2.1.4 must be re-verified against a dark palette. Every illustration must be re-checked. The accessibility budget at MVP is better spent on parent-mode large-text and screen reader.|
|User signal|Older parent users are not strong dark-mode requesters. Caregivers are; we will ship for them in V2 once we have telemetry on which screens they use most after dark.|
|One-line swap|Tokens are structured so that a future dark theme is a remap of the semantic layer only — component code does not change.|


## **8.2 What this means in code**
- At MVP, theme.ts exports a single theme object — no useColorScheme hook
- OS dark-mode setting is detected and a one-time card is shown on first launch: "Leiko uses a soft cream theme. We’ll add dark mode soon." — dismissible
- Status bar style is "dark-content" everywhere (navy text on cream)
- Screenshots in App Store / Play Store are light only at MVP


## **8.3 V2 Dark Mode Sketch (non-binding)**
Captured here so the V2 plan does not start from zero. These mappings are exploratory and will be re-tested for contrast before V2 ships.

|**Semantic token**|**Light value**|**V2 sketch (not final)**|
| :- | :- | :- |
|color.surface.base|cream.100 (#F5EFE6)|navy darker (#0A1828)|
|color.surface.subtle|cream.200 (#E8E2D5)|navy soft (#13243B)|
|color.surface.elevated|white|navy elevated (#1B2540)|
|color.text.primary|textPrim (#1B2540)|cream.100 (#F5EFE6)|
|color.brand.accent|amber (#E89F4F)|amber soft (#F2B775)|
|color.brand.primary|navy (#0F2340)|cream.100 (#F5EFE6) inverted|


# **9. Strings & Internationalisation**
## **9.1 String File Structure**
All UI strings live in apps/mobile/src/i18n/locales/{locale}.json. Default locale is en. Structure follows feature-area, then component:

{

`  `"onboarding": {

`    `"screen1": {

`      `"headline": "Stay close to the people who shaped you.",

`      `"body": "Leiko is a calm way to keep an eye on a parent's health, even from far away.",

`      `"cta": "Continue"

`    `}

`  `},

`  `"home": {

`    `"empty": {

`      `"headline": "Your family circle is quiet for now",

`      `"body": "Add a family member to start sharing care.",

`      `"cta": "Add a family member"

`    `},

`    `"anomaly": {

`      `"calmConcerned": {

`        `"headline": "Worth a look",

`        `"body": "Three of {{parentName}}'s readings this week were higher than usual. Worth a chat."

`      `},

`      `"confirmedUrgent": {

`        `"headline": "Please call {{parentName}}",

`        `"body": "Three high readings in the last hour. We recommend reaching out now."

`      `}

`    `}

`  `},

`  `"common": {

`    `"buttons": {

`      `"cancel": "Cancel",

`      `"skip": "Skip",

`      `"continue": "Continue",

`      `"save": "Save",

`      `"delete": "Delete"

`    `}

`  `}

}


## **9.2 Locale Roadmap**

|**Locale**|**Status**|**Target version**|
| :- | :- | :- |
|en (English — default)|Ships at MVP|v1.0|
|en-NG (English, Nigerian variants)|Light variants ("Mum" vs "Mom" handled by locale)|v1.0|
|en-US|Ships at US launch|v1.0 (US)|
|fr|Caregiver diaspora (France, Cote d’Ivoire, Senegal)|v1.2|
|sw|East African diaspora|v1.3|
|ar|RTL test bed; required for diaspora caregivers in MENA|v1.4|
|hi, zh, es, pt-BR|Future|TBD|
|Yoruba, Igbo, Hausa|Parent-side only (large-text mode); critical for Nigeria launch|v1.1|


## **9.3 RTL Readiness**
- All layouts use logical properties (start/end, not left/right) where supported by RN
- Iconography mirror rules: chevrons mirror; status icons (check, warning) do NOT mirror
- Numerics (BP values) remain LTR even in RTL contexts (per Unicode bidi)
- No RTL-specific layouts ship at MVP — verified compatible only


## **9.4 Pluralisation & Variables**
- All numeric/plural strings use ICU MessageFormat via i18next plural fallback
- Variables always named ({{parentName}}, {{readingCount}}) — never positional
- Time formats use Luxon (D7 ADR-005) with locale-aware patterns


# **10. Open Design Questions**
Resolved before or during Sprint 1 unless noted otherwise.

|**#**|**Question**|**Owner**|**Target**|**Default if unresolved**|
| :- | :- | :- | :- | :- |
|Q-D8-1|Recoleta licensed for Leiko, or fall back to Fraunces?|Founder|End of Sprint 1|Fraunces (free) — swap is one-token|
|Q-D8-2|In-house illustrations or external illustrator brief?|Founder|End of Sprint 2|External illustrator briefed via Dribbble + style brief in §5.3|
|Q-D8-3|How many parent-side localisations at MVP? Yoruba/Igbo/Hausa or English-only?|Founder|End of Sprint 3 (depends on Nigeria launch beta sign-up data)|English-only at v1.0; Yoruba in v1.1|
|Q-D8-4|Web Bluetooth pairing UI: native React Native handoff URL or hosted PWA at leiko.app/pair?|Founder + Eng|End of Sprint 1|Hosted PWA at leiko.app/pair (matches D7 ADR-013)|
|Q-D8-5|Parent reading-history retention in UI: rolling 7 days or scrollable history?|Founder|End of Sprint 4|Rolling 7 days at MVP (parent UI must stay simple)|
|Q-D8-6|AI assistant entry point on home screen: persistent affordance or only after first anomaly?|Founder|End of Sprint 5|Only after first anomaly — protects calm-before-clever|
|Q-D8-7|In-app onboarding for the parent (after invite accepted): 1 screen or skip?|Founder|End of Sprint 3|1 screen — explains the watch and the "tap to confirm" pattern|
|Q-D8-8|Confirmed-urgent banner: persist until acknowledged, or auto-clear once readings normalise?|Founder + Clinical|End of Sprint 6 (depends on Q5 in D7 — clinical advisor hire)|Persist until acknowledged|
|Q-D8-9|Streak / habit hint for daily wear: ship soft hint or never?|Founder|V2 review|Never at MVP — violates anti-pattern §1.3|
|Q-D8-10|Dark mode: confirmed V2 or further deferred?|Founder|After v1.0 launch telemetry (8 weeks post-launch)|V2 unless engagement data says otherwise|


# **11. Document Changelog**

|**Version**|**Date**|**Changes**|
| :- | :- | :- |
|1\.0|May 2026|Initial issue. Locks tokens, components, screens, voice rules, accessibility, light-only theme decision.|



|<p>**Document status**</p><p>D8 v1.0 is approved for implementation. Updates land as v1.x quarterly, in line with Figma source-of-truth review. Major revisions (e.g., dark mode introduction, new component class) issue as v2.0.</p>|
| :- |
## **Approvals**

|**Role**|**Name**|**Date**|**Signature**|
| :- | :- | :- | :- |
|Founder / Product||||
|Design Lead||||
|Engineering Lead (mobile)||||
|Accessibility Reviewer||||


*— End of D8 —*
LawOne Cloud LLC  •  Confidential  •  Page 
