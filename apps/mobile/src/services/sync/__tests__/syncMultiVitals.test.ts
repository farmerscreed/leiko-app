// syncMultiVitals — Sprint 7.5 / D13 §3.3.
//
// Unit-level coverage of the orchestration logic. The 4 BLE read
// wrappers and the postMultiVitals sender are mocked at the module
// boundary; the slices and storage layer are real (jest's MMKV mock
// from __mocks__/react-native-mmkv.js). This setup verifies:
//   • each step pushes its samples into the matching slice's pending
//     buffer (offline-first guarantee — addPending writes to MMKV
//     synchronously)
//   • per-vital cursors advance independently after each successful
//     read (D13 §3.4)
//   • Promise.allSettled isolates failures: one vital erroring does
//     not block the others, and the partial payload still flushes
//   • acceptSyncResult is called per-slice on /sync success, moving
//     pending → recent
//   • empty-payload short-circuits the network round-trip
//
// Real BLE-packet → wrapper → slice flow is covered manually via the
// 48h soak test (sprint card) — that's the integration-level proof.

const mockReadHRHistory: jest.Mock = jest.fn();
const mockReadSpO2History: jest.Mock = jest.fn();
const mockReadDayInfo: jest.Mock = jest.fn();
const mockPostMultiVitals: jest.Mock = jest.fn();

jest.mock('../../ble/commands/readHRHistory', () => ({
  readHRHistory: (...args: unknown[]) => mockReadHRHistory(...args),
}));
jest.mock('../../ble/commands/readSpO2History', () => ({
  readSpO2History: (...args: unknown[]) => mockReadSpO2History(...args),
}));
jest.mock('../../ble/commands/readDayInfo', () => ({
  readDayInfo: (...args: unknown[]) => mockReadDayInfo(...args),
}));
jest.mock('../postMultiVitals', () => ({
  postMultiVitals: (payload: unknown) => mockPostMultiVitals(payload),
  isPayloadEmpty: jest.requireActual('../postMultiVitals').isPayloadEmpty,
}));

import { syncMultiVitals } from '../syncMultiVitals';
import { useHR } from '../../../state/hr';
import { useSpO2 } from '../../../state/spo2';
import { useSleep } from '../../../state/sleep';
import { useActivity } from '../../../state/activity';
import { mmkv, STORAGE_KEYS } from '../../storage';
import {
  getVitalCursor,
  setVitalCursor,
} from '../syncBacklog';
import type { DeviceMeta } from '../../../types/vitals';

const DEVICE_BLE_ID = 'AA:BB:CC:DD:E4:F2';
const DEVICE_META: DeviceMeta = {
  bleId: DEVICE_BLE_ID,
  macSuffix: 'e4f2',
  name: 'Leiko Watch',
  model: 'U19M',
};
// 2025-01-21 12:00:00 UTC — picks a fixed nowSec so today_local is
// deterministic. dayLocalFromBcd(25, 1, 21) === '2025-01-21'.
const NOW_SEC = 1737460800;
const TODAY_LOCAL = '2025-01-21';

const fakeDevice = { __isFake: true } as unknown as Parameters<
  typeof syncMultiVitals
>[0];

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the MMKV-backed cursor + slice state.
  mmkv.remove(STORAGE_KEYS.lastSyncByDevice);
  useHR.getState().reset();
  useSpO2.getState().reset();
  useSleep.getState().reset();
  useActivity.getState().reset();
  // Default mocks return empty (no data).
  mockReadHRHistory.mockResolvedValue([]);
  mockReadSpO2History.mockResolvedValue([]);
  mockReadDayInfo.mockResolvedValue({ activity: null, sleep: null });
  mockPostMultiVitals.mockResolvedValue({
    deviceId: 'device-uuid',
    inserted: { bp: 0, hr: 0, spo2: 0, sleep: 0, steps: 0, calories: 0 },
    rejected: { bp: 0, hr: 0, spo2: 0, sleep: 0, steps: 0, calories: 0 },
    duplicates: { bp: 0, hr: 0, spo2: 0, sleep: 0, steps: 0, calories: 0 },
  });
});

