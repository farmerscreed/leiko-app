// Unit tests for commands/setGoals.ts. 0x21 §4.9.

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { base64ToBytes, buildPacket, bytesToBase64, parsePacket } from '../io';
import { setGoals } from '../commands/setGoals';

const { MockDevice } = bleMock;

describe('commands.setGoals', () => {
  it('encodes the 3-byte little-endian step target', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    // 1 step → 01 00 00 (matches the protocol example in §4.9).
    const promise = setGoals(wrapper, {
      stepsTarget: 1,
      kcalTarget: 0,
      standingTargetHours: 0,
      distanceTargetMeters: 0,
      sleepTargetMinutes: 0,
      exerciseTargetMinutes: 0,
    });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x21)));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x21);
    expect(Array.from(sent.payload.slice(0, 4))).toEqual([0x02, 0x01, 0x00, 0x00]);
  });

  it('packs every field at the spec-defined offset', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setGoals(wrapper, {
      stepsTarget: 0x010203, //   bytes 1..3 → 03 02 01
      kcalTarget: 0x0405, //      bytes 4..5 → 05 04
      standingTargetHours: 0x06, // byte 6
      distanceTargetMeters: 0x070809, // bytes 7..9 → 09 08 07
      sleepTargetMinutes: 0x0a0b, //    bytes 10..11 → 0B 0A
      exerciseTargetMinutes: 0x0c0d, //  bytes 12..13 → 0D 0C
    });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x21)));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(Array.from(sent.payload)).toEqual([
      0x02, // sub-cmd
      0x03, 0x02, 0x01, // steps LE
      0x05, 0x04, // kcal LE
      0x06, // standing hrs
      0x09, 0x08, 0x07, // distance LE
      0x0b, 0x0a, // sleep min LE
      0x0d, 0x0c, // exercise min LE
    ]);
  });
});
