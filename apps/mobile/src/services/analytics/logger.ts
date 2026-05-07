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
  | { name: 'reading_persisted'; props?: { source: 'watch' | 'manual'; tier: 'in_range' | 'calm_concerned' | 'confirmed_urgent' } }
  | { name: 'reading_sync_success'; props?: { duplicate: boolean } }
  | { name: 'reading_sync_failed'; props?: { reason: string } }
  | { name: 'take_reading_started'; props?: { trigger: 'fab' | 'manual_sheet' } }
  | { name: 'take_reading_received'; props?: { source: 'watch' | 'manual' } }
  | { name: 'take_reading_failed'; props?: { reason: string } };

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

export function drainQueue(): Array<{ name: EventName; props: unknown; ts: number }> {
  const queue = readQueue();
  mmkv.set(RING_BUFFER_KEY, '[]');
  return queue;
}

export function queueLength(): number {
  return readQueue().length;
}

export const logger = { track, drainQueue, queueLength };
