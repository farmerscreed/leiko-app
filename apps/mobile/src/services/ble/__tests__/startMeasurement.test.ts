import { isStartMeasurementReply, startMeasurement } from '../commands/startMeasurement';
import { subscribeToNotifications } from '../notify';
import type { UrionDevice } from '../UrionDevice';
import type { ParsedPacket } from '../io';

const pkt = (command: number): ParsedPacket => ({ command, payload: new Uint8Array(14) });

describe('startMeasurement (0x32)', () => {
  it('accepts the echo and the error reply as the answer to 0x32', () => {
    expect(isStartMeasurementReply(pkt(0x32))).toBe(true);
    expect(isStartMeasurementReply(pkt(0xb2))).toBe(true);
    expect(isStartMeasurementReply(pkt(0x73))).toBe(false);
  });

  it('resolves true when the watch echoes 0x32', async () => {
    const device = { sendCommand: jest.fn().mockResolvedValue(pkt(0x32)) } as unknown as UrionDevice;
    await expect(startMeasurement(device)).resolves.toBe(true);
    expect((device.sendCommand as jest.Mock).mock.calls[0][0]).toBe(0x32);
  });

  it('resolves false when the watch rejects (0xB2)', async () => {
    const device = { sendCommand: jest.fn().mockResolvedValue(pkt(0xb2)) } as unknown as UrionDevice;
    await expect(startMeasurement(device)).resolves.toBe(false);
  });

  it('resolves false instead of throwing when the watch does not answer', async () => {
    const device = { sendCommand: jest.fn().mockRejectedValue(new Error('timeout')) } as unknown as UrionDevice;
    await expect(startMeasurement(device)).resolves.toBe(false);
  });
});

describe('notify — 0x33 measurement complete', () => {
  it('routes 0x33 to onBPMeasureComplete and leaves 0x73 routing alone', () => {
    let listener: ((p: ParsedPacket) => void) | null = null;
    const device = {
      onNotify: (cb: (p: ParsedPacket) => void) => {
        listener = cb;
        return () => undefined;
      },
    } as unknown as UrionDevice;
    const onBPMeasureComplete = jest.fn();
    const onBP = jest.fn();
    subscribeToNotifications(device, { onBPMeasureComplete, onBP });
    listener!(pkt(0x33));
    expect(onBPMeasureComplete).toHaveBeenCalledTimes(1);
    expect(onBP).not.toHaveBeenCalled();
    const bp = pkt(0x73);
    bp.payload[0] = 0x02;
    listener!(bp);
    expect(onBP).toHaveBeenCalledTimes(1);
  });
});
