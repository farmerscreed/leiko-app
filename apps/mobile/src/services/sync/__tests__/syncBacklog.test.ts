/* eslint-disable @typescript-eslint/no-require-imports */
const bleMock = require('../../../../../../tools/ble-mock');

// Mock postReading so addPendingReading's auto-sync side-effect
// resolves cleanly without needing a real /sync endpoint. The
// behaviour we're asserting here is "syncBacklog wrote the right
// rows into useReadings"; the post-sync transitions (pending →
// recent) are covered by the readings-store tests separately.
jest.mock('../postReading', () => ({
  postReading: jest.fn(async () => ({
    readingId: 'srv-mock',
    deviceId: 'dev-mock',
    duplicate: false,
  })),
  setDeviceMetaProvider: () => undefined,
  getDeviceMeta: () => null,
  inferModel: () => 'U16H',
}));

import { UrionDevice } from '../../ble/UrionDevice';
import { buildPacket, bytesToBase64 } from '../../ble/io';
import { writeUint32LE } from '../../ble/commands/readBPHistory';
import {
  getLastSyncSec,
  setLastSyncSec,
  syncBacklog,
  watchTimestampToUtcSec,
} from '../syncBacklog';
import { useReadings } from '../../../state/readings';
import { mmkv } from '../../storage';

const { MockDevice } = bleMock;

function bpResp(tsSec: number, sys: number, dia: number, pulse: number): Uint8Array {
  const payload = new Uint8Array(14);
  writeUint32LE(payload, 0, tsSec);
  payload[4] = dia;
  payload[5] = sys;
  payload[6] = pulse;
  return buildPacket(0x14, payload);
}

function term(): Uint8Array {
  const payload = new Uint8Array(14);
  payload[0] = payload[1] = payload[2] = payload[3] = 0xff;
  return buildPacket(0x14, payload);
}

beforeEach(() => {
  mmkv.clearAll();
  useReadings.getState().reset();
});

describe('watchTimestampToUtcSec — China-firmware offset correction', () => {
  // Real-device observation 2026-05-07 in Lagos (UTC+1):
  //   wall clock = 09:03 → raw watch sec interprets as 01:03 UTC.
  //   true UTC = 08:03 (= 09:03 Lagos − 1h offset).
  //   Expected shift = +7h (8h China − 1h Lagos).
  //
  // The Date.getTimezoneOffset value depends on the test runner's
  // host TZ. Asserting an exact result requires pinning TZ; instead
  // we assert the relationship: shifted minus raw == (8h − local offset).
  it('shifts a raw watch second by (China offset − local offset) seconds', () => {
    const raw = 1745053380; // arbitrary recent second
    const shifted = watchTimestampToUtcSec(raw);
    const localOffsetSec = -new Date(raw * 1000).getTimezoneOffset() * 60;
    const expectedShift = 8 * 3600 - localOffsetSec;
    expect(shifted - raw).toBe(expectedShift);
  });

  it('round-trips when the host TZ is China (UTC+8) — no shift', () => {
    // Mock getTimezoneOffset to return -480 (China) for this test.
    const orig = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function () {
      return -480;
    };
    try {
      const raw = 1745053380;
      expect(watchTimestampToUtcSec(raw)).toBe(raw);
    } finally {
      Date.prototype.getTimezoneOffset = orig;
    }
  });

  it('shifts by exactly +7h for a Lagos client (UTC+1)', () => {
    const orig = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function () {
      return -60;
    };
    try {
      const raw = 1745053380;
      expect(watchTimestampToUtcSec(raw) - raw).toBe(7 * 3600);
    } finally {
      Date.prototype.getTimezoneOffset = orig;
    }
  });
});

