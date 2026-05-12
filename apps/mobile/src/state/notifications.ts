// Notification preferences — Sprint 10b.3.
//
// Backs Settings → Notifications. Per CLAUDE.md "all toggles are
// MMKV-first, then synced to Supabase preferences": this store reads
// MMKV synchronously on hydration, writes MMKV on every change, and
// fires a best-effort upsert into public.notification_preferences in
// the background. Supabase failures don't block UI — the next
// reconcile picks up the latest value.
//
// Sourced from docs/04-screens/settings.md §Notifications +
// docs/_reference/D13-multi-vitals-constellation-spec.md §11.3.

import { create } from 'zustand';
import { mmkv, STORAGE_KEYS } from '../services/storage';
import { supabase as defaultSupabase } from '../services/supabase';
import { logger } from '../services/analytics/logger';
import type { Database } from '../types/database';

type NotificationPreferencesInsert =
  Database['public']['Tables']['notification_preferences']['Insert'];

export interface NotificationPrefs {
  dailySummary: boolean;
  weeklySummary: boolean;
  anomalyNotifications: boolean;
  /** Sprint 15 — per-vital anomaly opt-outs. Each is gated by
   *  anomalyNotifications: when the umbrella is off, the per-vital
   *  toggles have no effect. */
  anomalyBp: boolean;
  anomalyHr: boolean;
  anomalySpo2: boolean;
  watchStatus: boolean;
  familyActivity: boolean;
  subscriptionAccount: boolean;
  marketing: boolean;
  quietHoursEnabled: boolean;
  /** 'HH:MM' 24h. */
  quietHoursStart: string;
  quietHoursEnd: string;
  anomalyBypassQuiet: boolean;
  medicationBypassQuiet: boolean;
}

const DEFAULTS: NotificationPrefs = {
  dailySummary: true,
  weeklySummary: true,
  anomalyNotifications: true,
  anomalyBp: true,
  anomalyHr: true,
  anomalySpo2: true,
  watchStatus: true,
  familyActivity: true,
  subscriptionAccount: true,
  marketing: false, // opt-in per D6
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  // Sprint 15 — default flipped from true to false. Users now affirm
  // the quiet-hours override via the onboarding step.
  anomalyBypassQuiet: false,
  medicationBypassQuiet: true,
};

function readPersisted(): NotificationPrefs {
  const raw = mmkv.getString(STORAGE_KEYS.notificationPrefs);
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(value: NotificationPrefs): void {
  mmkv.set(STORAGE_KEYS.notificationPrefs, JSON.stringify(value));
}

function toRow(userId: string, p: NotificationPrefs): NotificationPreferencesInsert {
  return {
    user_id: userId,
    daily_summary: p.dailySummary,
    weekly_summary: p.weeklySummary,
    anomaly_notifications: p.anomalyNotifications,
    anomaly_bp: p.anomalyBp,
    anomaly_hr: p.anomalyHr,
    anomaly_spo2: p.anomalySpo2,
    watch_status: p.watchStatus,
    family_activity: p.familyActivity,
    subscription_account: p.subscriptionAccount,
    marketing: p.marketing,
    quiet_hours_enabled: p.quietHoursEnabled,
    quiet_hours_start: p.quietHoursStart,
    quiet_hours_end: p.quietHoursEnd,
    anomaly_bypass_quiet: p.anomalyBypassQuiet,
    medication_bypass_quiet: p.medicationBypassQuiet,
  };
}

async function syncToSupabase(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const client = defaultSupabase;
  const { error } = await client
    .from('notification_preferences')
    .upsert(toRow(userId, prefs), { onConflict: 'user_id' });
  if (error) {
    logger.track('notification_prefs_sync_failed', { reason: error.message });
  }
}

interface NotificationStore extends NotificationPrefs {
  set: <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => void;
  setMany: (patch: Partial<NotificationPrefs>) => void;
  /** Sync local MMKV state to Supabase. Called by the Settings screen
   *  on mount + on every toggle. Best-effort — failures are logged. */
  flushToSupabase: (userId: string) => Promise<void>;
  __resetForTest: () => void;
}

export const useNotifications = create<NotificationStore>((set, get) => {
  const initial = readPersisted();
  return {
    ...initial,

    set: (key, value) => {
      set({ [key]: value } as Pick<NotificationPrefs, typeof key>);
      const next = { ...get(), [key]: value } as NotificationPrefs;
      persist(next);
    },

    setMany: (patch) => {
      const next = { ...get(), ...patch } as NotificationPrefs;
      set(patch as Partial<NotificationStore>);
      persist(next);
    },

    flushToSupabase: async (userId: string) => {
      // Snapshot the current state then write — this captures the
      // value at call time rather than reading after an async hop.
      const snapshot: NotificationPrefs = {
        dailySummary: get().dailySummary,
        weeklySummary: get().weeklySummary,
        anomalyNotifications: get().anomalyNotifications,
        anomalyBp: get().anomalyBp,
        anomalyHr: get().anomalyHr,
        anomalySpo2: get().anomalySpo2,
        watchStatus: get().watchStatus,
        familyActivity: get().familyActivity,
        subscriptionAccount: get().subscriptionAccount,
        marketing: get().marketing,
        quietHoursEnabled: get().quietHoursEnabled,
        quietHoursStart: get().quietHoursStart,
        quietHoursEnd: get().quietHoursEnd,
        anomalyBypassQuiet: get().anomalyBypassQuiet,
        medicationBypassQuiet: get().medicationBypassQuiet,
      };
      await syncToSupabase(userId, snapshot);
    },

    __resetForTest: () => {
      mmkv.remove(STORAGE_KEYS.notificationPrefs);
      set({ ...DEFAULTS });
    },
  };
});
