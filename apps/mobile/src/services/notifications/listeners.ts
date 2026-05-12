// Notification + deep-link listeners — Sprint 15.
//
// Subscribes once at app boot. The returned cleanup function detaches
// every listener; RootNavigator calls it from the unmount path.

import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { handleDeepLink } from './deepLinks';
import { logger } from '../analytics/logger';

export interface NotificationListenerHandles {
  stop: () => void;
}

export function startNotificationListeners(): NotificationListenerHandles {
  // 1. App-running URL handler (WhatsApp link, Universal Link click).
  const linkingSub = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  // 2. Notification tap (foreground or background).
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | { url?: string; category?: string }
      | undefined;
    if (data?.url) {
      handleDeepLink(data.url, data.category);
    }
  });

  // 3. Foreground receive — for telemetry only; the display behaviour
  //    is configured by setNotificationHandler.
  const receivedSub = Notifications.addNotificationReceivedListener((notif) => {
    const data = notif.request.content.data as { category?: string } | undefined;
    logger.track('push_received', { category: data?.category ?? 'unknown' });
  });

  // 4. Cold-start path — fire only once.
  void (async () => {
    try {
      const initial = await Linking.getInitialURL();
      if (initial) handleDeepLink(initial);
      // expo-notifications cold-start tap.
      const last = await Notifications.getLastNotificationResponseAsync();
      const data = last?.notification.request.content.data as
        | { url?: string; category?: string }
        | undefined;
      if (data?.url) handleDeepLink(data.url, data.category);
    } catch {
      // best-effort
    }
  })();

  return {
    stop: () => {
      try {
        linkingSub?.remove?.();
      } catch {
        /* noop */
      }
      try {
        responseSub?.remove?.();
      } catch {
        /* noop */
      }
      try {
        receivedSub?.remove?.();
      } catch {
        /* noop */
      }
    },
  };
}
