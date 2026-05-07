// 0x73 — Watch-pushed notifications. Per docs/_reference/U16PRO_protocol_en.pdf §4.13.
// The watch fires this packet whenever it has new data ready for the
// app to fetch. We subscribe once on connect and dispatch to typed
// handlers; the actual data is pulled via the matching read command
// (0x14 BP, 0x15 HR, 0x2D SpO2, 0x07 activity).
//
// Format: 0x73 KIND 00×13 CRC
//   KIND values per spec:
//     0x01 Heart rate          → call readHRHistory (Sprint 9)
//     0x02 Blood pressure      → call readBPHistory  (Sprint 6)
//     0x03 Blood oxygen        → call readSpO2History (Sprint 9)
//     0x04 Step counting       → activity refresh    (Sprint 9)
//     0x07 Sports record       → activity refresh
//     0x09 Do-not-disturb      → settings echo
//     0x0C Battery level       → re-read battery
//     0x05/0x06/0x08/0x0A/0x0B reserved/unused per protocol

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
  | 'unknown';

export interface NotificationHandlers {
  onBP?: () => void;
  onHR?: () => void;
  onSpO2?: () => void;
  onSteps?: () => void;
  onSports?: () => void;
  onDnd?: () => void;
  onBattery?: () => void;
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
      case 'unknown':
      default:
        handlers.onUnknown?.(packet.payload[0]);
        break;
    }
  });
}
