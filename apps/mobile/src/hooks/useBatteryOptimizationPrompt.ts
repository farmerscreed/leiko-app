// useBatteryOptimizationPrompt — decides whether to ask the wearer to exempt
// Leiko from battery optimization, so the silent remote-refresh push can wake
// the phone reliably (Android throttles data messages to optimized apps).
//
// Gating: only on a phone that has a paired watch (the device that actually
// syncs — a remote caregiver's phone never needs this), only when not already
// exempt, and only until the user dismisses once (persisted in MMKV). Status
// is re-checked on every app foreground, so returning from the system dialog
// updates `show` without a manual refresh.

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { usePairing } from '../state/pairing';
import { mmkv } from '../services/storage';
import {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
} from '../services/power/batteryOptimization';

const DISMISS_KEY = 'leiko.batteryOpt.dismissed';

export interface BatteryOptimizationPromptState {
  /** Render the prompt? */
  show: boolean;
  /** Open the system exemption dialog. */
  request: () => Promise<void>;
  /** Permanently dismiss (won't re-show; re-enable via Settings later). */
  dismiss: () => void;
}

export function useBatteryOptimizationPrompt(): BatteryOptimizationPromptState {
  const hasPairedDevice = usePairing((s) => s.pairedDevice != null);
  const [exempt, setExempt] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(
    () => mmkv.getBoolean(DISMISS_KEY) ?? false,
  );

  const refresh = useCallback(() => {
    void isIgnoringBatteryOptimizations().then(setExempt);
  }, []);

  useEffect(() => {
    if (!hasPairedDevice || dismissed) return;
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [hasPairedDevice, dismissed, refresh]);

  const request = useCallback(async () => {
    await requestIgnoreBatteryOptimizations();
    // Status updates on the next foreground refresh once the user returns.
  }, []);

  const dismiss = useCallback(() => {
    mmkv.set(DISMISS_KEY, true);
    setDismissed(true);
  }, []);

  const show = hasPairedDevice && exempt === false && !dismissed;
  return { show, request, dismiss };
}
