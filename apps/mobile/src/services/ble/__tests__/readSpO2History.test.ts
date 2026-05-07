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

function spo2FirstDataPacket(dayStartSec: number, pairs: Array<[number, number]>): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0x01;
  writeUint32LE(payload, 1, dayStartSec);
  // Pairs from payload[5] onward, each pair = (max, min).
  let off = 5;
  for (const [max, min] of pairs) {
    if (off + 1 >= 14) break;
    payload[off] = max;
    payload[off + 1] = min;
    off += 2;
  }
  return buildPacket(0x2d, payload);
}

function spo2SubsequentDataPacket(seq: number, pairs: Array<[number, number]>): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = seq;
  let off = 1;
  for (const [max, min] of pairs) {
    if (off + 1 >= 14) break;
    payload[off] = max;
    payload[off + 1] = min;
    off += 2;
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

  it('parses index + first data packet, computing percent as (max+min)/2', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    // total=2 → 1 index + 1 data packet. 60-min interval.
    const promise = readSpO2History(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(spo2IndexPacket(2, 60)));
    device.__pushNotify(
      bytesToBase64(
        spo2FirstDataPacket(dayStart, [
          [99, 97], // 98
          [98, 96], // 97
          [0, 0],   // dropped
          [95, 91], // 93
        ]),
      ),
    );

    const samples: SpO2HistorySample[] = await promise;
    expect(samples).toHaveLength(3);
    expect(samples[0]).toEqual({
      timestampSec: dayStart,
      percent: 98,
      maxInWindow: 99,
      minInWindow: 97,
    });
    expect(samples[1]).toEqual({
      timestampSec: dayStart + 60 * 60,
      percent: 97,
      maxInWindow: 98,
      minInWindow: 96,
    });
    // pair index 2 was the (0,0) placeholder → dropped, so samples[2]
    // corresponds to pair index 3.
    expect(samples[2]).toEqual({
      timestampSec: dayStart + 3 * 60 * 60,
      percent: 93,
      maxInWindow: 95,
      minInWindow: 91,
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
      bytesToBase64(
        spo2FirstDataPacket(dayStart, [
          [99, 97],
          [98, 96],
          [97, 95],
          [96, 94],
        ]),
      ),
    );
    device.__pushNotify(
      bytesToBase64(
        spo2SubsequentDataPacket(0x02, [
          [95, 93],
          [94, 92],
        ]),
      ),
    );

    const samples = await promise;
    expect(samples).toHaveLength(6);
    expect(samples[3].percent).toBe(95);
    expect(samples[4].percent).toBe(94);
    // Pair index continues across packets: pair 4 → +4h offset.
    expect(samples[4].timestampSec).toBe(dayStart + 4 * 60 * 60);
    expect(samples[5].timestampSec).toBe(dayStart + 5 * 60 * 60);
  });
});
