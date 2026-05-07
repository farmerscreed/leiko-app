// 0x73 — Watch-pushed notifications. Per docs/_reference/U16PRO_protocol_en.pdf §4.13.
// The watch fires this packet whenever it has new data ready for the
// app to fetch. We subscribe once on connect and dispatch to typed
// handlers; the actual data is pulled via the matching read command
// (0x14 BP, 0x15 HR, 0x2D SpO2, 0x12 activity / sleep).
//
// Format: 0x73 KIND 00×13 CRC
//   KIND values per the vendor U16PRO PDF (empirically verified for
//   BP on U19M_013C in Lagos 2026-05-07):
//     0x01 Heart rate                       → call readHRHistory
//     0x02 Blood pressure                   → call readBPHistory
//     0x03 Blood oxygen                     → call readSpO2History
//     0x04 Step counting                    → activity refresh
//     0x07 Sports record                    → activity refresh
//     0x09 Do-not-disturb                   → settings echo
//     0x0C Battery level                    → re-read battery
//     0x10 Sleep session complete           → call readSleep (Sprint 7.5,
//                                              candidate per D13 §3.2 —
//                                              UNVERIFIED empirically; the
//                                              orchestrator's sequenced-
//                                              sync pulls last-night sleep
//                                              on every reconnect anyway,
//                                              so a missed/misrouted byte
//                                              here is non-fatal)
//     0x05/0x06/0x08/0x0A/0x0B reserved/unused per protocol
//
// D13 §3.2 listed 0x01=BP and 0x02=HR (reversed) but the current map
// matches the vendor PDF AND empirical Sprint 6 BP routing. The D13
// docs/-side patch is in the same sprint.

import type { ParsedPacket } from './io';
import type { UrionDevice } from './UrionDevice';

export type NotificationKind =
  | 'hr'
  | 'bp'
  | 'spo2'
  | 'steps'
  | 'sports'
  | 'dnd'
  | 'battery'
  | 'sleep_session_complete'
  | 'unknown';

export interface NotificationHandlers {
  onBP?: () => void;
  onHR?: () => void;
  onSpO2?: () => void;
  onSteps?: () => void;
  onSports?: () => void;
  onDnd?: () => void;
  onBattery?: () => void;
  /** D13 §3.2 candidate handler; byte 0x10. Caller should log to
   *  PostHog 'ble_notify_kind_observed' on first call so we can
   *  empirically confirm the byte during the Sprint 7.5 soak test. */
  onSleepSessionComplete?: () => void;
  onUnknown?: (kindByte: number) => void;
}

const KIND_BY_BYTE: Record<number, NotificationKind> = {
  0x01: 'hr',
  0x02: 'bp',
  0x03: 'spo2',
  0x04: 'steps',
  0x07: 'sports',
  0x09: 'dnd',
  0x0c: 'battery',
  0x10: 'sleep_session_complete',
};

export function classifyNotification(packet: ParsedPacket): NotificationKind | null {
  if (packet.command !== 0x73) return null;
  return KIND_BY_BYTE[packet.payload[0]] ?? 'unknown';
}

/**
 * Subscribe to 0x73 watch-pushed notifications and route to typed
 * handlers. Returns an unsubscribe function. Caller must hold the
 * UrionDevice in a connected state.
 */
export function subscribeToNotifications(
  device: UrionDevice,
  handlers: NotificationHandlers,
): () => void {
  return device.onNotify((packet) => {
    if (packet.command !== 0x73) return;
    const kind = classifyNotification(packet);
    switch (kind) {
      case 'bp':
        handlers.onBP?.();
        break;
      case 'hr':
        handlers.onHR?.();
        break;
      case 'spo2':
        handlers.onSpO2?.();
        break;
      case 'steps':
        handlers.onSteps?.();
        break;
      case 'sports':
        handlers.onSports?.();
        break;
      case 'dnd':
        handlers.onDnd?.();
        break;
      case 'battery':
        handlers.onBattery?.();
        break;
      case 'sleep_session_complete':
        handlers.onSleepSessionComplete?.();
        break;
      case 'unknown':
      default:
        handlers.onUnknown?.(packet.payload[0]);
        break;
    }
  });
}
