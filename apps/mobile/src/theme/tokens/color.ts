// Source of truth: docs/_reference/D12-visual-system-v2.md §2.
// Two layers: raw palette (mode-specific hex), then semantic tokens
// (mode-resolved). Components consume semantic tokens via the theme
// provider — never the raw palette directly.

// ============================================================
// 1. Raw palette — Dark canonical (D12 §2.2)
// ============================================================

export const paletteDark = {
  midnight: {
    950: '#06090F',
    900: '#0A0F1A',
    850: '#11171F',
    800: '#1A2030',
    750: '#222937',
  },
  // Warm charcoal palette — Sprint 7.7 design, caregiver-mode home
  // (`leiko-caregiver-unified.html`). The design's `#0a0908` is
  // rendered as `warmCharcoal.900`; brighter steps (elev/high) are
  // computed from oklch(16% / 20% .015 60) for surface depth.
  warmCharcoal: {
    900: '#0A0908', // base
    850: '#120C07', // subtle
    800: '#1D140D', // elevated
  },
  // Sprint 16.6 — single warm bone-cream ink across all dark-mode text
  // tokens after the on-device A/B test (founder picked #F9F6EE as
  // the warm winner over pure white + the warmer-yet candidates).
  // Hierarchy comes purely from type — size, weight, italic style,
  // family — not from brightness gradation. Mirrors print typography
  // on warm paper: one ink, structure through type.
  //   bone[50]   #F9F6EE  primary
  //   bone[100]  #F9F6EE  secondary
  //   stone[300] #F9F6EE  tertiary
  bone: { 50: '#F9F6EE', 100: '#F9F6EE' },
  stone: { 300: '#F9F6EE', 500: '#6B6862' },
  amber: { 400: '#F5B47A', 500: '#E8A063', 600: '#C5824A' },
  // Coral — caregiver-mode brand accent (Sprint 7.7). Distinct from the
  // existing `coral.500 #D6745A` used for HR vital chromatic; this is
  // brighter / warmer to read as the caregiver brand colour against
  // warm-charcoal surfaces. Resolves the D12 light-mode amber 2:1
  // contrast issue for caregiver surfaces (memory:
  // d12_light_mode_amber_contrast).
  coral: { 500: '#D6745A', warm: '#FF7350' },
  teal: { 500: '#5FA8A8' },
  violet: { 500: '#7C7AAB' },
  sage: { 500: '#7CA56F' },
  success: { 500: '#5BA873' },
  warning: { 500: '#E8A063' },
  crimson: { 700: '#A8403F' },
  // Per-person rotating accents (Sprint 7.7). Three accents drawn from
  // the design's three test personas (Mom coral / Dad amber / Aunt
  // periwinkle). Caregivers with > 3 family members rotate through.
  person: {
    1: '#FF7350', // coral (matches Mom in design fixture)
    2: '#F2A618', // amber (matches Dad)
    3: '#7B67CC', // periwinkle (matches Aunt Joy / sleep)
  },
  // Status semantic colours (Sprint 7.7). Six states drive the
  // StatusPill + PersonOrb glow / dot. `clear` is success-green,
  // `urgent` is the same crimson family as `state.urgent`, the rest
  // are unique caregiver-mode shades from the design.
  status: {
    clear: '#61B565', // green
    watch: '#F2A618', // amber (same as person.2)
    attention: '#FF7350', // coral (same as person.1 / brand caregiver)
    // Sprint 16.6 — was #EE343B (bright red). The caregiver-unified
    // design source uses oklch(62% 0.22 25) for the urgent dot — a
    // softer red-orange that reads as "needs attention now" without
    // siren-grade alarm. Aligns with the broader Leiko voice rule
    // that red is reserved for confirmed-urgent, calibrated tone.
    urgent: '#DC5631',
    offline: '#857F7A', // grey
    sleeping: '#7B67CC', // periwinkle (same as person.3)
  },
  glass: {
    10: 'rgba(255,255,255,0.04)',
    20: 'rgba(255,255,255,0.08)',
    30: 'rgba(255,255,255,0.16)',
  },
  rim: { 20: 'rgba(255,255,255,0.06)' },
} as const;

