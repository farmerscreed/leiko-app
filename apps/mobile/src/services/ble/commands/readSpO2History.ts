// 0x2D — Read SpO2 history for a single day. Per
// docs/_reference/U16PRO_protocol_en.pdf §4.11.
//
// Request:  0x2D TS(4 LE) 00×10 CRC  (standard 16-byte packet shape)
//
// Response: index packet + N data packets.
//   Index packet:  0x2D 0x00 BB CC 00×11 CRC
//     BB = total package count INCLUDING the index packet
//     CC = sample interval in minutes (e.g. 0x3C = 60min)
//   Data packet (SEQ=0x01): 0x2D 0x01 TS(4 LE) MAX0 MIN0 MAX1 MIN1 ... CRC
//     First data packet carries the day-start TS in bytes 2..5 (LE),
//     then alternating max/min SpO2 byte pairs from byte 6.
//   Data packet (SEQ>=0x02): 0x2D SEQ MAX0 MIN0 MAX1 MIN1 ... CRC
//     No timestamp; max/min pairs from byte 2.
//   No-data reply:  0x2D 0xFF 00×13 CRC → empty result.
//
// Each (max,min) pair represents one sample at the matching interval
// offset (sample i at day-start TS + i * interval * 60). Pairs where
// BOTH bytes are zero are no-sample placeholders and filtered out.
//
// percent = average of max+min for the window. The watch does not
// emit a separate average; D13 §2.3 specifies caller treats this as
// the canonical `percent` for rendering and validators.
//
// Wrapper returns RAW watch-firmware seconds (pre-shift); the sync
// layer applies watchTimestampToUtcSec.

import { ParsedPacket, buildPacket } from '../io';
import { CommandTimeoutError, type UrionDevice } from '../UrionDevice';
import { readUint32LE, writeUint32LE } from './readBPHistory';

// BLE_TRACE — Sprint 16.5a Phase A forensic-capture instrumentation.
// See apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;

export interface SpO2HistorySample {
  /** RAW watch-firmware seconds (pre-firmware-shift). */
  timestampSec: number;
  /** Average for the interval — (max+min)/2, rounded. */
  percent: number;
  maxInWindow: number;
  minInWindow: number;
}

export interface ReadSpO2HistoryOptions {
  dayTimestampSec: number;
  timeoutMs?: number;
}

const SPO2_NO_DATA_MARKER = 0xff;

export async function readSpO2History(
  device: UrionDevice,
  options: ReadSpO2HistoryOptions,
): Promise<SpO2HistorySample[]> {
  const timeoutMs = options.timeoutMs ?? 10_000;

  const payload = new Uint8Array(14);
  writeUint32LE(payload, 0, options.dayTimestampSec);

  return new Promise<SpO2HistorySample[]>((resolve, reject) => {
    const samples: SpO2HistorySample[] = [];
    let dayStartSec: number | null = null;
    let intervalSec = 0;
    let totalPackets = 0;
    let dataPacketsSeen = 0;
    let pairIndex = 0;
    let settled = false;

    const finish = (resolveFn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolveFn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new CommandTimeoutError(0x2d, timeoutMs)));
    }, timeoutMs);

    const unsub = device.onNotify((packet: ParsedPacket) => {
      if (packet.command !== 0x2d) return;
      const seq = packet.payload[0];

      if (seq === SPO2_NO_DATA_MARKER) {
        finish(() => resolve([]));
        return;
      }

      if (seq === 0x00) {
        totalPackets = packet.payload[1];
        const intervalMinutes = packet.payload[2];
        intervalSec = intervalMinutes * 60;
        if (BLE_TRACE) {
          console.log(
            `[ble-trace] readSpO2History index totalPackets=${totalPackets} ` +
              `intervalMinutes=${intervalMinutes} (assumed 60 in slice config)`,
          );
        }
        if (totalPackets <= 1) {
          finish(() => resolve([]));
        }
        return;
      }

      let offset: number;
      if (seq === 0x01) {
        dayStartSec = readUint32LE(packet.payload, 1);
        offset = 5;
      } else {
        offset = 1;
      }

      const baseSec = dayStartSec ?? options.dayTimestampSec;
      // Sprint 16.5c byte-level trace for the SpO2 pair-decoding
      // investigation. Watch sends 16 hourly slots per day yet only 9
      // pass the parser; this trace dumps every pair so we can verify
      // whether the protocol's claimed (max, min) order actually matches
      // the firmware. Remove once the daytime-samples gap is resolved.
      if (BLE_TRACE) {
        const hex = (n: number) => (n & 0xff).toString(16).padStart(2, '0');
        const bytes: string[] = [];
        for (let j = 0; j < packet.payload.length; j++) {
          bytes.push(hex(packet.payload[j] ?? 0));
        }
        console.log(
          `[ble-trace] readSpO2History seq=${packet.payload[0]?.toString(16)} ` +
            `full_payload=${bytes.join(' ')}`,
        );
      }
      // Sprint 16.5c — each data byte is a SINGLE SpO2 sample.
      //
      // The U16PRO_protocol_en.pdf §4.11 documentation describes
      // `(max, min)` BYTE PAIRS, with worked-example annotations like
      // "FF=0x63:0 Maximum blood oxygen value of 99, GG=0x62:0
      // Minimum blood oxygen value of 98". But the U19M_013C firmware
      // actually streams single-byte hourly readings — every other
      // byte is the next hour, not a (max, min) partner.
      //
      // Empirical proof from a 2026-05-13 bench trace: packet
      // `02 61 62 62 63 61 61 63 62 61 00 00 00 00` (seq=2, 13 data
      // bytes), interpreted as pairs, yields (97,98)(98,99)(97,97)
      // (99,98)(97,0) — the first two pairs have "max" < "min" which
      // is impossible. Interpreted as singles, yields 97,98,98,99,97,
      // 97,99,98,97,0,0,0,0 — 9 valid hourly readings then padding,
      // exactly matching the watch face's chart for that day window.
      // Pair interpretation surfaced 9 samples for a 17-hour day;
      // singles surface 18. The watch face shows ~hourly markers,
      // which lines up with the single-byte interpretation.
      //
      // We iterate one byte at a time. Each non-zero byte is the
      // hour's SpO2 reading; advance `sampleIndex` per byte.
      // `maxInWindow` / `minInWindow` are kept on the type for the
      // server schema but both receive the single reading.
      for (let i = offset; i < packet.payload.length; i++) {
        const reading = packet.payload[i];
        if (BLE_TRACE && reading !== 0) {
          console.log(
            `[ble-trace] readSpO2History sample idx=${pairIndex} payload[${i}]=${reading}`,
          );
        }
        const ts = baseSec + pairIndex * intervalSec;
        pairIndex++;
        if (reading === 0) continue;
        if (reading < 70 || reading > 100) continue;
        samples.push({
          timestampSec: ts,
          percent: reading,
          maxInWindow: reading,
          minInWindow: reading,
        });
      }

      dataPacketsSeen++;
      if (totalPackets > 0 && dataPacketsSeen >= totalPackets - 1) {
        finish(() => resolve(samples));
      }
    });

    void device.writePacket(buildPacket(0x2d, payload)).catch((e) => {
      finish(() => reject(e));
    });
  });
}
