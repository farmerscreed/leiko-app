// dispatcher tests — Sprint 16.6 FUN-4.
//
// Covers the suppression decisions + scheduling-shape contract. The
// expo-notifications module is mocked at module level so the tests
// can run in the pure-Node Jest project without the native side
// loaded.

import type { LocalReading } from '../../../state/readings';

const cancelMock = jest.fn<Promise<void>, [string]>(async () => undefined);
const scheduleMock = jest.fn<Promise<string>, [Record<string, unknown>]>(
  async () => 'mock-identifier',
);
const getAllMock = jest.fn<Promise<Array<{ identifier?: string }>>, []>(
  async () => [],
);

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: () => getAllMock(),
  cancelScheduledNotificationAsync: (id: string) => cancelMock(id),
  scheduleNotificationAsync: (input: Record<string, unknown>) => scheduleMock(input),
}));

import {
  cancelLearnedTimeReminders,
  scheduleNextLearnedTimeReminder,
} from '../dispatcher';

function makeReadingAtLocal(
  day: number,
  hours: number,
  minutes: number,
  idx = 0,
): LocalReading {
  const sec = Math.floor(
    new Date(2026, 4 /* May */, day, hours, minutes).getTime() / 1000,
  );
  return {
    localId: `r-${idx}`,
    measuredAtSec: sec,
    systolic: 124,
    diastolic: 79,
    pulse: 64,
    deviceBleId: 'AA:BB',
    source: 'watch',
    classification: { tier: 'in_pattern' } as never,
    syncStatus: 'synced',
  } as unknown as LocalReading;
}

/** Build a tight habit cluster around 07:30 local across 14 days. */
// History of ~7:30 morning readings on days 13..1 — i.e. strictly
// BEFORE "today" (day 14), which every test below uses as `now`. The
// freshest reading is therefore yesterday, so the dispatcher's
// recent-reading suppression (a reading within the last 4h) does NOT
// fire. (Day 14's own reading would be in the future relative to
// now=06:00 and is intentionally excluded here; the dedicated
// "within the last 4 hours" test adds a fresh same-day reading itself.)
function habitualMornings(): LocalReading[] {
  const readings: LocalReading[] = [];
  for (let day = 13; day >= 1; day -= 1) {
    const drift = (day % 3) * 5;
    readings.push(makeReadingAtLocal(day, 7, 30 + drift, day));
  }
  return readings;
}

beforeEach(() => {
  cancelMock.mockClear();
  scheduleMock.mockClear();
  getAllMock.mockReset();
  getAllMock.mockResolvedValue([]);
});

describe('cancelLearnedTimeReminders', () => {
  it('cancels every scheduled notification whose identifier matches the prefix', async () => {
    getAllMock.mockResolvedValueOnce([
      { identifier: 'leiko.reminder.learned-time.2026-05-14' },
      { identifier: 'leiko.reminder.learned-time.2026-05-15' },
      { identifier: 'leiko.something.else' },
      { identifier: undefined },
    ]);
    await cancelLearnedTimeReminders();
    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(cancelMock).toHaveBeenCalledWith('leiko.reminder.learned-time.2026-05-14');
    expect(cancelMock).toHaveBeenCalledWith('leiko.reminder.learned-time.2026-05-15');
  });

  it('treats a thrown getAll as no-op', async () => {
    getAllMock.mockRejectedValueOnce(new Error('module not loaded'));
    await expect(cancelLearnedTimeReminders()).resolves.toBeUndefined();
    expect(cancelMock).not.toHaveBeenCalled();
  });
});

describe('scheduleNextLearnedTimeReminder', () => {
  it('skips with reason no_habit when readings are sparse', async () => {
    const result = await scheduleNextLearnedTimeReminder({
      readings: [makeReadingAtLocal(14, 7, 30)],
      parentLabel: 'Mum',
      isSelf: false,
      now: new Date(2026, 4, 14, 6, 0),
    });
    expect(result).toEqual({ scheduled: false, reason: 'no_habit' });
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('schedules a date trigger at habit + 30 min when the habit time is still ahead today', async () => {
    const result = await scheduleNextLearnedTimeReminder({
      readings: habitualMornings(),
      parentLabel: 'Mum',
      isSelf: false,
      now: new Date(2026, 4, 14, 6, 0),
    });
    expect(result.scheduled).toBe(true);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    const arg = scheduleMock.mock.calls[0]![0] as {
      identifier: string;
      content: { title: string; body: string };
      trigger: { type: string; date: Date };
    };
    expect(arg.identifier).toMatch(/^leiko\.reminder\.learned-time\./);
    expect(arg.trigger.type).toBe('date');
    expect(arg.trigger.date.getHours()).toBe(8);
    expect(arg.trigger.date.getMinutes()).toBe(0);
    expect(arg.content.body).toContain('7:30');
  });

  it('rolls over to tomorrow when habit + 30 has already passed today', async () => {
    const result = await scheduleNextLearnedTimeReminder({
      readings: habitualMornings(),
      parentLabel: 'Mum',
      isSelf: false,
      now: new Date(2026, 4, 14, 12, 0),
    });
    expect(result.scheduled).toBe(true);
    const arg = scheduleMock.mock.calls[0]![0] as {
      trigger: { date: Date };
    };
    expect(arg.trigger.date.getDate()).toBe(15);
  });

  it('skips when a reading was taken within the last 4 hours TODAY', async () => {
    const recent = habitualMornings();
    recent.unshift(makeReadingAtLocal(14, 5, 0, 99));
    const result = await scheduleNextLearnedTimeReminder({
      readings: recent,
      parentLabel: 'Mum',
      isSelf: false,
      now: new Date(2026, 4, 14, 6, 0),
    });
    expect(result).toEqual({ scheduled: false, reason: 'recent_reading_within_4h' });
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('uses self-buyer copy when isSelf is true', async () => {
    const result = await scheduleNextLearnedTimeReminder({
      readings: habitualMornings(),
      parentLabel: '',
      isSelf: true,
      now: new Date(2026, 4, 14, 6, 0),
    });
    expect(result.scheduled).toBe(true);
    const arg = scheduleMock.mock.calls[0]![0] as {
      content: { title: string; body: string };
    };
    expect(arg.content.title).toBe('Today is open.');
    expect(arg.content.body).toContain('You usually take your reading');
  });

  it('cancels prior reminders before scheduling a new one', async () => {
    getAllMock.mockResolvedValueOnce([
      { identifier: 'leiko.reminder.learned-time.2026-05-13' },
    ]);
    await scheduleNextLearnedTimeReminder({
      readings: habitualMornings(),
      parentLabel: 'Mum',
      isSelf: false,
      now: new Date(2026, 4, 14, 6, 0),
    });
    expect(cancelMock).toHaveBeenCalledWith('leiko.reminder.learned-time.2026-05-13');
  });
});
