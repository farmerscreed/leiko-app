// 0x07 — Read activity + sleep summary for a single day. Per
// docs/_reference/U16PRO_protocol_en.pdf §4.3.
//
// Request:  0x07 AA 00×13 CRC
//   AA = days-ago (0 = today, 10 = 10 days ago).
//
// Response: TWO packets, both with byte 0 = 0x07.
//   Both replies share the first 5 payload bytes:
//     byte 1 (AA): index — 0x00 = first packet (activity),
//                          0x01 = second packet (sleep)
//     byte 2 (BB): days-ago echo
//     bytes 3-5 (CC DD EE): year-of-century, month, day
//                           (e.g. 25 01 21 = 2025-01-21)
//
//   First reply — activity (AA=0x00):
//     bytes 6-8  (FF GG HH): total steps         (BIG-endian, 3 bytes)
//     bytes 9-10 (II JJ):    total kCal × 10     (BIG-endian, 2 bytes)
//     byte 11    (KK):       total standing hrs
//     bytes 12-14 (LL MM NN): total walking metres (BIG-endian, 3 bytes)
//
//   Second reply — sleep (AA=0x01):
//     bytes 6-7  (FF GG):  total sleep minutes  (BIG-endian, 2 bytes)
//     bytes 8-9  (HH II):  deep sleep minutes   (BIG-endian, 2 bytes)
//     bytes 10-11 (JJ KK): light sleep minutes  (BIG-endian, 2 bytes)
//     bytes 12-13 (LL MM): exercise minutes     (BIG-endian, 2 bytes)
//     byte 14    (NN):     reserved
//
//   All-zero payload for either side = "no data" (per protocol §4.3).
//
// D13 §3.1 listed commands 0x12 (activity) and 0x12/0x13 (sleep) — those
// bytes don't exist as commands in U16PRO; the actual command is 0x07
// returning both summaries. Same divergence pattern as the BP/HR notify
// fix in notify.ts (Sprint 7.5).
//
// TIMESTAMP NOTE: per-day vitals (sleep, activity) skip the watch-
// firmware-timestamp shift — the year/month/day fields are already
// user-local (D13 §3.5).

import { ParsedPacket, buildPacket } from '../io';
import { CommandTimeoutError, type UrionDevice } from '../UrionDevice';

// BLE_TRACE — Sprint 16.5a Phase A forensic-capture instrumentation.
// See apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;

function payloadHex(payload: Uint8Array): string {
  return Array.from(payload, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export interface ActivityDayRecord {
  daysAgo: number;
  yearOfCentury: number; // 25 = 2025
  month: number;         // 1-12
  day: number;           // 1-31
  totalSteps: number;
  totalKcal: number;     // already divided by 10
  totalStandingHours: number;
  totalDistanceMeters: number;
}

export interface SleepDayRecord {
  daysAgo: number;
  yearOfCentury: number;
  month: number;
  day: number;
  totalMinutes: number;
  deepMinutes: number;
  lightMinutes: number;
  exerciseMinutes: number;
}

export interface DayInfo {
  /** null when the activity packet is all-zero (no recorded data). */
  activity: ActivityDayRecord | null;
  /** null when the sleep packet is all-zero (no recorded data). */
  sleep: SleepDayRecord | null;
}

export interface ReadDayInfoOptions {
  /** 0 = today, 10 = 10 days ago. */
  daysAgo: number;
  timeoutMs?: number;
}

const ACTIVITY_INDEX = 0x00;
const SLEEP_INDEX = 0x01;

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 8) | bytes[offset + 1]) & 0xffff;
}

function readUint24BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]) >>>
    0
  );
}

/** True when every byte from `start` to `end` (exclusive) is zero. */
function allZero(bytes: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end; i++) if (bytes[i] !== 0) return false;
  return true;
}

/**
 * U16PRO date triplet is BCD: byte 0x25 reads as decimal 25, 0x21
 * reads as 21. Per the protocol example "25 01 21 = 2025-01-21".
 * Other multi-byte fields in the same packet (steps, kcal, etc.)
 * are raw integers — only the year/month/day bytes are BCD.
 */
