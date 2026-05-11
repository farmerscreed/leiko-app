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
  getVitalCursor,
  setVitalCursor,
  syncBacklog,
  watchTimestampToUtcSec,
} from '../syncBacklog';
import { STORAGE_KEYS } from '../../storage';
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

describe('per-vital cursor (D13 §3.4)', () => {
  const dev = 'AA:BB:CC:DD:E4:F2';

  it('returns the empty cursor when nothing is stored', () => {
    const c = getVitalCursor(dev);
    expect(c).toEqual({ bp: 0, hr: 0, spo2: '', sleep: '', activity: '' });
  });

  it('round-trips per-sample (bp, hr) cursors as numbers', () => {
    setVitalCursor(dev, 'bp', 1737385351);
    setVitalCursor(dev, 'hr', 1737385900);
    const c = getVitalCursor(dev);
    expect(c.bp).toBe(1737385351);
    expect(c.hr).toBe(1737385900);
  });

  it('round-trips per-day (spo2, sleep, activity) cursors as YYYY-MM-DD strings', () => {
    setVitalCursor(dev, 'spo2', '2026-05-06');
    setVitalCursor(dev, 'sleep', '2026-05-05');
    setVitalCursor(dev, 'activity', '2026-05-07');
    const c = getVitalCursor(dev);
    expect(c.spo2).toBe('2026-05-06');
    expect(c.sleep).toBe('2026-05-05');
    expect(c.activity).toBe('2026-05-07');
  });

  it('advancing one vital does not touch the others', () => {
    setVitalCursor(dev, 'bp', 1000);
    setVitalCursor(dev, 'hr', 2000);
    setVitalCursor(dev, 'sleep', '2026-05-05');
    setVitalCursor(dev, 'hr', 3000);   // advance only hr
    const c = getVitalCursor(dev);
    expect(c.bp).toBe(1000);
    expect(c.hr).toBe(3000);
    expect(c.sleep).toBe('2026-05-05');
  });

  it('advancing for one device does not touch other devices', () => {
    const dev2 = '11:22:33:44:55:66';
    setVitalCursor(dev, 'bp', 1000);
    setVitalCursor(dev2, 'bp', 2000);
    expect(getVitalCursor(dev).bp).toBe(1000);
    expect(getVitalCursor(dev2).bp).toBe(2000);
  });

  it('migrates legacy bare-number entries to the bp cursor on read', () => {
    // Manually plant a Sprint-6-shape value: { [bleId]: number }.
    mmkv.set(
      STORAGE_KEYS.lastSyncByDevice,
      JSON.stringify({ [dev]: 1737000000 }),
    );
    const c = getVitalCursor(dev);
    expect(c.bp).toBe(1737000000);
    expect(c.hr).toBe(0);
    expect(c.spo2).toBe('');
    expect(c.sleep).toBe('');
    expect(c.activity).toBe('');
  });

  it('legacy getLastSyncSec still returns the bp value after migration', () => {
    mmkv.set(
      STORAGE_KEYS.lastSyncByDevice,
      JSON.stringify({ [dev]: 1737000000 }),
    );
    expect(getLastSyncSec(dev)).toBe(1737000000);
  });

  it('writing through the new API after a legacy read flushes the new shape', () => {
    mmkv.set(
      STORAGE_KEYS.lastSyncByDevice,
      JSON.stringify({ [dev]: 1737000000 }),
    );
    setVitalCursor(dev, 'hr', 999);
    const stored = JSON.parse(mmkv.getString(STORAGE_KEYS.lastSyncByDevice) ?? '{}');
    expect(stored[dev]).toEqual({
      bp: 1737000000,
      hr: 999,
      spo2: '',
      sleep: '',
      activity: '',
    });
  });

  it('defensively populates missing keys when reading a partial new-shape entry', () => {
    // A future-version write that only set some keys.
    mmkv.set(
      STORAGE_KEYS.lastSyncByDevice,
      JSON.stringify({ [dev]: { bp: 100 } }),
    );
    const c = getVitalCursor(dev);
    expect(c).toEqual({ bp: 100, hr: 0, spo2: '', sleep: '', activity: '' });
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

describe('syncBacklog — stale-cursor recovery (Sprint 12.5.1)', () => {
  // Repro of the 2026-05-11 Lagos trace: cursor at 1778237863, watch's
  // newest returned record at 1778237706, 157s gap. Every packet ≤
  // cursor → silently dropped. Fix: detect-and-recover.
  it('resets the cursor when the watch returned only readings ≤ lastSync', async () => {
    const dev = 'AA:BB:CC:DD:E4:F2';
    setLastSyncSec(dev, 1778237863);
    const device = new MockDevice({ id: dev, name: 'Leiko Watch' });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = syncBacklog(wrapper, dev, { skipSetTime: true });
    await new Promise((r) => setImmediate(r));
    // Watch's newest = 1778237706 (157s before the cursor); plus an
    // older record. Cursor is jammed.
    device.__pushNotify(bytesToBase64(bpResp(1778237706, 128, 82, 70)));
    device.__pushNotify(bytesToBase64(bpResp(1777375048, 122, 79, 65)));
    device.__pushNotify(bytesToBase64(term()));

    const result = await promise;
    // Recovery: cursor snaps to (watch_newest - 1), so this run
    // surfaces the watch's current newest BP. The older record was
    // already ingested in a prior sync (that's how the cursor got
    // ahead in the first place); it stays filtered out.
    expect(result.pulled).toBe(1);
    expect(result.latestTimestampSec).toBe(1778237706);
    // Cursor lands on the newest record's raw_ts.
    expect(getLastSyncSec(dev)).toBe(1778237706);
    await flushMicrotasks();
    expect(readingsCount()).toBe(1);
  });

  it('does not reset when the cursor is correctly positioned ahead of stale records', async () => {
    // Cursor sits between the firmware-echoed cursor record and a real
    // newer reading. This is the normal incremental-sync case and must
    // not trip the recovery branch.
    const dev = 'AA:BB:CC:DD:E4:F2';
    setLastSyncSec(dev, 1737200000);
    const device = new MockDevice({ id: dev, name: null });
    const wrapper = new UrionDevice(device);
    await wrapper.startNotify();

    const promise = syncBacklog(wrapper, dev, { skipSetTime: true });
    await new Promise((r) => setImmediate(r));
    device.__pushNotify(bytesToBase64(bpResp(1737200000, 138, 91, 103)));
    device.__pushNotify(bytesToBase64(bpResp(1737300000, 122, 78, 72)));
    device.__pushNotify(bytesToBase64(term()));

    const result = await promise;
    expect(result.pulled).toBe(1);
    // Cursor advanced normally, no recovery snap.
    expect(getLastSyncSec(dev)).toBe(1737300000);
  });
});
