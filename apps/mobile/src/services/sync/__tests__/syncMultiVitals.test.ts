// syncMultiVitals — Sprint 7.5 / D13 §3.3, multi-day backfill added
// in Sprint 9 / D13 §3.4.
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
//   • Promise.allSettled isolates failures: one branch erroring does
//     not block the others, and the partial payload still flushes
//   • acceptSyncResult is called per-slice on /sync success, moving
//     pending → recent
//   • empty-payload short-circuits the network round-trip
//   • multi-day backfill: per-day loops cover (cursor+1 .. today) per
//     vital with the per-vital cursor-day-inclusion + always-include-
//     today rules baked in
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
// Sprint 14.5 task 5 — applyDeviceConfig is called inside
// syncMultiVitals before the parallel pull. Default mock no-ops so
// existing tests don't have to set up vitalSetup state.
const mockApplyDeviceConfig: jest.Mock = jest.fn().mockResolvedValue({
  ran: false,
  steps: [],
});
jest.mock('../applyDeviceConfig', () => ({
  applyDeviceConfig: (...args: unknown[]) => mockApplyDeviceConfig(...args),
}));
jest.mock('../postMultiVitals', () => ({
  postMultiVitals: (payload: unknown) => mockPostMultiVitals(payload),
  isPayloadEmpty: jest.requireActual('../postMultiVitals').isPayloadEmpty,
}));

import {
  syncMultiVitals,
  computeBackfillDayList,
} from '../syncMultiVitals';
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
const YESTERDAY_LOCAL = '2025-01-20';

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

/** Seed every per-day cursor at yesterday so the orchestrator's
 *  backfill window collapses to a single day (today). Used by tests
 *  whose intent is to exercise single-day sync behaviour. */
function seedCursorsAtYesterday(): void {
  setVitalCursor(DEVICE_BLE_ID, 'spo2', YESTERDAY_LOCAL);
  setVitalCursor(DEVICE_BLE_ID, 'sleep', YESTERDAY_LOCAL);
  setVitalCursor(DEVICE_BLE_ID, 'activity', YESTERDAY_LOCAL);
}