describe('syncMultiVitals — happy path', () => {
  it('pushes HR samples to useHR.pending and advances cursor.hr', async () => {
    mockReadHRHistory.mockResolvedValueOnce([
      { timestampSec: 1737420000, bpm: 65 },
      { timestampSec: 1737423600, bpm: 68 },
    ]);
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.ok).toBe(true);
    expect(result.pulled.hr).toBe(2);
    // Cursor advanced to the newest RAW watch timestamp.
    expect(getVitalCursor(DEVICE_BLE_ID).hr).toBe(1737423600);
    // After /sync, slice.pending was cleared via acceptSyncResult.
    expect(useHR.getState().pending).toHaveLength(0);
    expect(useHR.getState().recent).toHaveLength(2);
  });

  it('pushes SpO2 samples and advances cursor.spo2 to today', async () => {
    mockReadSpO2History.mockResolvedValueOnce([
      {
        timestampSec: 1737420000,
        percent: 96,
        maxInWindow: 98,
        minInWindow: 94,
      },
    ]);
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.ok).toBe(true);
    expect(result.pulled.spo2).toBe(1);
    expect(getVitalCursor(DEVICE_BLE_ID).spo2).toBe(TODAY_LOCAL);
    expect(useSpO2.getState().recent).toHaveLength(1);
    expect(useSpO2.getState().recent[0]).toMatchObject({
      percent: 96,
      maxInWindow: 98,
      minInWindow: 94,
      perfusionIndex: null,
    });
  });

  it('pushes sleep session and advances cursor.sleep', async () => {
    // Same Promise.allSettled fan-out as the activity test — both
    // sleep + activity steps share readDayInfo. Steady mock.
    mockReadDayInfo.mockResolvedValue({
      activity: null,
      sleep: {
        daysAgo: 0,
        yearOfCentury: 25,
        month: 1,
        day: 21,
        totalMinutes: 444,
        deepMinutes: 100,
        lightMinutes: 240,
        exerciseMinutes: 0,
      },
    });
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.ok).toBe(true);
    expect(result.pulled.sleep).toBe(1);
    expect(getVitalCursor(DEVICE_BLE_ID).sleep).toBe(TODAY_LOCAL);
    const session = useSleep.getState().recent[0];
    expect(session.totalMinutes).toBe(444);
    expect(session.deepMinutes).toBe(100);
    expect(session.lightMinutes).toBe(240);
  });

  it('pushes activity day + calories day and advances cursor.activity', async () => {
    // Both syncSleepStep and syncActivityStep call readDayInfo with the
    // same args (Promise.allSettled fans them out), so use a steady
    // mockResolvedValue rather than ...Once.
    mockReadDayInfo.mockResolvedValue({
      activity: {
        daysAgo: 0,
        yearOfCentury: 25,
        month: 1,
        day: 21,
        totalSteps: 7200,
        totalKcal: 1800,
        totalStandingHours: 5,
        totalDistanceMeters: 5400,
      },
      sleep: null,
    });
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.ok).toBe(true);
    expect(result.pulled.activity).toBe(1);
    expect(getVitalCursor(DEVICE_BLE_ID).activity).toBe(TODAY_LOCAL);
    const stepsDay = useActivity.getState().recentSteps[0];
    expect(stepsDay.totalSteps).toBe(7200);
    expect(stepsDay.dayLocal).toBe(TODAY_LOCAL);
    const kcalDay = useActivity.getState().recentCalories[0];
    expect(kcalDay.totalKcal).toBe(1800);
  });
});

describe('syncMultiVitals — failure isolation', () => {
  it('continues when HR step fails (Promise.allSettled isolation)', async () => {
    mockReadHRHistory.mockRejectedValueOnce(new Error('hr_timeout'));
    mockReadSpO2History.mockResolvedValueOnce([
      { timestampSec: NOW_SEC - 3600, percent: 96, maxInWindow: 97, minInWindow: 95 },
    ]);
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.hr).toBe('hr_timeout');
    // SpO2 still flowed end-to-end despite HR's failure.
    expect(result.pulled.spo2).toBe(1);
    expect(useSpO2.getState().recent).toHaveLength(1);
    // HR cursor stayed at 0 (no advance on failure).
    expect(getVitalCursor(DEVICE_BLE_ID).hr).toBe(0);
    // SpO2 cursor still advanced.
    expect(getVitalCursor(DEVICE_BLE_ID).spo2).toBe(TODAY_LOCAL);
  });

  it('marks ok=false when /sync POST fails but step errors are still recorded', async () => {
    mockReadHRHistory.mockResolvedValueOnce([
      { timestampSec: 1737420000, bpm: 65 },
    ]);
    mockPostMultiVitals.mockRejectedValueOnce(new Error('network'));
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.sync).toBe('network');
    // Sample stays in pending — next reconnect will retry the POST.
    expect(useHR.getState().pending).toHaveLength(1);
    expect(useHR.getState().recent).toHaveLength(0);
    // Cursor already advanced — watch will not be re-read.
    expect(getVitalCursor(DEVICE_BLE_ID).hr).toBe(1737420000);
  });
});

describe('syncMultiVitals — empty payload', () => {
  it('skips the /sync POST entirely when no samples were collected', async () => {
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.ok).toBe(true);
    expect(result.inserted).toBeNull();
    expect(mockPostMultiVitals).not.toHaveBeenCalled();
  });
});

describe('syncMultiVitals — cursor dedup', () => {
  it('drops HR samples older than cursor.hr', async () => {
    setVitalCursor(DEVICE_BLE_ID, 'hr', 1737422000);
    mockReadHRHistory.mockResolvedValueOnce([
      { timestampSec: 1737420000, bpm: 60 }, // older than cursor — drop
      { timestampSec: 1737423600, bpm: 65 }, // fresh
    ]);
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.pulled.hr).toBe(1);
    expect(useHR.getState().recent[0].bpm).toBe(65);
    expect(getVitalCursor(DEVICE_BLE_ID).hr).toBe(1737423600);
  });

  it('skips SpO2 read when cursor.spo2 already at today', async () => {
    setVitalCursor(DEVICE_BLE_ID, 'spo2', TODAY_LOCAL);
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(mockReadSpO2History).not.toHaveBeenCalled();
  });

  it('skips activity read when cursor.activity already at today', async () => {
    setVitalCursor(DEVICE_BLE_ID, 'activity', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'sleep', TODAY_LOCAL);
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    // readDayInfo would be called for either sleep or activity step;
    // both cursors at today means neither step calls it.
    expect(mockReadDayInfo).not.toHaveBeenCalled();
  });
});
