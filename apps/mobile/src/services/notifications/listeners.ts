// Notification + deep-link listeners — Sprint 15.
//
// Subscribes once at app boot. The returned cleanup function detaches
// every listener; RootNavigator calls it from the unmount path.

import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { handleDeepLink } from './deepLinks';
import { isRemoteRefreshData, triggerRemoteRefresh } from './remoteRefreshTask';
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
    // A tapped sync-nudge (the visible remote-refresh fallback) carries
    // { type: 'sync_refresh' } and no url — run the BLE sync, don't route.
    if (isRemoteRefreshData(data)) {
      void triggerRemoteRefresh('tap');
      return;
    }
    if (data?.url) {
      handleDeepLink(data.url, data.category);
    }
  });

  // 3. Foreground receive — telemetry + the foreground remote-refresh
  //    path. Display behaviour is configured by setNotificationHandler
  //    (which suppresses the silent sync_refresh push so nothing shows).
  const receivedSub = Notifications.addNotificationReceivedListener((notif) => {
    const data = notif.request.content.data as
      | { category?: string; type?: string }
      | undefined;
    logger.track('push_received', { category: data?.category ?? 'unknown' });
    if (isRemoteRefreshData(data)) {
      void triggerRemoteRefresh('foreground');
    }
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
      if (isRemoteRefreshData(data)) {
        void triggerRemoteRefresh('tap');
      } else if (data?.url) {
        handleDeepLink(data.url, data.category);
      }
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