describe('syncMultiVitals — happy path', () => {
  it('pushes HR samples to useHR.pending and advances cursor.hr', async () => {
    seedCursorsAtYesterday();
    mockReadHRHistory.mockResolvedValueOnce([
      { timestampSec: 1737420000, bpm: 65 },
      { timestampSec: 1737423600, bpm: 68 },
    ]);
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
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
    seedCursorsAtYesterday();
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
      firstSyncDays: 1,
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
    seedCursorsAtYesterday();
    mockReadDayInfo.mockResolvedValueOnce({
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
      firstSyncDays: 1,
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
    seedCursorsAtYesterday();
    mockReadDayInfo.mockResolvedValueOnce({
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
      firstSyncDays: 1,
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

  it('issues a single readDayInfo per day for the merged sleep+activity branch', async () => {
    // Sleep + activity share the 0x07 wire packet; the orchestrator
    // calls readDayInfo ONCE per backfill day and routes both reply
    // shapes into their slices. Sprint 9 merge — used to be 2 calls.
    seedCursorsAtYesterday();
    mockReadDayInfo.mockResolvedValueOnce({
      activity: {
        daysAgo: 0,
        yearOfCentury: 25,
        month: 1,
        day: 21,
        totalSteps: 5000,
        totalKcal: 1500,
        totalStandingHours: 4,
        totalDistanceMeters: 3700,
      },
      sleep: {
        daysAgo: 0,
        yearOfCentury: 25,
        month: 1,
        day: 21,
        totalMinutes: 420,
        deepMinutes: 90,
        lightMinutes: 230,
        exerciseMinutes: 0,
      },
    });
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
    });
    expect(mockReadDayInfo).toHaveBeenCalledTimes(1);
    expect(useSleep.getState().recent).toHaveLength(1);
    expect(useActivity.getState().recentSteps).toHaveLength(1);
  });
});

describe('syncMultiVitals — failure isolation', () => {
  it('continues when HR step fails (Promise.allSettled isolation)', async () => {
    seedCursorsAtYesterday();
    mockReadHRHistory.mockRejectedValueOnce(new Error('hr_timeout'));
    mockReadSpO2History.mockResolvedValueOnce([
      { timestampSec: NOW_SEC - 3600, percent: 96, maxInWindow: 97, minInWindow: 95 },
    ]);
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
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

  it('surfaces a merged-step failure under both sleep + activity errors', async () => {
    // The merged DayInfo branch covers both vitals; when readDayInfo
    // rejects the orchestrator surfaces the same message under both
    // errors.sleep and errors.activity (D13 §3.3 step 7-8 coupling).
    seedCursorsAtYesterday();
    mockReadDayInfo.mockRejectedValueOnce(new Error('dayinfo_timeout'));
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.sleep).toBe('dayinfo_timeout');
    expect(result.errors.activity).toBe('dayinfo_timeout');
  });

  it('marks ok=false when /sync POST fails but step errors are still recorded', async () => {
    seedCursorsAtYesterday();
    mockReadHRHistory.mockResolvedValueOnce([
      { timestampSec: 1737420000, bpm: 65 },
    ]);
    mockPostMultiVitals.mockRejectedValueOnce(new Error('network'));
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
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
    seedCursorsAtYesterday();
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.inserted).toBeNull();
    expect(mockPostMultiVitals).not.toHaveBeenCalled();
  });
});

describe('syncMultiVitals — cursor dedup', () => {
  it('drops HR samples older than cursor.hr', async () => {
    seedCursorsAtYesterday();
    setVitalCursor(DEVICE_BLE_ID, 'hr', 1737422000);
    mockReadHRHistory.mockResolvedValueOnce([
      { timestampSec: 1737420000, bpm: 60 }, // older than cursor — drop
      { timestampSec: 1737423600, bpm: 65 }, // fresh
    ]);
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
    });
    expect(result.pulled.hr).toBe(1);
    expect(useHR.getState().recent[0].bpm).toBe(65);
    expect(getVitalCursor(DEVICE_BLE_ID).hr).toBe(1737423600);
  });

  it('always re-reads SpO2 even when cursor.spo2 is at today', async () => {
    // Bug fix 2026-05-08: the old behaviour short-circuited same-day
    // re-reads, which locked out new SpO2 samples that landed later
    // in the day. Now the read always fires; the slice dedupes.
    setVitalCursor(DEVICE_BLE_ID, 'spo2', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'sleep', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'activity', TODAY_LOCAL);
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
    });
    expect(mockReadSpO2History).toHaveBeenCalledTimes(1);
  });

  it('always re-reads activity even when cursor.activity is at today', async () => {
    // Bug fix 2026-05-08: the watch's day step total grows throughout
    // the day. Same-day lockout meant the first sync (often steps=0)
    // was the only chance to capture activity. Now the read always
    // fires; the slice dedupes by dayLocal so today's row is replaced.
    // Sleep stays locked out — last night's totals don't change once
    // captured.
    setVitalCursor(DEVICE_BLE_ID, 'spo2', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'sleep', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'activity', TODAY_LOCAL);
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
    });
    // Sleep is still locked out (cursor at today); activity always reads
    // → readDayInfo fires once for the activity-only day list.
    expect(mockReadDayInfo).toHaveBeenCalledTimes(1);
  });
});

