/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { buildPacket, bytesToBase64 } from '../io';
import { readBattery } from '../commands/readBattery';

const { MockDevice } = bleMock;

function batteryResponse(pct: number): Uint8Array {
  return buildPacket(0x03, [pct]);
}

describe('readBattery', () => {
  it('parses the U16PRO §4.2 example (0x1E = 30%)', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = readBattery(wrapper);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(batteryResponse(0x1e)));
    expect(await promise).toBe(30);
  });

  it('throws if the watch returns an out-of-range byte', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = readBattery(wrapper).catch((e) => e);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(batteryResponse(200)));
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toContain('out-of-range');
  });
});
