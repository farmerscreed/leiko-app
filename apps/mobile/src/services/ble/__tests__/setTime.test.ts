// Unit tests for commands/setTime.ts — 0x01 §4.1. The wall clock must
// come from the requested IANA zone, not Date's process-start zone
// (2026-11-17: watch stayed on US time after a flight to Lagos).

/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { base64ToBytes, buildPacket, bytesToBase64, parsePacket } from '../io';
import { setTime } from '../commands/setTime';

const { MockDevice } = bleMock;

async function sentPayload(
  opts: Parameters<typeof setTime>[1],
): Promise<{ bytes: number[]; timeZone: string }> {
  const device = new MockDevice({ id: 'aa', name: null });
  const wrapper = new UrionDevice(device);
  await wrapper.startNotify();
  const promise = setTime(wrapper, opts);
  await new Promise((r) => setImmediate(r));
  device.__pushNotify(bytesToBase64(buildPacket(0x01)));
  const { timeZone } = await promise;
  const sent = parsePacket(base64ToBytes(device.__writes[0]));
  expect(sent.command).toBe(0x01);
  return { bytes: Array.from(sent.payload.slice(0, 7)), timeZone };
}

describe('commands.setTime', () => {
  const now = new Date('2026-11-17T19:05:30Z');

  it('writes Lagos wall clock as BCD when the zone is Lagos', async () => {
    const { bytes, timeZone } = await sentPayload({ now, timeZone: 'Africa/Lagos' });
    // 26-11-17 20:05:30, English
    expect(bytes).toEqual([0x26, 0x11, 0x17, 0x20, 0x05, 0x30, 0x01]);
    expect(timeZone).toBe('Africa/Lagos');
  });

  it('writes the previous calendar day for Los Angeles', async () => {
    const { bytes } = await sentPayload({ now, timeZone: 'America/Los_Angeles' });
    // 26-11-17 11:05:30 PST
    expect(bytes).toEqual([0x26, 0x11, 0x17, 0x11, 0x05, 0x30, 0x01]);
  });

  it('ignores Date.prototype local getters (stale engine zone)', async () => {
    const orig = Date.prototype.getHours;
    Date.prototype.getHours = () => 3; // pretend the engine is stuck elsewhere
    try {
      const { bytes } = await sentPayload({ now, timeZone: 'Africa/Lagos' });
      expect(bytes[3]).toBe(0x20);
    } finally {
      Date.prototype.getHours = orig;
    }
  });
});
