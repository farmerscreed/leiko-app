/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import {
  buildPacket,
  bytesToBase64,
} from '../io';
import {
  parseBPReading,
  readBPHistory,
  readLatestBP,
  readUint32LE,
  writeUint32LE,
} from '../commands/readBPHistory';

const { MockDevice } = bleMock;

function bpResponse(tsSec: number, sys: number, dia: number, pulse: number): Uint8Array {
  const payload = new Uint8Array(14);
  writeUint32LE(payload, 0, tsSec);
  payload[4] = dia;
  payload[5] = sys;
  payload[6] = pulse;
  return buildPacket(0x14, payload);
}

function terminator(): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = 0xff; payload[1] = 0xff; payload[2] = 0xff; payload[3] = 0xff;
  return buildPacket(0x14, payload);
}

describe('writeUint32LE / readUint32LE', () => {
  it('round-trips the protocol example timestamp 0x678EB5F3', () => {
    const buf = new Uint8Array(4);
    writeUint32LE(buf, 0, 0x678eb5f3);
    expect(Array.from(buf)).toEqual([0xf3, 0xb5, 0x8e, 0x67]);
    expect(readUint32LE(buf, 0)).toBe(0x678eb5f3);
  });

  it('handles 0xFFFFFFFF terminator', () => {
    const buf = new Uint8Array(4);
    writeUint32LE(buf, 0, 0xffffffff);
    expect(readUint32LE(buf, 0)).toBe(0xffffffff);
  });
});

describe('parseBPReading', () => {
  it('parses the U16PRO §4.5 example (134/97 pulse 115)', () => {
    const pkt = { command: 0x14, payload: new Uint8Array(14) };
    pkt.payload.set([0xf3, 0xb5, 0x8e, 0x67, 0x61, 0x86, 0x73]);
    const r = parseBPReading(pkt);
    expect(r).toEqual({
      timestampSec: 0x678eb5f3,
      systolic: 134,
      diastolic: 97,
      pulse: 115,
    });
  });

  it('returns null for the 0xFFFFFFFF terminator', () => {
    const pkt = { command: 0x14, payload: new Uint8Array(14) };
    pkt.payload.set([0xff, 0xff, 0xff, 0xff]);
    expect(parseBPReading(pkt)).toBeNull();
  });

  it('rejects sub-protocol-floor values (defensive against firmware buffer flushes)', () => {
    const pkt = { command: 0x14, payload: new Uint8Array(14) };
    writeUint32LE(pkt.payload, 0, 1737385351);
    pkt.payload[4] = 0; pkt.payload[5] = 0; pkt.payload[6] = 0;
    expect(parseBPReading(pkt)).toBeNull();
  });

  it('returns null for non-0x14 packets', () => {
    expect(parseBPReading({ command: 0x73, payload: new Uint8Array(14) })).toBeNull();
  });
});

describe('readBPHistory', () => {
  it('streams reading packets until the terminator and returns parsed readings', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readBPHistory(wrapper, { count: 3 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(bpResponse(1737385351, 134, 97, 115)));
    device.__pushNotify(bytesToBase64(bpResponse(1737385111, 138, 91, 103)));
    device.__pushNotify(bytesToBase64(bpResponse(1737384999, 118, 92, 111)));
    device.__pushNotify(bytesToBase64(terminator()));

    const readings = await promise;
    expect(readings).toHaveLength(3);
    expect(readings[0]).toMatchObject({ systolic: 134, diastolic: 97, pulse: 115 });
    expect(readings[2]).toMatchObject({ systolic: 118, diastolic: 92, pulse: 111 });
  });

  it('writes the request packet with the correct LE timestamp + DIR + COUNT', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readBPHistory(wrapper, {
      sinceTimestampSec: 0x678eb5f3,
      direction: 'oldest_first',
      count: 50,
    });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(terminator()));
    await promise;

    const writtenB64 = device.__writes[0];
    const decoded = Buffer.from(writtenB64, 'base64');
    expect(decoded[0]).toBe(0x14);
    expect(Array.from(decoded.slice(1, 5))).toEqual([0xf3, 0xb5, 0x8e, 0x67]);
    expect(decoded[5]).toBe(1); // oldest_first
    expect(decoded[6]).toBe(50);
  });

  it('returns an empty array when the watch has no readings', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = readBPHistory(wrapper);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(terminator()));
    expect(await promise).toEqual([]);
  });

  // Regression: per U16PRO_protocol_en.pdf §4.5, the watch sends the
  // terminator ONLY when it ran out of records before the requested
  // count. If the watch has ≥count records, it sends count packets
  // and goes silent. We must early-resolve on count rather than
  // waiting for a terminator that will never come (real-device
  // failure 2026-05-06: 0x14 timed out after 10s when count=1 and
  // the watch had data).
  it('resolves as soon as count packets are received (no terminator from the watch)', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = readBPHistory(wrapper, { count: 1 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(bpResponse(1737385351, 124, 79, 68)));
    // No terminator pushed — emulates the real-device behaviour.
    const readings = await promise;
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ systolic: 124, diastolic: 79, pulse: 68 });
  });
});

describe('readLatestBP', () => {
  it('returns the first reading, or null if none', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = readLatestBP(wrapper);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(bpResponse(1737385351, 124, 79, 68)));
    device.__pushNotify(bytesToBase64(terminator()));
    const r = await promise;
    expect(r).toMatchObject({ systolic: 124, diastolic: 79, pulse: 68 });
  });
});
