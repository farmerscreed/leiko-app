// Analytics logger shim — Sprint 5.
//
// PostHog wiring lands in Sprint 11/12. Until then, every track() call
// goes to console (dev) and a small MMKV ring buffer (so we can flush
// the queue once PostHog initialises). Call sites stay; the impl swap
// is one file.
//
// Per CLAUDE.md data rule: reading values (BP, HR, SpO2) NEVER appear
// in analytics events. Pass deviceId / family_id / counts / categories
// only.

import { mmkv } from '../storage';

const RING_BUFFER_KEY = 'leiko.analytics.queue';
const RING_BUFFER_LIMIT = 200;

export type AnalyticsEvent =
  | { name: 'ble_scan_started'; props?: Record<string, unknown> }
  | { name: 'ble_scan_stopped'; props?: { reason: string } }
  | { name: 'ble_device_found'; props?: { macSuffix: string } }
  | { name: 'ble_pair_attempt'; props?: { macSuffix: string } }
  | { name: 'ble_pair_success'; props?: { macSuffix: string; durationMs: number } }
  | { name: 'ble_pair_failed'; props?: { macSuffix?: string; reason: string } }
  | { name: 'ble_crc_fail'; props?: { deviceId?: string } }
  | { name: 'ble_invalid_reading'; props?: { deviceId?: string; field: string } }
  | { name: 'ble_disconnected'; props?: { deviceId?: string; reason?: string } }
  | { name: 'ble_reconnect_attempt'; props?: { deviceId?: string; retryCount: number } }
  | { name: 'ble_reconnect_gave_up'; props?: { deviceId?: string } }
  | { name: 'ble_permission_denied'; props?: { permission: string } }
  | { name: 'ble_bluetooth_off' }
  | { name: 'ble_forget_device'; props?: { deviceId?: string } }
  // Sprint 6 — reading capture lifecycle. Per CLAUDE.md data rule,
  // event payloads NEVER include sys/dia/pulse values, only counts +
  // categories.
  | { name: 'reading_persisted'; props?: { source: 'watch' | 'manual'; tier: 'in_pattern' | 'calm_concerned' | 'confirmed_urgent' } }
  | { name: 'reading_sync_success'; props?: { duplicate: boolean } }
  | { name: 'reading_sync_failed'; props?: { reason: string } }
  | { name: 'take_reading_started'; props?: { trigger: 'fab' | 'manual_sheet' } }
  | { name: 'take_reading_received'; props?: { source: 'watch' | 'manual' } }
  | { name: 'take_reading_failed'; props?: { reason: string } }
  // Sprint 7 — sync orchestrator. Counts + categories only; the reading
  // values themselves never appear in events (CLAUDE.md data rule).
  | { name: 'sync_started'; props?: { trigger: 'cold_start' | 'app_foreground' | 'bt_ready' | 'manual_force' | 'live_notify' | 'background' } }
  | { name: 'sync_completed'; props?: { trigger: string; batches: number; hitBatchCap: boolean; pulled: number } }
  | { name: 'sync_skipped'; props?: { trigger: string; reason: 'no_paired_device' | 'take_reading_active' | 'too_recent' | 'already_running' } }
  | { name: 'sync_failed'; props?: { trigger: string; reason: string } }
  | { name: 'reading_realtime_received'; props?: { familyId: string } }
  // Sprint 7.7b — multi-vital realtime path. Caregiver home invalidates
  // its query when any vitals_other row is INSERTed for a family the
  // signed-in user belongs to. Counts/categories never carry the value.
  | { name: 'vitals_other_realtime_received'; props?: { familyId: string } }
  // Sprint 7.5 — per-vital persistence + sync lifecycle. Counts +
  // categories only; sample VALUES (bpm, percent, steps, etc.) never
  // appear in analytics. Per CLAUDE.md data rule + D13 §5.1.
  | { name: 'vital_persisted'; props?: { vital_type: 'hr' | 'spo2' | 'sleep' | 'activity' | 'calories'; count?: number } }
  | { name: 'vital_sync_accepted'; props?: { vital_type: 'hr' | 'spo2' | 'sleep' | 'activity' | 'calories'; count: number } }
  // Sprint 9.5 — Apple Health / Health Connect bridge. Counts only,
  // never values. Per D13 §13.4 + CLAUDE.md analytics rule.
  | { name: 'health_platform_write'; props?: { vital_type: 'bp' | 'hr' | 'spo2' | 'sleep' | 'steps' | 'calories'; written: number; rejected: number } }
  | { name: 'health_platform_write_failed'; props?: { vital_type: string; reason: string } }
  | { name: 'health_platform_read_completed'; props?: { inserted: number; duplicates: number; rejected: number } }
  | { name: 'health_platform_read_failed'; props?: { stage: 'platform_read' | 'sync_post'; reason: string } }
  | { name: 'health_platform_read_skipped'; props?: { trigger: 'foreground' | 'manual' | 'background'; reason: string } }
  | { name: 'health_platform_permission_granted'; props?: { platform: string } }
  | { name: 'health_platform_permission_dismissed'; props?: { platform: string } }
  | { name: 'health_platform_permission_skipped'; props?: { platform: string; reason: string } }
  // Sprint 10b.2 — Settings → Vital streams + Goals flush to the watch.
  // Closes memory/multi_vitals_gap.md "setUserParams + setGoals stubbed".
  | { name: 'device_config_flushed'; props?: { steps: number } }
  | { name: 'device_config_failed'; props?: { failedStep: string; completed: number } }
  // Sprint 10b.3 — Settings → Notifications + Privacy.
  | { name: 'notification_prefs_sync_failed'; props?: { reason: string } }
  | { name: 'data_export_started'; props?: { tier: string } }
  | { name: 'data_export_completed'; props?: { rowCount: number } }
  | { name: 'data_export_failed'; props?: { reason: string } }
  | { name: 'account_delete_requested'; props?: { confirmed: boolean } }
  | { name: 'account_delete_failed'; props?: { reason: string } }
  // Sprint 10c.1 — Family invite flow.
  | { name: 'family_invite_send_started' }
  | { name: 'family_invite_send_completed' }
  | { name: 'family_invite_send_failed'; props?: { reason: string } }
  | { name: 'family_invite_accept_started' }
  | { name: 'family_invite_accept_completed'; props?: { familyId: string } }
  | { name: 'family_invite_accept_failed'; props?: { reason: string } }
  // Sprint 10c.2 polish — OS-scheduled background sync lifecycle.
  | { name: 'background_sync_registered'; props?: { intervalMin: number } }
  | { name: 'background_sync_unregistered' }
  | { name: 'background_sync_unavailable'; props?: { reason: string } }
  | { name: 'background_sync_fired'; props?: { result: 'ran' | 'skipped' | 'errored'; reason?: string } }
  // Sprint 12 — Tier-B AI gateway. Body of the LLM response is NEVER
  // included in props per CLAUDE.md / D14 §13.
  | { name: 'ai_tier_b_started'; props?: { length: number } }
  | { name: 'ai_tier_b_ok'; props?: { retries: number; layer1_hits: number; layer2_max_cosine: number } }
  | { name: 'ai_tier_b_defer'; props?: { trigger: string; reason: string } }
  | { name: 'ai_tier_b_quota_exceeded' }
  | { name: 'ai_tier_b_failed'; props?: { reason: string } }
  // Sprint 14.5 — self-buyer family auto-provision (legacy backfill).
  | { name: 'family_auto_provision_started' }
  | { name: 'family_auto_provision_completed' }
  | { name: 'family_auto_provision_failed'; props?: { reason: string } }
  // Sprint 12.5 — ambient AI narrations. tier identifies the path
  // ('A' = local template, 'B' = Tier-B LLM via Edge Function).
  // Body NEVER appears in props per CLAUDE.md / D14 §13.
  | { name: 'daily_narration_generated'; props?: { tier: string; template_id: string } };

