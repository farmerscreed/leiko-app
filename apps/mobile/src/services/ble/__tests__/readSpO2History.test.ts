/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { buildPacket, bytesToBase64 } from '../io';
import {
  readSpO2History,
  type SpO2HistorySample,
} from '../commands/readSpO2History';
import { writeUint32LE } from '../commands/readBPHistory';

const { MockDevice } = bleMock;

function spo2IndexPacket(totalPackets: number, intervalMinutes: number): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0x00;
  payload[1] = totalPackets;
  payload[2] = intervalMinutes;
  return buildPacket(0x2d, payload);
}

// Sprint 16.5c — the U19M firmware streams SINGLE-BYTE hourly SpO2
// readings (one byte = one hour), not (max,min) byte pairs as the
// U16PRO PDF suggested. The parser decodes accordingly, so these
// helpers write one byte per sample. A zero byte is a no-sample
// placeholder (dropped) but STILL advances the hour index; bytes out of
// the 70–100 range are dropped too.
function spo2FirstDataPacket(dayStartSec: number, readings: number[]): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0x01;
  writeUint32LE(payload, 1, dayStartSec);
  let off = 5;
  for (const reading of readings) {
    if (off >= 14) break;
    payload[off] = reading;
    off += 1;
  }
  return buildPacket(0x2d, payload);
}

function spo2SubsequentDataPacket(seq: number, readings: number[]): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = seq;
  let off = 1;
  for (const reading of readings) {
    if (off >= 14) break;
    payload[off] = reading;
    off += 1;
  }
  return buildPacket(0x2d, payload);
}

function spo2NoDataPacket(): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0xff;
  return buildPacket(0x2d, payload);
}

describe('readSpO2History', () => {
  const dayStart = 0x67800000;

  it('parses index + first data packet as single-byte hourly readings', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    // total=2 → 1 index + 1 data packet. 60-min interval.
    const promise = readSpO2History(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(spo2IndexPacket(2, 60)));
    device.__pushNotify(
      bytesToBase64(
        // hour 0 = 98, hour 1 = 97, hour 2 = 0 (dropped placeholder,
        // index still advances), hour 3 = 93.
        spo2FirstDataPacket(dayStart, [98, 97, 0, 93]),
      ),
    );

    const samples: SpO2HistorySample[] = await promise;
    expect(samples).toHaveLength(3);
    expect(samples[0]).toEqual({
      timestampSec: dayStart,
      percent: 98,
      maxInWindow: 98,
      minInWindow: 98,
    });
    expect(samples[1]).toEqual({
      timestampSec: dayStart + 60 * 60,
      percent: 97,
      maxInWindow: 97,
      minInWindow: 97,
    });
    // hour 2 was the 0 placeholder → dropped, so samples[2] is hour 3.
    expect(samples[2]).toEqual({
      timestampSec: dayStart + 3 * 60 * 60,
      percent: 93,
      maxInWindow: 93,
      minInWindow: 93,
    });
  });

  it('writes the request packet with the correct cmd + LE timestamp + zero payload', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readSpO2History(wrapper, { dayTimestampSec: 0x678eb5f3 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(spo2NoDataPacket()));
    await promise;

    const writtenB64 = device.__writes[0];
    const decoded = Buffer.from(writtenB64, 'base64');
    expect(decoded[0]).toBe(0x2d);
    expect(Array.from(decoded.slice(1, 5))).toEqual([0xf3, 0xb5, 0x8e, 0x67]);
    for (let i = 5; i < 15; i++) expect(decoded[i]).toBe(0);
  });

  it('returns empty array on the 0xFF no-data reply', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readSpO2History(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(spo2NoDataPacket()));

    expect(await promise).toEqual([]);
  });

  it('resolves only once all data packets implied by the index have arrived', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    // total=3 → 1 index + 2 data packets.
    const promise = readSpO2History(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(spo2IndexPacket(3, 60)));
    device.__pushNotify(
      // hours 0–3 = 99, 98, 97, 96
      bytesToBase64(spo2FirstDataPacket(dayStart, [99, 98, 97, 96])),
    );
    device.__pushNotify(
      // hours 4–5 = 95, 94
      bytesToBase64(spo2SubsequentDataPacket(0x02, [95, 94])),
    );

    const samples = await promise;
    expect(samples).toHaveLength(6);
    expect(samples[3].percent).toBe(96);
    expect(samples[4].percent).toBe(95);
    // The hour index spans EVERY byte of each packet, including the
    // trailing zero padding. Packet 1 carries 9 data bytes (payload
    // 5..13): hours 0–3 are 99/98/97/96, hours 4–8 are zero padding
    // (dropped but counted). Packet 2's bytes are hours 9 and 10, so
    // sample 4 (95) lands at +9h and sample 5 (94) at +10h.
    expect(samples[4].timestampSec).toBe(dayStart + 9 * 60 * 60);
    expect(samples[5].timestampSec).toBe(dayStart + 10 * 60 * 60);
  });
});