describe('lastSyncSec cursor (per-device)', () => {
  it('returns 0 when no sync has happened for this device', () => {
    expect(getLastSyncSec('AA:BB:CC:DD:E4:F2')).toBe(0);
  });

  it('round-trips set/get without affecting other devices', () => {
    setLastSyncSec('AA:BB:CC:DD:E4:F2', 1737385351);
    setLastSyncSec('11:22:33:44:55:66', 1737000000);
    expect(getLastSyncSec('AA:BB:CC:DD:E4:F2')).toBe(1737385351);
    expect(getLastSyncSec('11:22:33:44:55:66')).toBe(1737000000);
    expect(getLastSyncSec('99:99:99:99:99:99')).toBe(0);
  });
});

// Helper: total readings = pending + recent. The store auto-syncs
// after addPendingReading (best-effort), so rows may have moved from
// pending → recent by the time we assert. Sum is the invariant.
function readingsCount(): number {
  const s = useReadings.getState();
  return s.pending.length + s.recent.length;
}

async function flushMicrotasks(): Promise<void> {
  // Drain the post-addPending syncPending() chains so the test sees
  // the settled state (pending → recent).
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

describe('syncBacklog — first sync (cursor=0)', () => {
  it('pulls all readings and advances the cursor to the newest', async () => {
    const device = new MockDevice({ id: 'AA:BB:CC:DD:E4:F2', name: 'Leiko Watch' });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = syncBacklog(wrapper, 'AA:BB:CC:DD:E4:F2', { skipSetTime: true });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(bpResp(1737000000, 124, 79, 68)));
    device.__pushNotify(bytesToBase64(bpResp(1737200000, 138, 91, 103)));
    device.__pushNotify(bytesToBase64(bpResp(1737385351, 134, 97, 115)));
    device.__pushNotify(bytesToBase64(term()));

    const result = await promise;
    expect(result.pulled).toBe(3);
    expect(result.latestTimestampSec).toBe(1737385351);
    expect(getLastSyncSec('AA:BB:CC:DD:E4:F2')).toBe(1737385351);

    await flushMicrotasks();
    expect(readingsCount()).toBe(3);
    const latest = useReadings.getState().latest();
    expect(latest).toMatchObject({ systolic: 134, diastolic: 97, pulse: 115 });
  });
});

describe('syncBacklog — incremental sync', () => {
  it('filters out the cursor record itself when firmware echoes it', async () => {
    setLastSyncSec('AA:BB:CC:DD:E4:F2', 1737200000);
    const device = new MockDevice({ id: 'AA:BB:CC:DD:E4:F2', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = syncBacklog(wrapper, 'AA:BB:CC:DD:E4:F2', { skipSetTime: true });
    await new Promise((r) => setImmediate(r));
    // Firmware re-emits the cursor record — must be ignored.
    device.__pushNotify(bytesToBase64(bpResp(1737200000, 138, 91, 103)));
    device.__pushNotify(bytesToBase64(bpResp(1737300000, 122, 78, 72)));
    device.__pushNotify(bytesToBase64(bpResp(1737400000, 130, 85, 80)));
    device.__pushNotify(bytesToBase64(term()));

    const result = await promise;
    expect(result.pulled).toBe(2);
    expect(getLastSyncSec('AA:BB:CC:DD:E4:F2')).toBe(1737400000);
    await flushMicrotasks();
    expect(readingsCount()).toBe(2);
  });

  it('returns pulled=0 and leaves cursor unchanged when nothing new', async () => {
    setLastSyncSec('AA:BB:CC:DD:E4:F2', 1737400000);
    const device = new MockDevice({ id: 'AA:BB:CC:DD:E4:F2', name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = syncBacklog(wrapper, 'AA:BB:CC:DD:E4:F2', { skipSetTime: true });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(term()));

    const result = await promise;
    expect(result.pulled).toBe(0);
    expect(result.latestTimestampSec).toBeNull();
    expect(getLastSyncSec('AA:BB:CC:DD:E4:F2')).toBe(1737400000);
    await flushMicrotasks();
    expect(readingsCount()).toBe(0);
  });
});
