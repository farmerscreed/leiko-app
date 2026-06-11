// Battery-optimization (Doze) exemption — Android only.
//
// Android does not guarantee delivery of the silent remote-refresh push to a
// backgrounded app unless the app is exempt from battery optimization. This
// wraps the native LeikoPower module (see
// android/.../power/LeikoPowerModule.kt) so the UI can check status and open
// the system exemption dialog. iOS and the JS-only test workspace (no native
// module) treat the app as already exempt — there is nothing to fix there.
//
// Per CLAUDE.md: no PHI in analytics; we log only that the prompt was shown.

import { NativeModules, Platform } from 'react-native';
import { logger } from '../analytics/logger';

interface NativeApi {
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): Promise<boolean>;
}

const native: NativeApi | undefined =
  Platform.OS === 'android'
    ? (NativeModules.LeikoPower as NativeApi | undefined)
    : undefined;

/**
 * Whether the app is exempt from battery optimization. Returns true on iOS
 * and when the native module is absent (JS workspace) — nothing to prompt for.
 */
export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android' || !native?.isIgnoringBatteryOptimizations) {
    return true;
  }
  try {
    return await native.isIgnoringBatteryOptimizations();
  } catch {
    return false;
  }
}

/**
 * Open the system exemption dialog. No-op on iOS / without the native module.
 * The user's choice isn't known until they return, so re-check status on the
 * next app foreground.
 */
export async function requestIgnoreBatteryOptimizations(): Promise<void> {
  if (Platform.OS !== 'android' || !native?.requestIgnoreBatteryOptimizations) {
    return;
  }
  try {
    await native.requestIgnoreBatteryOptimizations();
    logger.track('battery_opt_prompt_shown');
  } catch (e) {
    logger.track('battery_opt_prompt_failed', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
  }
}