// ============================================================
// 2. Raw palette — Light variant (D12 §2.3)
// ============================================================

export const paletteLight = {
  linen: { 50: '#FBF9F5', 100: '#F5F2EC', 200: '#FFFFFF' },
  ink: { 900: '#0F121C', 700: '#2A3040', 500: '#5A6478', 300: '#8C95A8' },
  // Sprint 14.5 task 6 — light-mode amber darkened from #E8A063 to
  // #B4742E to meet D12 §2.6 minimum 3:1 contrast on linen surfaces.
  // The previous shade landed at 2.0–2.2:1 (memory:
  // d12_light_mode_amber_contrast); the dark-palette amber.600
  // (#C5824A) computes to 2.996:1 — just under threshold — so this
  // step goes one notch deeper for a comfortable 3.7:1. Premium-
  // precise tone preserved; not so dark it loses warmth. Designer
  // review pending before launch — single hex to edit if the
  // founder/designer wants a different shade.
  amber: { 500: '#B4742E' },
  coral: { 500: '#C95F44' },
  teal: { 500: '#3F8888' },
  violet: { 500: '#5A5887' },
  sage: { 500: '#5C8252' },
  success: { 500: '#3F8054' },
  warning: { 500: '#C5824A' },
  crimson: { 700: '#8C2D2D' },
  glass: {
    10: 'rgba(15,18,28,0.04)',
    20: 'rgba(15,18,28,0.08)',
    30: 'rgba(15,18,28,0.16)',
  },
} as const;

// ============================================================
// 3. Semantic tokens — pre-resolved per mode (D12 §2.4)
// ============================================================

export type ColorMode = 'dark' | 'light';

export interface SemanticColors {
  brand: {
    primary: string;
    primaryHover: string;
    primaryPressed: string;
    /** Caregiver-mode warm coral accent (Sprint 7.7). Distinct from
     *  brand.primary (amber) used elsewhere in the app. */
    coral: string;
  };
  surface: {
    base: string;
    subtle: string;
    elevated: string;
    high: string;
    /** Caregiver-mode warm-charcoal background (Sprint 7.7). Consumed
     *  by CaregiverHome only. Light-mode equivalent is intentionally a
     *  follow-up alongside Sprint 1.6 token cleanup. */
    warmBase: string;
    warmSubtle: string;
    warmElevated: string;
    glassLight: string;
    glassMedium: string;
    glassHeavy: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    onBrand: string;
    onUrgent: string;
  };
  border: {
    subtle: string;
    strong: string;
    rim: string;
  };
  vital: {
    bp: string;
    hr: string;
    spo2: string;
    sleep: string;
    activity: string;
  };
  state: {
    success: string;
    warning: string;
    urgent: string;
  };
  /** Per-person rotating accents (Sprint 7.7). Caregivers with > 3
   *  family members cycle through these three. */
  person: {
    1: string;
    2: string;
    3: string;
  };
  /** Caregiver-mode status semantics (Sprint 7.7). Six states. */
  status: {
    clear: string;
    watch: string;
    attention: string;
    urgent: string;
    offline: string;
    sleeping: string;
  };
  focus: { ring: string };
}

