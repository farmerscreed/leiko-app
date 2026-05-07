// Unit tests for commands/setTimeFormat.ts. 0x0A §4.4 (shared with setUserParams).

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { base64ToBytes, buildPacket, bytesToBase64, parsePacket } from '../io';
import { setTimeFormat } from '../commands/setTimeFormat';

const { MockDevice } = bleMock;

describe('commands.setTimeFormat', () => {
  it('writes the same 0x0A packet as setUserParams', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setTimeFormat(wrapper, {
      hourFormat: '24h',
      units: 'metric',
      gender: 'male',
      ageYears: 35,
      heightCm: 180,
      weightKg: 80,
      strapSizeMm: 0,
      hrAlarmBpm: 0,
    });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x0a)));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x0a);
    expect(Array.from(sent.payload.slice(0, 9))).toEqual([
      0x02, 0x00, 0x00, 0x00, 35, 180, 80, 0, 0,
    ]);
  });

  it('flips byte 1 to 0x01 for 12-hour and byte 2 to 0x01 for imperial', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setTimeFormat(wrapper, {
      hourFormat: '12h',
      units: 'imperial',
      gender: 'female',
      ageYears: 50,
      heightCm: 165,
      weightKg: 65,
      strapSizeMm: 22,
      hrAlarmBpm: 0,
    });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x0a)));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(Array.from(sent.payload.slice(0, 3))).toEqual([0x02, 0x01, 0x01]);
  });
});
