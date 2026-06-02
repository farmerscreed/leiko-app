// 0x14 — Read blood pressure measurement history. Per
// docs/_reference/U16PRO_protocol_en.pdf §4.5.
//
// Request:  0x14 TS(4 LE) DIR COUNT 00×8 CRC
//   TS    = timestamp anchor (Unix seconds, little-endian); 0 = no anchor
//   DIR   = 0: backtrack from TS to history (returns latest COUNT records)
//           1: backtrack from latest stopping at TS (returns latest COUNT)
//   COUNT = max records per call (vendor recommends ≤ 50)
// When TS = 0, DIR is ignored — the watch returns the latest COUNT records.
//
// Response (one packet per reading):
//   0x14 TS(4 LE) DIA SYS PUL 00×6 CRC
// Terminator (no more data):
//   0x14 0xFF 0xFF 0xFF 0xFF 00×10 CRC
//
// TIMESTAMP CAVEAT (per protocol §4.5.5): reading timestamps are stored
// against the watch's local clock, which we set via 0x01 setTime to the
// phone's local time. They are NOT UTC. The protocol explicitly notes
// the firmware originally treated time as UTC+8, so the raw
// interpretation may be off by 8 hours unless 0x01 has been issued
// since pairing — which we do, on every successful reconnect, per
// docs/06-ble-protocol.md §4. Until Sprint 7's sync layer reconciles
// the parent's IANA timezone server-side, we treat timestamps as
// "phone-local-clock seconds" and store them as-is in measured_at.

import { ParsedPacket, buildPacket, expectByte0 } from '../io';
import { CommandTimeoutError, type UrionDevice } from '../UrionDevice';

// BLE_TRACE — Sprint 16.5a Phase A forensic-capture instrumentation.
// See apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;

export interface BPReading {
  /** Watch-local-time seconds since epoch. See file header for the caveat. */
  timestampSec: number;
  systolic: number;
  diastolic: number;
  pulse: number;
}

export type ReadBPDirection = 'newest_first' | 'oldest_first';

export interface ReadBPOptions {
  sinceTimestampSec?: number;
  direction?: ReadBPDirection;
  count?: number;
  timeoutMs?: number;
}

const TERMINATOR_TS = 0xffffffff;

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function writeUint32LE(out: Uint8Array, offset: number, value: number): void {
  out[offset] = value & 0xff;
  out[offset + 1] = (value >>> 8) & 0xff;
  out[offset + 2] = (value >>> 16) & 0xff;
  out[offset + 3] = (value >>> 24) & 0xff;
}

function isTerminatorPacket(p: ParsedPacket): boolean {
  return p.command === 0x14 && readUint32LE(p.payload, 0) === TERMINATOR_TS;
}

export function parseBPReading(packet: ParsedPacket): BPReading | null {
  if (packet.command !== 0x14) return null;
  const ts = readUint32LE(packet.payload, 0);
  if (ts === TERMINATOR_TS) return null;
  const diastolic = packet.payload[4];
  const systolic = packet.payload[5];
  const pulse = packet.payload[6];
  // Sprint 16.5b — diagnostic trace for the value-mismatch investigation.
  // Watch face showed 133/80, app stored 160/93 p88 on 2026-05-13 cycle.
  // Log the FULL relevant payload bytes (timestamp 0..3, dia 4, sys 5,
  // pulse 6, plus the next few bytes in case the protocol's byte order
  // differs from D7 §4.5's documented shape on this firmware version).
  if (BLE_TRACE) {
    const p = packet.payload;
    const hex = (n: number) => (n & 0xff).toString(16).padStart(2, '0');
    console.log(
      `[ble-trace] parseBPReading ts=${ts} ` +
        `bytes[0..7]=${hex(p[0] ?? 0)} ${hex(p[1] ?? 0)} ${hex(p[2] ?? 0)} ${hex(p[3] ?? 0)} ` +
        `${hex(p[4] ?? 0)} ${hex(p[5] ?? 0)} ${hex(p[6] ?? 0)} ${hex(p[7] ?? 0)} ` +
        `decoded: dia=${diastolic} sys=${systolic} pulse=${pulse}`,
    );
  }
  // Defensive: the firmware can emit zero rows during a buffer flush.
  // Treat anything below the protocol's plausible BP floor as junk.
  if (systolic < 30 || diastolic < 20) return null;
  return { timestampSec: ts, systolic, diastolic, pulse };
}

/**
 * Fetch up to `count` BP readings from the watch. Defaults to the
 * latest reading (count=1, sinceTimestampSec=0).
 *
 * Resolves when EITHER:
 *   • the watch sends the 0xFFFFFFFF terminator (only fires when the
 *     watch has fewer records than requested), OR
 *   • we've collected `count` reading packets (watch has ≥count records,
 *     in which case the protocol does NOT send a terminator — confirmed
 *     by U16PRO_protocol_en.pdf §4.5 "If 3 records are requested but
 *     only 1 record exists ... and end the transmission").
 *
 * Returns readings in the order the watch sent them. The terminator
 * packet is consumed but not returned. Throws CommandTimeoutError if
 * neither condition fires within `timeoutMs`.
 */
export async function readBPHistory(
  device: UrionDevice,
  options: ReadBPOptions = {},
): Promise<BPReading[]> {
  const since = options.sinceTimestampSec ?? 0;
  const count = options.count ?? 1;
  const dir = options.direction === 'oldest_first' ? 1 : 0;
  const timeoutMs = options.timeoutMs ?? 10_000;

  const payload = new Uint8Array(14);
  writeUint32LE(payload, 0, since);
  payload[4] = dir;
  payload[5] = count;

  const readings: BPReading[] = [];
  const collected = await new Promise<BPReading[]>((resolve, reject) => {
    let settled = false;
    const finish = (resolveFn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolveFn();
    };
    const timer = setTimeout(() => {
      finish(() =>
        reject(new CommandTimeoutError(0x14, timeoutMs)),
      );
    }, timeoutMs);
    const unsub = device.onNotify((packet) => {
      if (packet.command !== 0x14) return;
      if (isTerminatorPacket(packet)) {
        finish(() => resolve(readings));
        return;
      }
      const parsed = parseBPReading(packet);
      if (parsed) readings.push(parsed);
      if (readings.length >= count) {
        finish(() => resolve(readings));
      }
    });
    void device.writePacket(buildPacket(0x14, payload)).catch((e) => {
      finish(() => reject(e));
    });
  });
  return collected;
}

/** Convenience for the take-reading flow — fetches the single latest reading. */
export async function readLatestBP(
  device: UrionDevice,
  timeoutMs = 10_000,
): Promise<BPReading | null> {
  const readings = await readBPHistory(device, { count: 1, timeoutMs });
  return readings[0] ?? null;
}

// Re-exported helpers for tests.
export { readUint32LE, writeUint32LE, expectByte0 };
