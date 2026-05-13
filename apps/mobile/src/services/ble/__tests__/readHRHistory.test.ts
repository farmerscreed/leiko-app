/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { buildPacket, bytesToBase64 } from '../io';
import { readHRHistory } from '../commands/readHRHistory';
import { writeUint32LE } from '../commands/readBPHistory';

const { MockDevice } = bleMock;

function hrIndexPacket(totalPackets: number, intervalMinutes: number): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0x00;
  payload[1] = totalPackets;
  payload[2] = intervalMinutes;
  return buildPacket(0x15, payload);
}

function hrFirstDataPacket(dayStartSec: number, samples: number[]): Uint8Array {
  // SEQ=0x01, TS(4 LE) at payload[1..4], samples from payload[5..].
  const payload = new Uint8Array(14);
  payload[0] = 0x01;
  writeUint32LE(payload, 1, dayStartSec);
  for (let i = 0; i < samples.length && 5 + i < 14; i++) {
    payload[5 + i] = samples[i];
  }
  return buildPacket(0x15, payload);
}

function hrSubsequentDataPacket(seq: number, samples: number[]): Uint8Array {
  // SEQ>=0x02, samples from payload[1..].
  const payload = new Uint8Array(14);
  payload[0] = seq;
  for (let i = 0; i < samples.length && 1 + i < 14; i++) {
    payload[1 + i] = samples[i];
  }
  return buildPacket(0x15, payload);
}

function hrNoDataPacket(): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0xff;
  return buildPacket(0x15, payload);
}

describe('readHRHistory', () => {
  const dayStart = 0x67800000;

  it('parses index packet + single data packet (interval timing)', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    // 1 index packet + 1 data packet = total 2.
    const promise = readHRHistory(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(hrIndexPacket(2, 5))); // 5-min interval
    device.__pushNotify(
      bytesToBase64(
        hrFirstDataPacket(dayStart, [80, 82, 0, 78, 76, 0, 74, 72, 70]),
      ),
    );

    const { samples, intervalSec } = await promise;
    // bpm=0 placeholders dropped → 7 real samples kept.
    expect(samples).toHaveLength(7);
    expect(samples[0]).toEqual({ timestampSec: dayStart, bpm: 80 });
    expect(samples[1]).toEqual({ timestampSec: dayStart + 5 * 60, bpm: 82 });
    // sampleIndex 2 was bpm=0 (dropped) — index 3 lands at +3*5min.
    expect(samples[2]).toEqual({ timestampSec: dayStart + 3 * 5 * 60, bpm: 78 });
    // Sprint 16.5b — returned interval reflects the index packet.
    expect(intervalSec).toBe(5 * 60);
  });

  it('writes the request packet with the correct cmd + LE timestamp + zero payload', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readHRHistory(wrapper, { dayTimestampSec: 0x678eb5f3 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(hrNoDataPacket()));
    await promise;

    const writtenB64 = device.__writes[0];
    const decoded = Buffer.from(writtenB64, 'base64');
    expect(decoded[0]).toBe(0x15);
    expect(Array.from(decoded.slice(1, 5))).toEqual([0xf3, 0xb5, 0x8e, 0x67]);
    // Bytes 5..14 (last is CRC at 15) must be zero per the protocol.
    for (let i = 5; i < 15; i++) expect(decoded[i]).toBe(0);
  });

  it('returns empty array on the 0xFF no-data reply', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readHRHistory(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(hrNoDataPacket()));

    expect(await promise).toEqual({ samples: [], intervalSec: 0 });
  });

  it('resolves once all data packets indicated by the index packet have arrived', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    // total=3 → 1 index + 2 data packets.
    const promise = readHRHistory(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(hrIndexPacket(3, 5)));
    device.__pushNotify(
      bytesToBase64(
        hrFirstDataPacket(dayStart, [60, 61, 62, 63, 64, 65, 66, 67, 68]),
      ),
    );
    device.__pushNotify(
      bytesToBase64(hrSubsequentDataPacket(0x02, [70, 71, 72, 73, 74])),
    );

    const { samples, intervalSec } = await promise;
    expect(samples).toHaveLength(14); // 9 + 5
    expect(samples[0].bpm).toBe(60);
    expect(samples[8].bpm).toBe(68);
    expect(samples[9].bpm).toBe(70);
    // Continuous sample-index timing across packet boundaries.
    expect(samples[9].timestampSec).toBe(dayStart + 9 * 5 * 60);
    expect(samples[13].timestampSec).toBe(dayStart + 13 * 5 * 60);
    expect(intervalSec).toBe(5 * 60);
  });

  it('filters bpm=0 placeholders interleaved across packets (regression)', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    // total=3 with zeros sprinkled through both data packets.
    const promise = readHRHistory(wrapper, { dayTimestampSec: dayStart });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(hrIndexPacket(3, 10))); // 10-min interval
    device.__pushNotify(
      bytesToBase64(
        hrFirstDataPacket(dayStart, [0, 65, 0, 0, 70, 0, 0, 0, 75]),
      ),
    );
    device.__pushNotify(
      bytesToBase64(hrSubsequentDataPacket(0x02, [0, 80, 0, 0, 0])),
    );

    const { samples, intervalSec } = await promise;
    expect(samples.map((s) => s.bpm)).toEqual([65, 70, 75, 80]);
    // sampleIndex preserved through filtering: 65 is at index 1, 70 at 4,
    // 75 at 8, 80 at 9+1=10.
    expect(samples[0].timestampSec).toBe(dayStart + 1 * 10 * 60);
    expect(samples[1].timestampSec).toBe(dayStart + 4 * 10 * 60);
    expect(samples[2].timestampSec).toBe(dayStart + 8 * 10 * 60);
    expect(samples[3].timestampSec).toBe(dayStart + 10 * 10 * 60);
    expect(intervalSec).toBe(10 * 60);
  });
});
