// Unit tests for commands/factoryReset.ts. 0xFF §4.14.

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { base64ToBytes, parsePacket } from '../io';
import { factoryReset } from '../commands/factoryReset';

const { MockDevice } = bleMock;

describe('commands.factoryReset', () => {
  it('writes 0xFF 0x66 0x66 with the rest of the payload zero-padded', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    await factoryReset(wrapper, 'erase');
    expect(device.__writes).toHaveLength(1);
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0xff);
    expect(Array.from(sent.payload.slice(0, 2))).toEqual([0x66, 0x66]);
    expect(Array.from(sent.payload.slice(2))).toEqual(new Array(12).fill(0));
  });

  it('resolves immediately without waiting for any notify response', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    // No __pushNotify is called — if factoryReset were waiting on a
    // response the await below would hang forever (Jest test timeout).
    // The watch never replies; firmware disconnects + erases.
    const start = Date.now();
    await factoryReset(wrapper, 'erase');
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('throws (and does not write) when confirm is not "erase"', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    await expect(
      // Cast through unknown to bypass the string-literal type — this
      // is exactly the misuse the runtime check guards against.
      factoryReset(wrapper, 'nope' as unknown as 'erase'),
    ).rejects.toThrow(/erase/);
    expect(device.__writes).toHaveLength(0);
  });
});
