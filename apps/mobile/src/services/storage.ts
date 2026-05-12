// MMKV-backed key/value layer. CLAUDE.md mandates MMKV (no localStorage /
// sessionStorage). The Supabase auth client expects a Storage adapter
// matching {getItem, setItem, removeItem}; this file exports both the raw
// MMKV instance (for the Zustand auth store's pendingAccountType cache)
// and the Supabase-shaped adapter.
//
// Test surface: mocked at __mocks__/react-native-mmkv.js so jest projects
// (pure + rn) can import this module without the native module loading.
// Tokens live here in dev only — the production build will gate access
// through the platform Keychain/Keystore (per docs/00-tech-stack.md
// §Encryption inventory). Keychain integration is a follow-up task.

import { createMMKV, type MMKV } from 'react-native-mmkv';

export const mmkv: MMKV = createMMKV({ id: 'leiko' });

export const STORAGE_KEYS = {
  pendingAccountType: 'leiko.onboarding.pendingAccountType',
  authStorePrefix: 'leiko.auth.',
  // Set true at the end of caregiver onboarding (FamilyWatch "I have the
  // watch with me"). The navigator reads this to decide whether to render
  // the onboarding stack or the home stack.
  caregiverOnboardingComplete: 'leiko.onboarding.caregiver.complete',
  // Set true at the end of self-buyer onboarding (Watch "I have it"),
  // parallel to caregiverOnboardingComplete. Sprint 4.
  selfBuyerOnboardingComplete: 'leiko.onboarding.selfBuyer.complete',
  // Family id returned by the create_family RPC. Persisted so a crash
  // mid-flow doesn't orphan the family record.
  currentFamilyId: 'leiko.family.currentId',
  // Paired Urion device for the current user/family. Sprint 5.
  // Stored as JSON: { id, mac, model, deviceId (Supabase row id), pairedAt }.
  pairedDevice: 'leiko.ble.pairedDevice',
  // Readings buffer — Sprint 6. Two arrays of LocalReading rows:
  //   pending: not yet successfully POSTed to /sync
  //   recent:  synced + persisted, capped at RECENT_READINGS_CAP for UI
  // Both serialised as JSON. Pending is the source of truth for the
  // offline-first guarantee per CLAUDE.md ("every reading is saved to
  // MMKV before any sync attempt"). Sprint 7+ replaces the recent
  // cache with WatermelonDB queries.
  pendingReadings: 'leiko.readings.pending',
  recentReadings: 'leiko.readings.recent',
  // Per-device sync cursor — Sprint 6. JSON map { [bleId]: timestampSec }
  // of the newest reading already pulled from each watch. Drives the
  // incremental readBPHistory(sinceTimestampSec=cursor) calls so we
  // backfill everything captured while the app was closed.
  // The lastSync is per-device (not per-family) because the watch is
  // the unit that buffers; pairing a different watch resets that
  // device's cursor naturally on first sync.
  lastSyncByDevice: 'leiko.sync.lastSyncByDevice',
  // D12 visual mode — Sprint 1.5. ColorModeOverride: 'system' | 'dark' | 'light'.
  // Default 'system' (follow OS appearance). User-facing toggle ships in
  // Sprint 10 Settings; ThemeProvider reads/writes this key directly.
  themeColorMode: 'leiko.theme.colorMode',
  // Caregiver Family Constellation view preference — Sprint 7.7a/b.
  // Values: 'birds' (bird's-eye constellation) | 'cards' (editorial card
  // stack — lands in 7.7b). Default 'birds'. Plumbed in 7.7a; toggle UI
  // ships in 7.7b alongside the editorial-card view.
  caregiverViewMode: 'leiko.caregiver.viewMode',
  // Per-vital pending buffers — Sprint 7.5 / D13 §5.1. Each is a JSON
  // array of typed samples (HRSample / SpO2Sample / SleepSession /
  // ActivityDay / CaloriesDay) waiting for a successful /sync upload.
  // Same offline-first guarantee as pendingReadings: every captured
  // sample lands here BEFORE any sync attempt, so a network/BLE failure
  // never loses data. Flushed by each vital state slice's syncPending.
  pendingHR: 'leiko.vitals.pending.hr',
  pendingSpO2: 'leiko.vitals.pending.spo2',
  pendingSleep: 'leiko.vitals.pending.sleep',
  pendingActivity: 'leiko.vitals.pending.activity',
  pendingCalories: 'leiko.vitals.pending.calories',
  // Apple Health / Health Connect toggle state — Sprint 9.5. JSON
  // {master, perVitalWrite, perVitalRead}. Default: master OFF + all
  // children OFF (D13 §12.5 "opt-in, default off"). The
  // services/health-platform/toggles.ts store reads/writes this key;
  // Settings UI ships in Sprint 10 (D13 §12.5 "Settings has master
  // toggle ... + per-vital granular toggles").
  healthPlatformToggles: 'leiko.health-platform.toggles',
  // Apple Health / Health Connect read cursor — Sprint 9.5 / Task 7.
  // unix-sec timestamp of the last successful background fetch. The
  // fetcher reads samples since this timestamp; on success it advances
  // to "now". '' / unset means "no successful fetch yet — backfill the
  // last 30 days on first run." Single global cursor (not per-vital)
  // because the read window is identical across weight / height /
  // glucose; per-vital sub-cursoring would buy nothing.
  healthPlatformReadCursor: 'leiko.health-platform.readCursorSec',
  // Last fetch attempt wall-clock — Sprint 9.5 / Task 7. Independent of
  // readCursor (which advances ONLY on success). Used by the 24h
  // debounce so a failed fetch doesn't immediately retry on the next
  // foreground transition.
  healthPlatformLastAttempt: 'leiko.health-platform.lastAttemptMs',
  // Apple Health / Health Connect permission prompt — Sprint 9.5 / Task 8.
  // 'true' once the user has been shown the in-app opt-in (D13 §12.5),
  // regardless of whether they accepted or dismissed. We never re-show
  // automatically — Settings UI in Sprint 10 is the second-chance path.
  healthPlatformPermissionPrompted: 'leiko.health-platform.permissionPrompted',
  // Notification preferences — Sprint 10b.3. JSON mirror of the
  // public.notification_preferences row for the signed-in user. MMKV
  // is the offline source of truth; supabase write is best-effort.
  // The row defaults are spec-driven (docs/04-screens/settings.md
  // §Notifications + D13 §11.3); see state/notifications.ts.
  notificationPrefs: 'leiko.notifications.prefs',
  // Vital-setup user preferences — Sprint 10b.2. JSON
  // {autoHrEnabled, autoSpo2Enabled, stepsTarget, sleepTargetMin, dirty}.
  // Surfaced in Settings → Vital streams + Goals. Orchestrator's
  // applyDeviceConfig step flushes the values to the watch via
  // setAutoHR / setAutoSpO2 / setGoals on the next sync run, then
  // clears dirty.
  vitalSetup: 'leiko.vitalSetup',
  // AI Tier-B quota counter cache — Sprint 10b.2. JSON
  // {monthKey, count, lastReconcileMs}. Settings reads this for the
  // "X of N questions used this month" surface; the service reconciles
  // against audit_log on app foreground.
  aiQuotaCounter: 'leiko.ai.quotaCounter',
  // 6th-reading auto-paywall flag — Sprint 10a. Per D8a §9.1 + docs/09 §3,
  // the paywall fires automatically on the 6th reading "per family per
  // month". Stored as 'YYYY-MM' string of the calendar month it was
  // last surfaced for the given family. Compared on every readings tick
  // by hooks/useSixthReadingTrigger.ts; surfacing once per (family,
  // month) prevents nag.
  sixthReadingShown: 'leiko.paywall.sixthReading',
  // Per-vital recent caches — Sprint 7.5. Server-acknowledged samples,
  // capped per-slice for the home/Daily Pulse aggregators. Mirrors the
  // recentReadings pattern; see state/hr.ts etc. for the cap constants.
  recentHR: 'leiko.vitals.recent.hr',
  recentSpO2: 'leiko.vitals.recent.spo2',
  recentSleep: 'leiko.vitals.recent.sleep',
  recentActivity: 'leiko.vitals.recent.activity',
  recentCalories: 'leiko.vitals.recent.calories',
  // Learn home-card seed tracking — Sprint 14. JSON map keyed by
  // article id: { [articleId]: { dismissedAt: ms | null, readAt: ms | null } }.
  // Dismiss hides the card for 30 days; read hides it for 90 days
  // (per Sprint 14 acceptance criteria + Learn module §5).
  learnSeedTracking: 'leiko.learn.seedTracking',
  // First BP reading timestamp — Sprint 14. Unix ms of the user's
  // first ever BP reading; used as Day-0 anchor for the seeded
  // onboarding sequence. Set once by the readings store on the
  // first persisted reading; never overwritten.
  learnFirstReadingMs: 'leiko.learn.firstReadingMs',
  // Sprint 15 — one-shot guard for the quiet-hours-override affirm
  // sheet. 'true' once the user has explicitly answered either way
  // (the answer itself lives in notification_preferences.anomaly_bypass_quiet).
  // We never re-prompt automatically; Settings is the second-chance path.
  anomalyBypassAffirmAnswered: 'leiko.notifications.anomalyBypassAffirmAnswered',
} as const;

export const supabaseStorage = {
  getItem: (key: string): string | null => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    mmkv.set(key, value);
  },
  removeItem: (key: string): void => {
    mmkv.remove(key);
  },
};
