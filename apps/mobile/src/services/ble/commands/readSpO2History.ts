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
      // Each pair is (max, min). Stop one short of the end so we
      // always read a full pair.
      for (let i = offset; i + 1 < packet.payload.length; i += 2) {
        const max = packet.payload[i];
        const min = packet.payload[i + 1];
        const ts = baseSec + pairIndex * intervalSec;
        pairIndex++;
        if (max === 0 && min === 0) continue;
        const percent = Math.round((max + min) / 2);
        samples.push({
          timestampSec: ts,
          percent,
          maxInWindow: max,
          minInWindow: min,
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