describe('syncMultiVitals — multi-day backfill', () => {
  it('walks (cursor+1 .. today) for SpO2 when cursor is 3 days behind', async () => {
    // Cursor at 2025-01-18 (3 days behind today 2025-01-21). Backfill
    // list = ['2025-01-19', '2025-01-20', '2025-01-21']. Same-day rule
    // already includes today — no extra append.
    setVitalCursor(DEVICE_BLE_ID, 'spo2', '2025-01-18');
    setVitalCursor(DEVICE_BLE_ID, 'sleep', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'activity', TODAY_LOCAL);
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(mockReadSpO2History).toHaveBeenCalledTimes(3);
    // Final cursor advances all the way to today.
    expect(getVitalCursor(DEVICE_BLE_ID).spo2).toBe(TODAY_LOCAL);
  });

  it('caps the backfill window at maxBackfillDays even with an old cursor', async () => {
    // Cursor far in the past (>10 days). Cap at 10 days back.
    setVitalCursor(DEVICE_BLE_ID, 'spo2', '2024-12-01');
    setVitalCursor(DEVICE_BLE_ID, 'sleep', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'activity', TODAY_LOCAL);
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      maxBackfillDays: 10,
    });
    // Default cap = 10 days inclusive → today, today-1, ..., today-9.
    expect(mockReadSpO2History).toHaveBeenCalledTimes(10);
  });

  it('first-sync look-back: empty cursor pulls firstSyncDays inclusive of today', async () => {
    // Empty cursor (fresh device). With firstSyncDays=3, expect calls
    // for [today-2, today-1, today] across SpO2 + DayInfo branches.
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 3,
    });
    expect(mockReadSpO2History).toHaveBeenCalledTimes(3);
    // DayInfo branch: union of sleep-days [3 days] and activity-days
    // [3 days] = 3 unique days.
    expect(mockReadDayInfo).toHaveBeenCalledTimes(3);
  });

  it('advances cursor partially when a mid-loop day fails', async () => {
    // Day 1 succeeds, Day 2 throws — cursor should sit at Day 1 so the
    // next sync resumes from Day 2.
    setVitalCursor(DEVICE_BLE_ID, 'spo2', '2025-01-18'); // 3 days behind
    setVitalCursor(DEVICE_BLE_ID, 'sleep', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'activity', TODAY_LOCAL);
    mockReadSpO2History
      .mockResolvedValueOnce([
        { timestampSec: 1737336000, percent: 96, maxInWindow: 97, minInWindow: 95 },
      ])
      .mockRejectedValueOnce(new Error('spo2_timeout'));
    const result = await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    expect(result.errors.spo2).toBe('spo2_timeout');
    // Cursor advanced past day 1, NOT past day 2.
    expect(getVitalCursor(DEVICE_BLE_ID).spo2).toBe('2025-01-19');
  });

  it('walks (cursor+1 .. today) for sleep without re-reading cursor day', async () => {
    // Sleep does NOT use alwaysIncludeToday; cursor at yesterday →
    // backfill = [today]. cursor at today → backfill = [] → 0 calls.
    setVitalCursor(DEVICE_BLE_ID, 'spo2', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'activity', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'sleep', TODAY_LOCAL);
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
      firstSyncDays: 1,
    });
    // Activity always re-reads today → 1 dayInfo call. Sleep would
    // have skipped, but the merged step covers both.
    expect(mockReadDayInfo).toHaveBeenCalledTimes(1);
  });

  it('routes the SAME readDayInfo per day to both sleep and activity slices', async () => {
    // Three-day backfill over the merged branch — verifies one BLE
    // round-trip per day services both vitals.
    setVitalCursor(DEVICE_BLE_ID, 'spo2', TODAY_LOCAL);
    setVitalCursor(DEVICE_BLE_ID, 'sleep', '2025-01-18');
    setVitalCursor(DEVICE_BLE_ID, 'activity', '2025-01-18');
    mockReadDayInfo.mockResolvedValue({
      activity: {
        daysAgo: 0,
        yearOfCentury: 25,
        month: 1,
        day: 21,
        totalSteps: 4000,
        totalKcal: 1400,
        totalStandingHours: 3,
        totalDistanceMeters: 3000,
      },
      sleep: {
        daysAgo: 0,
        yearOfCentury: 25,
        month: 1,
        day: 21,
        totalMinutes: 400,
        deepMinutes: 80,
        lightMinutes: 220,
        exerciseMinutes: 0,
      },
    });
    await syncMultiVitals(fakeDevice, DEVICE_BLE_ID, DEVICE_META, {
      nowSec: NOW_SEC,
    });
    // Sleep days [2025-01-19, 2025-01-20, 2025-01-21] union activity
    // days [2025-01-19, 2025-01-20, 2025-01-21] = 3 unique days.
    expect(mockReadDayInfo).toHaveBeenCalledTimes(3);
  });
});

