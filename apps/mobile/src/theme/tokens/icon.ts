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

// Names are the canonical phosphor-react-native v3 form (*Icon suffix). The
// legacy names (HeartStraight, Drop, etc.) still resolve in v3 but are
// deprecated; v4 may remove them.
export const phosphorIconName = {
  settings: 'GearSixIcon',
  family: 'UserPlusIcon',
  vitalBp: 'DropIcon',
  vitalHr: 'HeartStraightIcon',
  vitalSpo2: 'WindIcon',
  vitalSleep: 'MoonIcon',
  vitalActivity: 'FootprintsIcon',
  aiNarration: 'SparkleIcon',
  anomalyCalmConcerned: 'WarningIcon',
  anomalyConfirmedUrgent: 'WarningCircleIcon',
  syncing: 'ArrowsClockwiseIcon',
  syncError: 'WifiSlashIcon',
  bluetooth: 'BluetoothIcon',
  watchLowBattery: 'BatteryLowIcon',
  doctor: 'StethoscopeIcon',
  chevronTrailing: 'CaretRightIcon',
  close: 'XIcon',
  check: 'CheckIcon',
} as const;

export type PhosphorIconKey = keyof typeof phosphorIconName;
