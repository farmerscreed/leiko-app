// Unit tests for commands/setUserParams.ts. 0x0A §4.4.

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { base64ToBytes, buildPacket, bytesToBase64, parsePacket } from '../io';
import { setUserParams } from '../commands/setUserParams';

const { MockDevice } = bleMock;

describe('commands.setUserParams', () => {
  it('writes 0x0A with hour-format, units, gender, age, height, weight, strap, hr-alarm', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setUserParams(wrapper, {
      hourFormat: '12h',
      units: 'imperial',
      gender: 'female',
      ageYears: 64,
      heightCm: 168,
      weightKg: 71,
      strapSizeMm: 0,
      hrAlarmBpm: 130,
    });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x0a)));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(sent.command).toBe(0x0a);
    expect(Array.from(sent.payload)).toEqual([
      0x02, // sub-cmd write
      0x01, // 12-hour
      0x01, // imperial
      0x01, // female
      64, // age
      168, // height cm
      71, // weight kg
      0, // strap size
      130, // hr alarm bpm
      0, 0, 0, 0, 0, // reserved
    ]);
  });

  it('encodes 24-hour metric male defaults correctly', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();
    const promise = setUserParams(wrapper, {
      hourFormat: '24h',
      units: 'metric',
      gender: 'male',
      ageYears: 30,
      heightCm: 175,
      weightKg: 75,
      strapSizeMm: 0,
      hrAlarmBpm: 0,
    });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(buildPacket(0x0a)));
    await promise;
    const sent = parsePacket(base64ToBytes(device.__writes[0]));
    expect(Array.from(sent.payload.slice(0, 4))).toEqual([0x02, 0x00, 0x00, 0x00]);
  });
});
