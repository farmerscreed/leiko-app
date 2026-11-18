// Follow the phone's timezone on sign-in and every foreground.
// See services/users/syncTimezoneFromDevice.ts.
//
// 2026-11-17: also re-set the watch clock straight away when the phone
// has changed zones since we last set it (e.g. after a flight). Normal
// syncs already re-send the time, but the foreground sync can be skipped
// by the debounce, leaving the watch face on the old zone for a while.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncTimezoneFromDevice } from '../services/users/syncTimezoneFromDevice';
import { watchClockOutOfZone } from '../services/ble/watchClock';
import { useSyncOrchestrator } from '../state/syncOrchestrator';

function followDevice(): void {
  void syncTimezoneFromDevice();
  if (watchClockOutOfZone()) {
    void useSyncOrchestrator.getState().runSync('manual_force');
  }
}

export function useTimezoneFollowsDevice(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    followDevice();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') followDevice();
    });
    return () => sub.remove();
  }, [isAuthenticated]);
}
