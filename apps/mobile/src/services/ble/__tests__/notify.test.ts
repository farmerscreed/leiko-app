/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

import { UrionDevice } from '../UrionDevice';
import { buildPacket, bytesToBase64 } from '../io';
import { classifyNotification, subscribeToNotifications } from '../notify';

const { MockDevice } = bleMock;

function notify(kindByte: number): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = kindByte;
  return buildPacket(0x73, payload);
}

describe('classifyNotification', () => {
  it.each([
    [0x01, 'hr'],
    [0x02, 'bp'],
    [0x03, 'spo2'],
    [0x04, 'steps'],
    [0x07, 'sports'],
    [0x09, 'dnd'],
    [0x0c, 'battery'],
  ])('maps 0x73 0x%i to %s', (byte, expected) => {
    const r = classifyNotification({ command: 0x73, payload: Uint8Array.from([byte]) });
    expect(r).toBe(expected);
  });

  it('returns "unknown" for unmapped notification kinds', () => {
    expect(
      classifyNotification({ command: 0x73, payload: Uint8Array.from([0x05]) }),
    ).toBe('unknown');
  });

  it('returns null for non-0x73 packets', () => {
    expect(
      classifyNotification({ command: 0x14, payload: new Uint8Array(14) }),
    ).toBeNull();
  });
});

describe('subscribeToNotifications', () => {
  it('routes BP notifications to onBP and ignores other commands', async () => {
    const device = new MockDevice({ id: 'aa', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const onBP = jest.fn();
    const onHR = jest.fn();
    const onUnknown = jest.fn();
    const unsub = subscribeToNotifications(wrapper, { onBP, onHR, onUnknown });

    device.__pushNotify(bytesToBase64(notify(0x02))); // bp
    device.__pushNotify(bytesToBase64(notify(0x01))); // hr
    device.__pushNotify(bytesToBase64(notify(0x05))); // unknown
    device.__pushNotify(bytesToBase64(buildPacket(0x14))); // not 0x73 — ignored

    expect(onBP).toHaveBeenCalledTimes(1);
    expect(onHR).toHaveBeenCalledTimes(1);
    expect(onUnknown).toHaveBeenCalledWith(0x05);

    unsub();
    device.__pushNotify(bytesToBase64(notify(0x02)));
    expect(onBP).toHaveBeenCalledTimes(1); // no further call after unsubscribe
  });
});
