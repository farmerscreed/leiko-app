// Source of truth: docs/02-design-tokens.md (D8 §2 + D5 §10.4 parent-mode rules).
// Spec tokens are kebab-case (e.g. color.brand.primary-soft); the TypeScript
// surface here is camelCase for consumer ergonomics — comments preserve the
// spec name for traceability. If the spec changes, update this file and run
// `npm run test --workspace=apps/mobile` to verify token values still match.

// 1. Raw palette (D5 §4.1 + system colors).
export const palette = {
  navy: { 900: '#0F2340', 700: '#2A5F7F' },
  amber: { 500: '#E89F4F' },
  crimson: { 700: '#8C2D2D' },
  cream: { 100: '#F5EFE6', 200: '#E8E2D5', 300: '#D6CFC2' },
  white: '#FFFFFF',
  text: { primary: '#1B2540', secondary: '#5A6478' },
  success: { 500: '#2F7A3F' },
} as const;

// 2. Semantic colors (D8 §2.1.2) — components consume these only.
export const colors = {
  brand: {
    primary: palette.navy[900],          // color.brand.primary
    primarySoft: palette.navy[700],      // color.brand.primary-soft
    accent: palette.amber[500],          // color.brand.accent
  },
  surface: {
    base: palette.cream[100],            // color.surface.base
    subtle: palette.cream[200],          // color.surface.subtle
    elevated: palette.white,             // color.surface.elevated
  },
  border: {
    default: palette.cream[300],         // color.border.default
    strong: palette.navy[700],           // color.border.strong
  },
  text: {
    primary: palette.text.primary,       // color.text.primary
    secondary: palette.text.secondary,   // color.text.secondary
    onBrand: palette.white,              // color.text.on-brand
  },
  state: {
    success: palette.success[500],       // color.state.success
    warning: palette.amber[500],         // color.state.warning
    urgent: palette.crimson[700],        // color.state.urgent — confirmed-clinical only
  },
  focus: {
    ring: palette.navy[700],             // color.focus.ring
  },
} as const;

// 3. Spacing — 4pt scale (D8 §2.3). No raw px in component code.
export const spacing = {
  xs: 4,     // spacing.xs
  s: 8,      // spacing.s
  m: 12,     // spacing.m
  l: 16,     // spacing.l (default card padding)
  xl: 20,    // spacing.xl
  xxl: 24,   // spacing.2xl (default screen edge)
  xxxl: 32,  // spacing.3xl
  xxxxl: 48, // spacing.4xl
} as const;

// 4. Radii (D8 §2.4).
export const radii = {
  none: 0,
  s: 6,
  m: 12, // default
  l: 20,
  xl: 28,
  full: 999,
} as const;

// 5. Opacity (D8 §2.7).
export const opacity = {
  disabled: 0.4,
  scrim: 0.55,
  muted: 0.7,
  full: 1.0,
} as const;

// 6. Motion durations (ms) and easing curves (D8 §2.6).
export const motion = {
  duration: {
    instant: 0,
    fast: 120,
    normal: 200,
    slow: 320,
    deliberate: 480,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
    linear: 'linear',
  },
} as const;

// Reduced-motion mapping (D8 §2.6.3):
//   instant → 0    (unchanged)
//   fast    → 120  (unchanged)
//   normal  → 0    (becomes a hard cut — bottom-sheet rule)
//   slow    → 120  (collapses to fast)
//   deliberate → 120 (collapses to fast)
export const reducedMotionDuration = {
  instant: 0,
  fast: 120,
  normal: 0,
  slow: 120,
  deliberate: 120,
} as const;

// 7. Elevation (D8 §2.5) — navy-tinted shadows on iOS, RN elevation on Android.
//    Pure black on cream goes muddy gray; spec mandates navy tint.
export const elevation = {
  none: {
    ios: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: { elevation: 0 },
  },
  low: {
    ios: {
      shadowColor: palette.navy[900],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
  },
  medium: {
    ios: {
      shadowColor: palette.navy[900],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
  },
  high: {
    ios: {
      shadowColor: palette.navy[900],
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
    },
    android: { elevation: 12 },
  },
  toast: {
    ios: {
      shadowColor: palette.navy[900],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: { elevation: 8 },
  },
} as const;

// 8. Font families (D8 §2.2.1). Display is locked to Recoleta in Sprint 2
// (Q-D8-1); Fraunces fallback. expo-font loading is deferred to Sprint 2,
// so until then RN falls back to system serif/monospace for display/numeric.
export const fontFamily = {
  body: 'Inter',
  display: 'Recoleta',
  numeric: 'JetBrainsMono',
} as const;

// 9. Typography scale (D8 §2.2 caregiver default + §2.3 parent profile).
//    Parent overrides only exist for body-l, body-m, title, label, caption —
//    line heights step up ~10% in parent mode. All other tokens (display,
//    numeric, body-s, headline) stay constant — already large enough.
export const typeScale = {
  caregiver: {
    displayXl: { size: 48, lineHeight: 52, weight: '700', family: fontFamily.display },
    displayL: { size: 36, lineHeight: 42, weight: '700', family: fontFamily.display },
    displayM: { size: 28, lineHeight: 34, weight: '700', family: fontFamily.display },
    headline: { size: 22, lineHeight: 28, weight: '600', family: fontFamily.body },
    title: { size: 18, lineHeight: 24, weight: '600', family: fontFamily.body },
    bodyL: { size: 17, lineHeight: 24, weight: '400', family: fontFamily.body },
    bodyM: { size: 15, lineHeight: 22, weight: '400', family: fontFamily.body },
    bodyS: { size: 13, lineHeight: 18, weight: '400', family: fontFamily.body },
    label: { size: 13, lineHeight: 16, weight: '500', family: fontFamily.body },
    caption: { size: 12, lineHeight: 16, weight: '400', family: fontFamily.body },
    numericXl: { size: 56, lineHeight: 60, weight: '500', family: fontFamily.numeric },
    numericL: { size: 36, lineHeight: 42, weight: '500', family: fontFamily.numeric },
    numericM: { size: 22, lineHeight: 28, weight: '500', family: fontFamily.numeric },
  },
  parent: {
    title: { size: 20, lineHeight: 26, weight: '600', family: fontFamily.body },
    bodyL: { size: 19, lineHeight: 26, weight: '400', family: fontFamily.body },
    bodyM: { size: 17, lineHeight: 24, weight: '400', family: fontFamily.body },
    label: { size: 15, lineHeight: 18, weight: '500', family: fontFamily.body },
    caption: { size: 13, lineHeight: 18, weight: '400', family: fontFamily.body },
  },
} as const;

// 10. Tap targets and list-row min height (D8 §8 parent-mode rules).
export const minTapTarget = {
  caregiver: 48,
  parent: 64,
} as const;

export const listRowMinHeight = {
  caregiver: 56,
  parent: 64,
} as const;

// Token-key types exposed for consumers.
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type OpacityToken = keyof typeof opacity;
export type ElevationToken = keyof typeof elevation;
export type DurationToken = keyof typeof motion.duration;
export type EasingToken = keyof typeof motion.easing;
export type TypeToken = keyof typeof typeScale.caregiver;
