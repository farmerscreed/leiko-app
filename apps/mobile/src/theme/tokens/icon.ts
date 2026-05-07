// Source of truth: docs/_reference/D12-visual-system-v2.md §10.
//
// Icon library is `phosphor-react-native` (D12 §10 spells this as
// `@phosphor-icons/react-native` — that scope does not exist on npm; doc
// patch follow-up). Installed in Sprint 7.6. The mapping table below is the
// contract — when a component first imports a Phosphor icon, it looks up the
// glyph name here, then imports it from `phosphor-react-native` with that
// name as a named export.

export const iconSize = {
  xs: 14,
  s: 16,
  m: 20,
  l: 24,
  xl: 32,
  hero: 56,
} as const;

export type IconSizeToken = keyof typeof iconSize;

export const phosphorIconName = {
  settings: 'GearSix',
  family: 'UserPlus',
  vitalBp: 'Drop',
  vitalHr: 'HeartStraight',
  vitalSpo2: 'Wind',
  vitalSleep: 'Moon',
  vitalActivity: 'Footprints',
  aiNarration: 'Sparkle',
  anomalyCalmConcerned: 'Warning',
  anomalyConfirmedUrgent: 'WarningCircle',
  syncing: 'ArrowsClockwise',
  syncError: 'WifiSlash',
  bluetooth: 'Bluetooth',
  watchLowBattery: 'BatteryLow',
  doctor: 'Stethoscope',
  chevronTrailing: 'CaretRight',
  close: 'X',
  check: 'Check',
} as const;

export type PhosphorIconKey = keyof typeof phosphorIconName;
