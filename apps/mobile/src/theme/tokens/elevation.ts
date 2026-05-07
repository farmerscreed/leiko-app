// Source of truth: docs/_reference/D12-visual-system-v2.md §6.
//
// Mode-aware. Dark surfaces lift via lightening + a subtle rim light at the
// top edge (simulates ambient occlusion under controlled studio lighting);
// black shadows go muddy on dark surfaces. Light surfaces lift via tinted
// cast shadows — never pure black on cream (also goes muddy).

import { paletteDark } from './color';

export type ElevationToken = 'none' | 'low' | 'medium' | 'high' | 'glass';

interface IosShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
}

interface AndroidElevation {
  elevation: number;
}

export interface ElevationStyle {
  // Drop-in style fragments for RN's StyleSheet.
  ios: IosShadow;
  android: AndroidElevation;
  // Whether this token paints a 1px rim light at the top edge of the surface.
  // Consumed by Card and BottomSheet on dark mode only.
  rimLight: boolean;
}

// Dark mode — rim light + tinted-black cast shadow per D12 §6.1.
export const elevationDark: Record<ElevationToken, ElevationStyle> = {
  none: {
    ios: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: { elevation: 0 },
    rimLight: false,
  },
  low: {
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    rimLight: true,
  },
  medium: {
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 32,
    },
    android: { elevation: 8 },
    rimLight: true,
  },
  high: {
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.45,
      shadowRadius: 48,
    },
    android: { elevation: 16 },
    rimLight: true,
  },
  glass: {
    // Glass uses a softer shadow — the blur material does most of the lift.
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
    },
    android: { elevation: 6 },
    rimLight: true,
  },
};

// Light mode — ink-tinted cast shadow per D12 §6.2. Never pure black on cream.
const lightShadowColor = paletteDark.midnight[900]; // ink-900 reference (#0F121C ≈ #0A0F1A close enough; D12 §6.2 uses rgba(15,18,28,…))
export const elevationLight: Record<ElevationToken, ElevationStyle> = {
  none: {
    ios: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: { elevation: 0 },
    rimLight: false,
  },
  low: {
    ios: {
      shadowColor: lightShadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    rimLight: false,
  },
  medium: {
    ios: {
      shadowColor: lightShadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    rimLight: false,
  },
  high: {
    ios: {
      shadowColor: lightShadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
    },
    android: { elevation: 12 },
    rimLight: false,
  },
  glass: {
    ios: {
      shadowColor: lightShadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    rimLight: false,
  },
};

export function getElevation(mode: 'dark' | 'light'): Record<ElevationToken, ElevationStyle> {
  return mode === 'dark' ? elevationDark : elevationLight;
}
