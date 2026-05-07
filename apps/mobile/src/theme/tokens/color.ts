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
  bone: { 50: '#F5F1EA', 100: '#ECE9E2' },
  stone: { 300: '#9C9890', 500: '#6B6862' },
  amber: { 400: '#F5B47A', 500: '#E8A063', 600: '#C5824A' },
  coral: { 500: '#D6745A' },
  teal: { 500: '#5FA8A8' },
  violet: { 500: '#7C7AAB' },
  sage: { 500: '#7CA56F' },
  success: { 500: '#5BA873' },
  warning: { 500: '#E8A063' },
  crimson: { 700: '#A8403F' },
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
  amber: { 500: '#E8A063' },
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
  };
  surface: {
    base: string;
    subtle: string;
    elevated: string;
    high: string;
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
  focus: { ring: string };
}

export const semanticColorsDark: SemanticColors = {
  brand: {
    primary: paletteDark.amber[500],
    primaryHover: paletteDark.amber[400],
    primaryPressed: paletteDark.amber[600],
  },
  surface: {
    base: paletteDark.midnight[900],
    subtle: paletteDark.midnight[850],
    elevated: paletteDark.midnight[800],
    high: paletteDark.midnight[750],
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
  focus: { ring: paletteDark.amber[500] },
};

export const semanticColorsLight: SemanticColors = {
  brand: {
    primary: paletteLight.amber[500],
    // D12 §2.3 doesn't define separate hover/pressed for light — same hex.
    primaryHover: paletteLight.amber[500],
    primaryPressed: paletteLight.amber[500],
  },
  surface: {
    base: paletteLight.linen[50],
    subtle: paletteLight.linen[100],
    elevated: paletteLight.linen[200],
    // D12 §2.4: light mode has no `surface.high` distinction; reuses elevated.
    high: paletteLight.linen[200],
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
  focus: { ring: paletteLight.amber[500] },
};

export function getSemanticColors(mode: ColorMode): SemanticColors {
  return mode === 'dark' ? semanticColorsDark : semanticColorsLight;
}
