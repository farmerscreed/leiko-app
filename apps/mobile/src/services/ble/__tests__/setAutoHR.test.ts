// Unit tests for commands/setAutoHR.ts. 0x16 §4.7.

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { base64ToBytes, buildPacket, bytesToBase64, parsePacket } from '../io';
import { setAutoHR } from '../commands/setAutoHR';

const { MockDevice } = bleMock;

describe('commands.setAutoHR', () => {
  it('writes 0x16 0x02 0x01 to enable', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setAutoHR(wrapper, true);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x16, [0x02, 0x01])));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x16);
    expect(Array.from(sent.payload.slice(0, 2))).toEqual([0x02, 0x01]);
    expect(Array.from(sent.payload.slice(2))).toEqual(new Array(12).fill(0));
  });

  it('writes 0x16 0x02 0x02 to disable', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setAutoHR(wrapper, false);
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x16, [0x02, 0x02])));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x16);
    expect(Array.from(sent.payload.slice(0, 2))).toEqual([0x02, 0x02]);
  });
});
