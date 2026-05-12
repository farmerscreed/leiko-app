// 0x15 — Read heart-rate history for a single day. Per
// docs/_reference/U16PRO_protocol_en.pdf §4.6.
//
// Request:  0x15 TS(4 LE) 00×10 CRC
//   TS = day-anchor timestamp (Unix sec). Watch returns the day's
//        HR data corresponding to that timestamp.
//
// Response: index packet + N data packets.
//   Index packet:  0x15 0x00 BB CC 00×11 CRC
//     BB = total package count INCLUDING the index packet
//     CC = sample interval in minutes (e.g. 0x05 = 5min)
//   Data packet (SEQ=0x01): 0x15 0x01 TS(4 LE) HR0 HR1 ... HR8 CRC
//     First data packet carries the day-start TS in bytes 2..5 (LE),
//     samples start at byte 6 (up to 9 samples per packet).
//   Data packet (SEQ>=0x02): 0x15 SEQ HR0 HR1 ... HR12 CRC
//     Subsequent packets have no timestamp; samples start at byte 2
//     (up to 13 samples per packet).
//   No-data reply:  0x15 0xFF 00×13 CRC  → empty result.
//
// Per-sample timestamps are derived: sample i is at
//   day-start TS + i * intervalMinutes * 60.
// Wrapper returns RAW watch-firmware seconds (pre-shift); the sync
// layer applies watchTimestampToUtcSec. See comment in
// services/sync/syncBacklog.ts.
//
// HR samples with bpm=0 are no-sample placeholders and filtered out.

import { ParsedPacket, buildPacket } from '../io';
import { CommandTimeoutError, type UrionDevice } from '../UrionDevice';
import { readUint32LE, writeUint32LE } from './readBPHistory';

// BLE_TRACE — Sprint 16.5a Phase A forensic-capture instrumentation.
// See apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;

export interface HRHistorySample {
  /** RAW watch-firmware seconds (pre-firmware-shift). */
  timestampSec: number;
  /** 1..220 valid; 0 placeholders are filtered out before return. */
  bpm: number;
}

export interface ReadHRHistoryOptions {
  dayTimestampSec: number;
  timeoutMs?: number;
  /** Override the index-packet's package count. Useful if a caller
   *  already knows the expected total (e.g. replaying a fixture). */
  expectedTotalPackets?: number;
}

const HR_NO_DATA_MARKER = 0xff;

export async function readHRHistory(
  device: UrionDevice,
  options: ReadHRHistoryOptions,
): Promise<HRHistorySample[]> {
  const timeoutMs = options.timeoutMs ?? 10_000;

  const payload = new Uint8Array(14);
  writeUint32LE(payload, 0, options.dayTimestampSec);

  return new Promise<HRHistorySample[]>((resolve, reject) => {
    const samples: HRHistorySample[] = [];
    let dayStartSec: number | null = null;
    let intervalSec = 0;
    let totalPackets = options.expectedTotalPackets ?? 0;
    let dataPacketsSeen = 0;
    let sampleIndex = 0;
    let settled = false;

    const finish = (resolveFn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolveFn();
    };
    const timer = setTimeout(() => {
      finish(() => reject(new CommandTimeoutError(0x15, timeoutMs)));
    }, timeoutMs);

    const unsub = device.onNotify((packet: ParsedPacket) => {
      if (packet.command !== 0x15) return;
      const seq = packet.payload[0];

      if (seq === HR_NO_DATA_MARKER) {
        finish(() => resolve([]));
        return;
      }

      if (seq === 0x00) {
        // Index packet.
        totalPackets = packet.payload[1];
        const intervalMinutes = packet.payload[2];
        intervalSec = intervalMinutes * 60;
        if (BLE_TRACE) {
          console.log(
            `[ble-trace] readHRHistory index totalPackets=${totalPackets} ` +
              `intervalMinutes=${intervalMinutes} (assumed 30 in slice config)`,
          );
        }
        if (totalPackets <= 1) {
          // Index packet only — no samples to follow.
          finish(() => resolve([]));
        }
        return;
      }

      // Data packet.
      let offset: number;
      if (seq === 0x01) {
        dayStartSec = readUint32LE(packet.payload, 1);
        offset = 5;
      } else {
        offset = 1;
      }

      const baseSec = dayStartSec ?? options.dayTimestampSec;
      for (let i = offset; i < packet.payload.length; i++) {
        const bpm = packet.payload[i];
        const ts = baseSec + sampleIndex * intervalSec;
        sampleIndex++;
        if (bpm === 0) continue;
        samples.push({ timestampSec: ts, bpm });
      }

      dataPacketsSeen++;
      // The index packet counts as packet 0; data packets fill 1..total-1.
      if (totalPackets > 0 && dataPacketsSeen >= totalPackets - 1) {
        finish(() => resolve(samples));
      }
    });

    void device.writePacket(buildPacket(0x15, payload)).catch((e) => {
      finish(() => reject(e));
    });
  });
}