describe('computeBackfillDayList', () => {
  // Pure helper — exercised across the four per-vital rule combinations
  // so the table stays close to the orchestrator's call sites.
  const today = '2025-01-21';

  it('empty cursor + alwaysIncludeToday=true → last firstSyncDays inclusive', () => {
    expect(
      computeBackfillDayList('', today, {
        firstSyncDays: 3,
        maxBackfillDays: 10,
        inclusiveCursorDay: false,
        alwaysIncludeToday: true,
      }),
    ).toEqual(['2025-01-19', '2025-01-20', '2025-01-21']);
  });

  it('non-empty cursor (exclusive) + alwaysIncludeToday=true → cursor+1 .. today', () => {
    expect(
      computeBackfillDayList('2025-01-18', today, {
        firstSyncDays: 7,
        maxBackfillDays: 10,
        inclusiveCursorDay: false,
        alwaysIncludeToday: true,
      }),
    ).toEqual(['2025-01-19', '2025-01-20', '2025-01-21']);
  });

  it('cursor === today + alwaysIncludeToday=true → [today]', () => {
    expect(
      computeBackfillDayList(today, today, {
        firstSyncDays: 7,
        maxBackfillDays: 10,
        inclusiveCursorDay: false,
        alwaysIncludeToday: true,
      }),
    ).toEqual(['2025-01-21']);
  });

  it('cursor === today + alwaysIncludeToday=false (sleep) → []', () => {
    expect(
      computeBackfillDayList(today, today, {
        firstSyncDays: 7,
        maxBackfillDays: 10,
        inclusiveCursorDay: false,
        alwaysIncludeToday: false,
      }),
    ).toEqual([]);
  });

  it('inclusiveCursorDay=true (HR) re-reads the cursor day for intra-day catch-up', () => {
    expect(
      computeBackfillDayList('2025-01-19', today, {
        firstSyncDays: 7,
        maxBackfillDays: 10,
        inclusiveCursorDay: true,
        alwaysIncludeToday: true,
      }),
    ).toEqual(['2025-01-19', '2025-01-20', '2025-01-21']);
  });

  it('caps the look-back to maxBackfillDays even with an ancient cursor', () => {
    expect(
      computeBackfillDayList('2024-01-01', today, {
        firstSyncDays: 7,
        maxBackfillDays: 5,
        inclusiveCursorDay: false,
        alwaysIncludeToday: true,
      }),
    ).toEqual([
      '2025-01-17',
      '2025-01-18',
      '2025-01-19',
      '2025-01-20',
      '2025-01-21',
    ]);
  });
});

// Sprint 14.5 task 5 — applyDeviceConfig is the dirty-tracked
// writer that flushes Settings → watch (auto-HR / auto-SpO2 / user
// params / goals) on each sync. Closes the Sprint 7.5 stub.
describe('syncMultiVitals — applyDeviceConfig wiring (Sprint 14.5)', () => {
  beforeEach(() => {
    mockReadHRHistory.mockResolvedValue([]);
    mockReadSpO2History.mockResolvedValue([]);
    mockReadDayInfo.mockResolvedValue({ sleep: null, activity: null, calories: null });
    mockPostMultiVitals.mockReset();
    mockApplyDeviceConfig.mockReset();
    mockApplyDeviceConfig.mockResolvedValue({ ran: false, steps: [] });
  });

  it('calls applyDeviceConfig before the parallel pull', async () => {
    await syncMultiVitals(fakeDevice, 'AA:BB:CC:DD:EE:FF', { bleId: 'AA:BB:CC:DD:EE:FF', macSuffix: '0fee', name: 'U16', model: 'U16H' });
    expect(mockApplyDeviceConfig).toHaveBeenCalledTimes(1);
    expect(mockApplyDeviceConfig).toHaveBeenCalledWith(fakeDevice);
    // The pull steps still ran — config flush isn't a hard gate.
    expect(mockReadHRHistory).toHaveBeenCalled();
    expect(mockReadSpO2History).toHaveBeenCalled();
    expect(mockReadDayInfo).toHaveBeenCalled();
  });

  it('surfaces applyDeviceConfig.error in errors.deviceConfig but does not abort the pull', async () => {
    mockApplyDeviceConfig.mockResolvedValue({
      ran: true,
      steps: ['autoHr'],
      error: 'autoSpo2 failed: ble timeout',
    });
    const result = await syncMultiVitals(fakeDevice, 'AA:BB:CC:DD:EE:FF', { bleId: 'AA:BB:CC:DD:EE:FF', macSuffix: '0fee', name: 'U16', model: 'U16H' });
    expect(result.errors.deviceConfig).toBe('autoSpo2 failed: ble timeout');
    expect(mockReadHRHistory).toHaveBeenCalled();
    expect(mockReadSpO2History).toHaveBeenCalled();
  });

  it('an applyDeviceConfig throw is caught and recorded — pull still runs', async () => {
    mockApplyDeviceConfig.mockRejectedValue(new Error('unexpected snapshot crash'));
    const result = await syncMultiVitals(fakeDevice, 'AA:BB:CC:DD:EE:FF', { bleId: 'AA:BB:CC:DD:EE:FF', macSuffix: '0fee', name: 'U16', model: 'U16H' });
    expect(result.errors.deviceConfig).toBe('unexpected snapshot crash');
    expect(mockReadHRHistory).toHaveBeenCalled();
  });
});
