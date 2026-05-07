// Unit tests for commands/setAutoSpO2.ts. 0x2C §4.10.

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { base64ToBytes, buildPacket, bytesToBase64, parsePacket } from '../io';
import { setAutoSpO2 } from '../commands/setAutoSpO2';

const { MockDevice } = bleMock;

describe('commands.setAutoSpO2', () => {
  it('writes 0x2C 0x02 0x01 to enable', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setAutoSpO2(wrapper, true);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x2c, [0x02, 0x01])));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x2c);
    expect(Array.from(sent.payload.slice(0, 2))).toEqual([0x02, 0x01]);
    expect(Array.from(sent.payload.slice(2))).toEqual(new Array(12).fill(0));
  });

  it('writes 0x2C 0x02 0x02 to disable', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setAutoSpO2(wrapper, false);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x2c, [0x02, 0x02])));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x2c);
    expect(Array.from(sent.payload.slice(0, 2))).toEqual([0x02, 0x02]);
  });
});
