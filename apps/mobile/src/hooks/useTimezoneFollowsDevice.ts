// Follow the phone's timezone on sign-in and every foreground.
// See services/users/syncTimezoneFromDevice.ts.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncTimezoneFromDevice } from '../services/users/syncTimezoneFromDevice';

export function useTimezoneFollowsDevice(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    void syncTimezoneFromDevice();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncTimezoneFromDevice();
    });
    return () => sub.remove();
  }, [isAuthenticated]);
}