export const semanticColorsDark: SemanticColors = {
  brand: {
    primary: paletteDark.amber[500],
    primaryHover: paletteDark.amber[400],
    primaryPressed: paletteDark.amber[600],
    coral: paletteDark.coral.warm,
  },
  surface: {
    base: paletteDark.midnight[900],
    subtle: paletteDark.midnight[850],
    elevated: paletteDark.midnight[800],
    high: paletteDark.midnight[750],
    warmBase: paletteDark.warmCharcoal[900],
    warmSubtle: paletteDark.warmCharcoal[850],
    warmElevated: paletteDark.warmCharcoal[800],
    glassLight: paletteDark.glass[10],
    glassMedium: paletteDark.glass[20],
    glassHeavy: paletteDark.glass[30],
  },
  text: {
    primary: paletteDark.bone[50],
    secondary: paletteDark.bone[100],
    tertiary: paletteDark.stone[300],
    disabled: paletteDark.stone[500],
    onBrand: paletteDark.midnight[900],
    onUrgent: paletteDark.bone[50],
  },
  border: {
    subtle: paletteDark.glass[20],
    strong: paletteDark.bone[100],
    rim: paletteDark.rim[20],
  },
  vital: {
    bp: paletteDark.amber[500],
    hr: paletteDark.coral[500],
    spo2: paletteDark.teal[500],
    sleep: paletteDark.violet[500],
    activity: paletteDark.sage[500],
  },
  state: {
    success: paletteDark.success[500],
    warning: paletteDark.warning[500],
    urgent: paletteDark.crimson[700],
  },
  person: {
    1: paletteDark.person[1],
    2: paletteDark.person[2],
    3: paletteDark.person[3],
  },
  status: {
    clear: paletteDark.status.clear,
    watch: paletteDark.status.watch,
    attention: paletteDark.status.attention,
    urgent: paletteDark.status.urgent,
    offline: paletteDark.status.offline,
    sleeping: paletteDark.status.sleeping,
  },
  focus: { ring: paletteDark.amber[500] },
};

export const semanticColorsLight: SemanticColors = {
  brand: {
    primary: paletteLight.amber[500],
    // D12 §2.3 doesn't define separate hover/pressed for light — same hex.
    primaryHover: paletteLight.amber[500],
    primaryPressed: paletteLight.amber[500],
    // Caregiver-mode light variant is intentionally a Sprint 1.6 follow-up
    // (caregiver home is dark-canonical for v1.0). Reuse the dark-mode
    // coral so a misuse against light surfaces is at least a known hex
    // rather than `undefined`.
    coral: paletteDark.coral.warm,
  },
  surface: {
    base: paletteLight.linen[50],
    subtle: paletteLight.linen[100],
    elevated: paletteLight.linen[200],
    // D12 §2.4: light mode has no `surface.high` distinction; reuses elevated.
    high: paletteLight.linen[200],
    // Caregiver warm surfaces — light variant deferred. Reuses dark-mode
    // hexes as a placeholder; the caregiver home doesn't render in light
    // mode in v1.0 so this is never visible.
    warmBase: paletteDark.warmCharcoal[900],
    warmSubtle: paletteDark.warmCharcoal[850],
    warmElevated: paletteDark.warmCharcoal[800],
    glassLight: paletteLight.glass[10],
    glassMedium: paletteLight.glass[20],
    glassHeavy: paletteLight.glass[30],
  },
  text: {
    primary: paletteLight.ink[900],
    secondary: paletteLight.ink[700],
    tertiary: paletteLight.ink[500],
    disabled: paletteLight.ink[300],
    // Both modes: text on amber stays dark; text on crimson stays light.
    onBrand: paletteDark.midnight[900],
    onUrgent: paletteDark.bone[50],
  },
  border: {
    subtle: paletteLight.glass[20],
    strong: paletteLight.ink[700],
    // Rim lighting is dark-mode only per D12 §2.4.
    rim: 'transparent',
  },
  vital: {
    bp: paletteLight.amber[500],
    hr: paletteLight.coral[500],
    spo2: paletteLight.teal[500],
    sleep: paletteLight.violet[500],
    activity: paletteLight.sage[500],
  },
  state: {
    success: paletteLight.success[500],
    warning: paletteLight.warning[500],
    urgent: paletteLight.crimson[700],
  },
  // Person + status reuse the dark-mode hexes — caregiver home is
  // dark-canonical for v1.0 so these don't render in light mode.
  person: {
    1: paletteDark.person[1],
    2: paletteDark.person[2],
    3: paletteDark.person[3],
  },
  status: {
    clear: paletteDark.status.clear,
    watch: paletteDark.status.watch,
    attention: paletteDark.status.attention,
    urgent: paletteDark.status.urgent,
    offline: paletteDark.status.offline,
    sleeping: paletteDark.status.sleeping,
  },
  focus: { ring: paletteLight.amber[500] },
};

export function getSemanticColors(mode: ColorMode): SemanticColors {
  return mode === 'dark' ? semanticColorsDark : semanticColorsLight;
}