function fromBcd(byte: number): number {
  return ((byte >> 4) & 0x0f) * 10 + (byte & 0x0f);
}

export function parseActivityPacket(
  packet: ParsedPacket,
): ActivityDayRecord | null {
  if (packet.command !== 0x07) return null;
  if (packet.payload[0] !== ACTIVITY_INDEX) return null;
  // Per protocol §4.3: all-zero payload = no data.
  // We treat all-zero payload bytes 1..14 (everything after the index)
  // as "no data" — covers both the date-not-set and date-set-but-empty
  // cases the brief calls out.
  if (allZero(packet.payload, 1, 14)) return null;
  return {
    daysAgo: packet.payload[1],
    yearOfCentury: fromBcd(packet.payload[2]),
    month: fromBcd(packet.payload[3]),
    day: fromBcd(packet.payload[4]),
    totalSteps: readUint24BE(packet.payload, 5),
    totalKcal: Math.floor(readUint16BE(packet.payload, 8) / 10),
    totalStandingHours: packet.payload[10],
    totalDistanceMeters: readUint24BE(packet.payload, 11),
  };
}

export function parseSleepPacket(packet: ParsedPacket): SleepDayRecord | null {
  if (packet.command !== 0x07) return null;
  if (packet.payload[0] !== SLEEP_INDEX) return null;
  if (allZero(packet.payload, 1, 14)) return null;
  return {
    daysAgo: packet.payload[1],
    yearOfCentury: fromBcd(packet.payload[2]),
    month: fromBcd(packet.payload[3]),
    day: fromBcd(packet.payload[4]),
    totalMinutes: readUint16BE(packet.payload, 5),
    deepMinutes: readUint16BE(packet.payload, 7),
    lightMinutes: readUint16BE(packet.payload, 9),
    exerciseMinutes: readUint16BE(packet.payload, 11),
  };
}

/**
 * Send one 0x07 request and await BOTH reply packets (activity + sleep)
 * before resolving. Rejects with CommandTimeoutError if either packet
 * fails to arrive within `timeoutMs`.
 *
 * Returns null for the activity or sleep slice if its packet payload
 * is all zero (no data for that day).
 */
export async function readDayInfo(
  device: UrionDevice,
  options: ReadDayInfoOptions,
): Promise<DayInfo> {
  const timeoutMs = options.timeoutMs ?? 10_000;

  const payload = new Uint8Array(14);
  payload[0] = options.daysAgo & 0xff;

  return new Promise<DayInfo>((resolve, reject) => {
    let activity: ActivityDayRecord | null = null;
    let sleep: SleepDayRecord | null = null;
    let activitySeen = false;
    let sleepSeen = false;
    let settled = false;

    const finish = (resolveFn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolveFn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new CommandTimeoutError(0x07, timeoutMs)));
    }, timeoutMs);

    const unsub = device.onNotify((packet: ParsedPacket) => {
      if (packet.command !== 0x07) return;
      const index = packet.payload[0];
      if (BLE_TRACE) {
        // Full payload dump — Phase A wants to see every byte so we can
        // spot regions we're not parsing (REM, awake counts, transitions).
        console.log(
          `[ble-trace] readDayInfo packet idx=0x${index.toString(16).padStart(2, '0')} ` +
            `daysAgo=${options.daysAgo} payload=${payloadHex(packet.payload)}`,
        );
      }
      if (index === ACTIVITY_INDEX && !activitySeen) {
        activitySeen = true;
        activity = parseActivityPacket(packet);
      } else if (index === SLEEP_INDEX && !sleepSeen) {
        sleepSeen = true;
        sleep = parseSleepPacket(packet);
      }
      if (activitySeen && sleepSeen) {
        finish(() => resolve({ activity, sleep }));
      }
    });

    void device.writePacket(buildPacket(0x07, payload)).catch((e) => {
      finish(() => reject(e));
    });
  });
}

// Re-exported helpers for tests.
export { readUint16BE, readUint24BE };
