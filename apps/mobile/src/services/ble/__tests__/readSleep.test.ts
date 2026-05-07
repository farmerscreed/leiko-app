/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { buildPacket, bytesToBase64 } from '../io';
import { readSleep } from '../commands/readSleep';

const { MockDevice } = bleMock;

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

describe('readSleep', () => {
  it('returns the sleep slice from a 0x07 exchange', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = readSleep(wrapper, { daysAgo: 0 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x07, ACTIVITY_PDF_EXAMPLE)));
    device.__pushNotify(bytesToBase64(buildPacket(0x07, SLEEP_PDF_EXAMPLE)));

    const result = await promise;
    expect(result).toEqual({
      daysAgo: 0,
      yearOfCentury: 25,
      month: 1,
      day: 21,
      totalMinutes: 469,
      deepMinutes: 109,
      lightMinutes: 342,
      exerciseMinutes: 3,
    });
  });

  it('returns null when the sleep packet is all-zero', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const emptySleep = new Uint8Array(14);
    emptySleep[0] = 0x01;
    const promise = readSleep(wrapper, { daysAgo: 2 });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x07, ACTIVITY_PDF_EXAMPLE)));
    device.__pushNotify(bytesToBase64(buildPacket(0x07, emptySleep)));

    expect(await promise).toBeNull();
  });
});
