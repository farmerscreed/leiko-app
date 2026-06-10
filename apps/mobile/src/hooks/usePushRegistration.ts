// usePushRegistration — register for push once auth is hydrated, and
// re-register on every app foreground.
//
// Why a dedicated hook: the Sprint 15 implementation called
// registerForPushNotifications() once, at RootNavigator mount. That raced
// auth hydration — it returned `no_user` for anyone who signed in AFTER the
// navigator mounted (interactive sign-in, or a cold-start race), so
// public.push_tokens never got a row and silent remote-refresh pushes had
// no device to reach. Re-running on the authenticated transition and on
// foreground fixes that. registerForPushNotifications() is idempotent (a
// single in-flight promise), so re-calling is safe.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { registerForPushNotifications } from '../services/notifications';

export function usePushRegistration(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPushNotifications();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void registerForPushNotifications();
    });
    return () => sub.remove();
  }, [isAuthenticated]);
}
