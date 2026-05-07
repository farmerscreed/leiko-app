// Source of truth: docs/_reference/D12-visual-system-v2.md §9.
//
// Token names are component-facing; the fire helper maps each to the
// appropriate expo-haptics call. Settings-level enable/disable + silent-mode
// honouring + per-token opt-in (heartbeat is OFF by default) are runtime
// concerns layered on top of this — they wire in alongside the Settings
// screen in Sprint 10.

import * as Haptics from 'expo-haptics';

export type HapticToken =
  | 'tick'      // Pull-to-refresh threshold reached, vital tile press
  | 'confirm'   // Reading captured, sheet committed
  | 'success'   // Goal hit, sync success, family invite accepted
  | 'warning'   // Calm-concerned anomaly banner appears
  | 'error'     // Sync failure, BLE disconnection during reading
  | 'heartbeat'; // Live HR streaming on vital detail (opt-in, every ~5s — not continuous)

export async function fireHaptic(token: HapticToken): Promise<void> {
  switch (token) {
    case 'tick':
      return Haptics.selectionAsync();
    case 'confirm':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'error':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    case 'heartbeat': {
      // D12 §9 spec: short tap → 80ms gap → longer tap. expo-haptics has no
      // native multi-pattern API; closest portable approximation is light
      // impact + delay + medium impact. Native Core Haptics composition is
      // a v1.1 enhancement (would need a custom Expo module).
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 80));
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }
}
