/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { CommandTimeoutError } from '../UrionDevice';
import { buildPacket, bytesToBase64 } from '../io';
import {
  parseActivityPacket,
  parseSleepPacket,
  readDayInfo,
  readUint16BE,
  readUint24BE,
} from '../commands/readDayInfo';

const { MockDevice } = bleMock;

// PDF §4.3 example bytes (payload only, 14 bytes — buildPacket adds the
// 0x07 command byte and CRC).
//   07 00 00 25 01 21 00 00 59 0C 2B 00 00 00 00 DE
//   07 01 00 25 01 21 01 D5 00 6D 01 56 00 03 00 EC
const ACTIVITY_PDF_EXAMPLE = Uint8Array.from([
  0x00, 0x00, 0x25, 0x01, 0x21,
  0x00, 0x00, 0x59,
  0x0c, 0x2b,
  0x00,
  0x00, 0x00, 0x00,
]);

const SLEEP_PDF_EXAMPLE = Uint8Array.from([
  0x01, 0x00, 0x25, 0x01, 0x21,
  0x01, 0xd5,
  0x00, 0x6d,
  0x01, 0x56,
  0x00, 0x03,
  0x00,
]);

function activityPacket(payload: Uint8Array): Uint8Array {
  return buildPacket(0x07, payload);
}

function sleepPacket(payload: Uint8Array): Uint8Array {
  return buildPacket(0x07, payload);
}

describe('readUint16BE / readUint24BE', () => {
  it('parses big-endian 2-byte integers', () => {
    expect(readUint16BE(Uint8Array.from([0x01, 0xd5]), 0)).toBe(469);
    expect(readUint16BE(Uint8Array.from([0x0c, 0x2b]), 0)).toBe(0x0c2b);
  });

  it('parses big-endian 3-byte integers', () => {
    expect(readUint24BE(Uint8Array.from([0x00, 0x00, 0x59]), 0)).toBe(89);
    expect(readUint24BE(Uint8Array.from([0xff, 0xff, 0xff]), 0)).toBe(0xffffff);
  });
});

describe('parseActivityPacket', () => {
  it('parses the U16PRO §4.3 example (steps=89, kcal=311)', () => {
    const r = parseActivityPacket({ command: 0x07, payload: ACTIVITY_PDF_EXAMPLE });
    expect(r).toEqual({
      daysAgo: 0,
      yearOfCentury: 25,
      month: 1,
      day: 21,
      totalSteps: 89,
      totalKcal: 311, // 0x0C2B = 3115; 3115 / 10 = 311
      totalStandingHours: 0,
      totalDistanceMeters: 0,
    });
  });

  it('returns null when the activity payload (excluding the index byte) is all zero', () => {
    const payload = new Uint8Array(14);
    // index stays at 0x00; everything else zero
    expect(parseActivityPacket({ command: 0x07, payload })).toBeNull();
  });

  it('returns null for a sleep-index packet (AA=0x01)', () => {
    const r = parseActivityPacket({ command: 0x07, payload: SLEEP_PDF_EXAMPLE });
    expect(r).toBeNull();
  });

  it('returns null for non-0x07 packets', () => {
    expect(
      parseActivityPacket({ command: 0x14, payload: ACTIVITY_PDF_EXAMPLE }),
    ).toBeNull();
  });
});

describe('parseSleepPacket', () => {
  it('parses the U16PRO §4.3 example (total=469, deep=109, light=342, exercise=3)', () => {
    const r = parseSleepPacket({ command: 0x07, payload: SLEEP_PDF_EXAMPLE });
    expect(r).toEqual({
      daysAgo: 0,
      yearOfCentury: 25,
      month: 1,
      day: 21,
      totalMinutes: 469, // 0x01D5
      deepMinutes: 109,  // 0x006D
      lightMinutes: 342, // 0x0156
      exerciseMinutes: 3, // 0x0003
    });
  });

  it('returns null when the sleep payload (excluding the index byte) is all zero', () => {
    const payload = new Uint8Array(14);
    payload[0] = 0x01; // sleep index, otherwise zero
    expect(parseSleepPacket({ command: 0x07, payload })).toBeNull();
  });

  it('returns null for an activity-index packet (AA=0x00)', () => {
    expect(
      parseSleepPacket({ command: 0x07, payload: ACTIVITY_PDF_EXAMPLE }),
    ).toBeNull();
  });
});

