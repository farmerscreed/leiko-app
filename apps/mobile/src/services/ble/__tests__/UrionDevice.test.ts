// Unit tests for UrionDevice. Uses the in-memory mock from tools/ble-mock
// (re-exported via __mocks__/react-native-ble-plx.js).

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { CommandTimeoutError, UrionDevice } from '../UrionDevice';
import { buildPacket, bytesToBase64, expectByte0, parsePacket, base64ToBytes } from '../io';
import { setTime } from '../commands/setTime';
import { findWatch } from '../commands/findWatch';

const { MockDevice } = bleMock;

describe('UrionDevice', () => {
  it('exposes id, name and a 4-char macSuffix', () => {
    const device = new MockDevice({ id: 'AA:BB:CC:DD:E4:F2', name: 'Leiko Watch' });
    const wrapper = new UrionDevice(device);
    expect(wrapper.id).toBe('AA:BB:CC:DD:E4:F2');
    expect(wrapper.name).toBe('Leiko Watch');
    expect(wrapper.macSuffix).toBe('e4f2');
  });

  it('falls back to localName when name is null', () => {
    const device = new MockDevice({ id: 'AA:BB:CC:DD:E4:F2', name: null });
    device.localName = 'Urion U16';
    const wrapper = new UrionDevice(device);
    expect(wrapper.name).toBe('Urion U16');
  });

  it('writePacket sends base64-encoded bytes to the write characteristic', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    const packet = buildPacket(0x14);
    await wrapper.writePacket(packet);
    expect(device.__writes).toHaveLength(1);
    expect(base64ToBytes(device.__writes[0])).toEqual(packet);
  });

  it('sendCommand without a validator resolves after write', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const result = await wrapper.sendCommand(0x50);
    expect(result).toBeUndefined();
    expect(device.__writes).toHaveLength(1);
  });

  it('sendCommand with a validator resolves on a matching notify', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = wrapper.sendCommand(0x16, [0x02, 0x01], expectByte0(0x16));
    // simulate the watch echoing an ACK packet
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x16, [0x00])));
    const response = await promise;
    expect(response?.command).toBe(0x16);
  });

  it('sendCommand rejects with CommandTimeoutError when no response arrives', async () => {
    jest.useFakeTimers();
    try {
      const device = new MockDevice({ id: 'aa', name: null });
      const wrapper = new UrionDevice(device);
      await wrapper.startNotify();
      const promise = wrapper.sendCommand(0x16, [0x02], expectByte0(0x16), 1000);
      // Catch the rejection synchronously so Jest doesn't surface it as
      // an unhandled promise — fake timers + microtask interleaving make
      // the rejection visible before our await.
      const settled = promise.catch((e) => e);
      jest.advanceTimersByTime(1000);
      const err = await settled;
      expect(err).toBeInstanceOf(CommandTimeoutError);
    } finally {
      jest.useRealTimers();
    }
  });

  it('startNotify is idempotent', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    await wrapper.startNotify();
    // monitor was set up once; pushing a notify lands once on the listener
    let count = 0;
    wrapper.onNotify(() => count++);
    device.__pushNotify(bytesToBase64(buildPacket(0x14)));
    expect(count).toBe(1);
  });

  it('disconnect tears down notify subscription and listeners', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    let count = 0;
    wrapper.onNotify(() => count++);
    await wrapper.disconnect();
    device.__pushNotify(bytesToBase64(buildPacket(0x14)));
    expect(count).toBe(0);
  });
});

describe('commands.setTime', () => {
  it('writes a 0x01 packet with BCD-encoded date and language byte', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const fixed = new Date(2026, 4, 6, 14, 32, 9); // 2026-05-06 14:32:09 local
    const promise = setTime(wrapper, { now: fixed, language: 'en' });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x01)));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x01);
    // BCD: 26 → 0x26, 5 → 0x05, 6 → 0x06, 14 → 0x14, 32 → 0x32, 9 → 0x09
    expect(Array.from(sent.payload.slice(0, 7))).toEqual([
      0x26, 0x05, 0x06, 0x14, 0x32, 0x09, 0x01,
    ]);
  });
});

describe('commands.findWatch', () => {
  it('writes a 0x50 packet with the 55 AA confirmation bytes (per U16PRO §4.12)', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    await findWatch(wrapper);
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x50);
    expect(Array.from(sent.payload.slice(0, 2))).toEqual([0x55, 0xaa]);
    expect(Array.from(sent.payload.slice(2))).toEqual(new Array(12).fill(0));
  });
});