type EventName = AnalyticsEvent['name'];

function readQueue(): Array<{ name: EventName; props: unknown; ts: number }> {
  const raw = mmkv.getString(RING_BUFFER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: Array<{ name: EventName; props: unknown; ts: number }>): void {
  const trimmed = queue.length > RING_BUFFER_LIMIT
    ? queue.slice(-RING_BUFFER_LIMIT)
    : queue;
  mmkv.set(RING_BUFFER_KEY, JSON.stringify(trimmed));
}

type EventProps<N extends EventName> = Extract<AnalyticsEvent, { name: N }> extends {
  props?: infer P;
}
  ? P
  : never;

export function track<N extends EventName>(name: N, props?: EventProps<N>): void {
  const entry = { name, props: props ?? null, ts: Date.now() };
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[analytics]', name, props ?? '');
  }
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
}

/** Read the most-recent N events without draining. Used by the dev
 *  debug panel for the sync-event timeline. Returns oldest-first. */
export function peekRecent(n: number): Array<{ name: EventName; props: unknown; ts: number }> {
  const queue = readQueue();
  return queue.slice(-n);
}

export function drainQueue(): Array<{ name: EventName; props: unknown; ts: number }> {
  const queue = readQueue();
  mmkv.set(RING_BUFFER_KEY, '[]');
  return queue;
}

export function queueLength(): number {
  return readQueue().length;
}

export const logger = { track, drainQueue, queueLength };