describe('readDayInfo', () => {
  it('writes a 0x07 request with the days-ago byte', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readDayInfo(wrapper, { daysAgo: 3 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(activityPacket(ACTIVITY_PDF_EXAMPLE)));
    device.__pushNotify(bytesToBase64(sleepPacket(SLEEP_PDF_EXAMPLE)));
    await promise;

    const writtenB64 = device.__writes[0];
    const decoded = Buffer.from(writtenB64, 'base64');
    expect(decoded[0]).toBe(0x07);
    expect(decoded[1]).toBe(0x03);
    // bytes 2..14 should be zero padding
    for (let i = 2; i < 15; i++) expect(decoded[i]).toBe(0);
  });

  it('resolves with both activity and sleep when both packets arrive', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readDayInfo(wrapper, { daysAgo: 0 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(activityPacket(ACTIVITY_PDF_EXAMPLE)));
    device.__pushNotify(bytesToBase64(sleepPacket(SLEEP_PDF_EXAMPLE)));

    const result = await promise;
    expect(result.activity).toMatchObject({
      daysAgo: 0,
      yearOfCentury: 25,
      month: 1,
      day: 21,
      totalSteps: 89,
      totalKcal: 311,
    });
    expect(result.sleep).toMatchObject({
      totalMinutes: 469,
      deepMinutes: 109,
      lightMinutes: 342,
      exerciseMinutes: 3,
    });
  });

  it('tolerates the sleep packet arriving before the activity packet', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readDayInfo(wrapper, { daysAgo: 0 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(sleepPacket(SLEEP_PDF_EXAMPLE)));
    device.__pushNotify(bytesToBase64(activityPacket(ACTIVITY_PDF_EXAMPLE)));

    const result = await promise;
    expect(result.activity?.totalSteps).toBe(89);
    expect(result.sleep?.totalMinutes).toBe(469);
  });

  it('returns activity:null when the activity packet is all-zero', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const emptyActivity = new Uint8Array(14); // index 0, all zero
    const promise = readDayInfo(wrapper, { daysAgo: 0 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(activityPacket(emptyActivity)));
    device.__pushNotify(bytesToBase64(sleepPacket(SLEEP_PDF_EXAMPLE)));

    const result = await promise;
    expect(result.activity).toBeNull();
    expect(result.sleep?.totalMinutes).toBe(469);
  });

  it('returns sleep:null when the sleep packet is all-zero', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const emptySleep = new Uint8Array(14);
    emptySleep[0] = 0x01; // sleep index, rest zero
    const promise = readDayInfo(wrapper, { daysAgo: 0 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(activityPacket(ACTIVITY_PDF_EXAMPLE)));
    device.__pushNotify(bytesToBase64(sleepPacket(emptySleep)));

    const result = await promise;
    expect(result.activity?.totalSteps).toBe(89);
    expect(result.sleep).toBeNull();
  });

  it('rejects with CommandTimeoutError when only one of the two packets arrives', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    jest.useFakeTimers();
    try {
      const promise = readDayInfo(wrapper, { daysAgo: 0, timeoutMs: 1_000 });
      // Attach catch synchronously so the rejection isn't unhandled.
      const assertion = expect(promise).rejects.toBeInstanceOf(CommandTimeoutError);
      await Promise.resolve();
      device.__pushNotify(bytesToBase64(activityPacket(ACTIVITY_PDF_EXAMPLE)));
      // No sleep packet pushed.
      jest.advanceTimersByTime(1_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects with CommandTimeoutError when no packets arrive', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    jest.useFakeTimers();
    try {
      const promise = readDayInfo(wrapper, { daysAgo: 0, timeoutMs: 500 });
      const assertion = expect(promise).rejects.toBeInstanceOf(CommandTimeoutError);
      await Promise.resolve();
      jest.advanceTimersByTime(500);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
