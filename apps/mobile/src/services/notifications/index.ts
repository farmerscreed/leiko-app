// Push notifications service — Sprint 15.
//
// Single entry point for everything notification-related:
//
//   - registerForPushNotifications() — call once at app launch (auth'd).
//     Prompts for permission if undetermined, fetches Expo push token,
//     upserts into public.push_tokens. Idempotent — re-registering on
//     foreground re-syncs the token (per docs/11-push-notifications.md §6).
//
//   - unregisterPushTokenForCurrentDevice() — call on sign-out. Drops
//     the device row so an old token doesn't accumulate.
//
//   - configureNotificationHandler() — sets the foreground-display
//     behaviour. Anomaly + medication channels get HIGH importance on
//     Android; the rest get DEFAULT/LOW per docs/11 §1.
//
//   - addNotificationTapListener() — wires deep-link routing. The
//     RootNavigator subscribes once at mount.
//
// Per CLAUDE.md voice + data rules: no PHI in PostHog. Token is opaque
// per Expo; we log only success/failure + platform.
//
// HARD RULES (D11 + CLAUDE.md):
//   - Never use Critical Alerts entitlement. Confirmed-urgent uses
//     iOS time-sensitive interruption-level which respects DND.
//   - Permission prompt copy is non-fear-based.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { mmkv } from '../storage';
import { supabase } from '../supabase';
import { logger } from '../analytics/logger';

const DEVICE_ID_KEY = 'leiko.notifications.deviceId';

export interface PushTokenRegistrationResult {
  ok: boolean;
  reason?:
    | 'permission_denied'
    | 'permission_undetermined'
    | 'token_fetch_failed'
    | 'no_user'
    | 'upsert_failed';
  expoToken?: string;
}

let registrationInFlight: Promise<PushTokenRegistrationResult> | null = null;

/**
 * Resolve a stable per-install device id. Stored in MMKV so the same
 * install always reuses the same row in public.push_tokens (the table
 * primary key is (user_id, device_id) per docs/01-data-model.md). UUID
 * is fine — we just need uniqueness across the user's devices.
 */
export function getDeviceId(): string {
  const cached = mmkv.getString(DEVICE_ID_KEY);
  if (cached) return cached;
  const fresh =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  mmkv.set(DEVICE_ID_KEY, fresh);
  return fresh;
}

/**
 * Configure foreground display + Android notification channels.
 * Idempotent — called once at app boot via RootNavigator.
 */
export async function configureNotificationHandler(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // Expo SDK 50+: surface in banner + list.
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    // Per docs/11-push-notifications.md §1 — eight channels, three
    // importance bands. Anomaly + medication = HIGH (heads-up).
    // Daily/weekly/family/hybrid = DEFAULT. Watch status / account /
    // marketing = LOW (no sound).
    const channels: Array<{
      id: string;
      name: string;
      importance: number;
    }> = [
      { id: 'anomaly', name: 'Anomaly notices', importance: Notifications.AndroidImportance.HIGH },
      { id: 'medication', name: 'Medication reminders', importance: Notifications.AndroidImportance.HIGH },
      { id: 'daily-summary', name: 'Daily summary', importance: Notifications.AndroidImportance.DEFAULT },
      { id: 'weekly-summary', name: 'Weekly summary', importance: Notifications.AndroidImportance.DEFAULT },
      { id: 'family', name: 'Family activity', importance: Notifications.AndroidImportance.DEFAULT },
      { id: 'hybrid', name: 'Family activity', importance: Notifications.AndroidImportance.DEFAULT },
      { id: 'device', name: 'Watch status', importance: Notifications.AndroidImportance.LOW },
      { id: 'account', name: 'Account', importance: Notifications.AndroidImportance.LOW },
      { id: 'marketing', name: 'News from Leiko', importance: Notifications.AndroidImportance.LOW },
    ];
    for (const ch of channels) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        importance: ch.importance,
      });
    }
  }
}

/**
 * Register the device for push notifications + sync the resulting
 * Expo token to public.push_tokens. Safe to call repeatedly — concurrent
 * callers share the single in-flight promise.
 */
export async function registerForPushNotifications(): Promise<PushTokenRegistrationResult> {
  if (registrationInFlight) return registrationInFlight;
  registrationInFlight = registerInternal().finally(() => {
    registrationInFlight = null;
  });
  return registrationInFlight;
}

async function registerInternal(): Promise<PushTokenRegistrationResult> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return { ok: false, reason: 'no_user' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status === 'undetermined') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
    logger.track('push_permission_prompted', { granted: requested.granted });
  }
  if (status !== 'granted') {
    logger.track('push_permission_denied');
    return { ok: false, reason: 'permission_denied' };
  }

  let expoToken: string;
  let nativeToken: string | null = null;
  let nativeTokenType: 'apns' | 'fcm' | null = null;
  try {
    // Native token is useful for the future migration off Expo Push API
    // (per docs/01-data-model.md push_tokens stores both Expo + native).
    const native = await Notifications.getDevicePushTokenAsync();
    nativeToken = (native?.data as string) ?? null;
    if (native?.type === 'ios') nativeTokenType = 'apns';
    if (native?.type === 'android') nativeTokenType = 'fcm';
  } catch {
    // Sandbox / simulator path — no native token, just Expo. Fine.
  }
  try {
    const result = await Notifications.getExpoPushTokenAsync();
    expoToken = result.data;
  } catch (e) {
    logger.track('push_token_fetch_failed', { reason: String(e) });
    return { ok: false, reason: 'token_fetch_failed' };
  }

  const deviceId = getDeviceId();
  const platform: 'ios' | 'android' | 'web' =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  const row = {
    user_id: userId,
    device_id: deviceId,
    expo_token: expoToken,
    apns_token: nativeTokenType === 'apns' ? nativeToken : null,
    fcm_token: nativeTokenType === 'fcm' ? nativeToken : null,
    platform,
    app_version: null,
    os_version: null,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('push_tokens')
    .upsert(row, { onConflict: 'user_id,device_id' });
  if (error) {
    logger.track('push_token_upsert_failed', { reason: error.message });
    return { ok: false, reason: 'upsert_failed', expoToken };
  }

  logger.track('push_token_registered', { platform });
  return { ok: true, expoToken };
}

/**
 * Drop the current device's push token. Called from sign-out.
 */
export async function unregisterPushTokenForCurrentDevice(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;
  const deviceId = getDeviceId();
  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId);
  if (error) {
    logger.track('push_token_unregister_failed', { reason: error.message });
  }
}

/** For dev / settings — clear the persisted device id so a fresh row is
 *  written on next register. Useful only when the user has rotated
 *  installs. Not exposed to UI in Sprint 15. */
export function __resetDeviceIdForTest(): void {
  mmkv.remove(DEVICE_ID_KEY);
}
