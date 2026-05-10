// learnedTime tests — Sprint 12.5.

import {
  buildLearnedTimeReminderCopy,
  detectReadingHabit,
  formatLocalTime,
  formatLocalTime12h,
  HABIT_MAD_THRESHOLD_MIN,
  localMinutesFromMidnight,
  median,
  medianAbsoluteDeviation,
  roundToFifteen,
  shouldFireReminder,
} from '../learnedTime';
import type { LocalReading } from '../../../state/readings';

/**
 * Construct a LocalReading whose measuredAtSec, when fed through
 * `new Date(...)`'s LOCAL accessors, yields the requested HH:MM.
 * We use new Date(y, m, d, h, m) — JS interprets these args as
 * LOCAL time — so the resulting unix sec round-trips correctly
 * regardless of the test runner's TZ.
 */
function makeReadingAtLocal(day: number, hours: number, minutes: number, idx = 0): LocalReading {
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


// ── Pure helpers ──────────────────────────────────────────────────────

it('localMinutesFromMidnight returns local HH*60+MM for a unix sec', () => {
  const sec = Math.floor(new Date(2026, 4, 10, 7, 42).getTime() / 1000);
  expect(localMinutesFromMidnight(sec)).toBe(7 * 60 + 42);
});

it('localMinutesFromMidnight returns null on non-finite input', () => {
  expect(localMinutesFromMidnight(Number.NaN)).toBeNull();
  expect(localMinutesFromMidnight(Number.POSITIVE_INFINITY)).toBeNull();
});

it('median computes correctly across odd/even/empty', () => {
  expect(median([1, 2, 3])).toBe(2);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(median([])).toBeNaN();
});

it('medianAbsoluteDeviation reflects spread', () => {
  expect(medianAbsoluteDeviation([10, 10, 10, 10])).toBe(0);
  expect(medianAbsoluteDeviation([10, 12, 8, 14])).toBe(2);
});

it('roundToFifteen snaps to the nearest 15-minute slot', () => {
  expect(roundToFifteen(7 * 60 + 42)).toBe(7 * 60 + 45);
  expect(roundToFifteen(7 * 60 + 38)).toBe(7 * 60 + 45);
  expect(roundToFifteen(7 * 60 + 30)).toBe(7 * 60 + 30);
  expect(roundToFifteen(7 * 60 + 7)).toBe(7 * 60); // 7:00
});

it('formatLocalTime / formatLocalTime12h render correctly', () => {
  expect(formatLocalTime(7 * 60 + 45)).toBe('7:45');
  expect(formatLocalTime(13 * 60)).toBe('13:00');
  expect(formatLocalTime12h(7 * 60 + 45)).toBe('7:45');
  expect(formatLocalTime12h(13 * 60)).toBe('1:00');
  expect(formatLocalTime12h(0)).toBe('12:00');
});

// ── detectReadingHabit ────────────────────────────────────────────────

it('returns hasHabit=false when fewer than 7 samples', () => {
  const readings = Array.from({ length: 5 }, (_, i) =>
    makeReadingAtLocal(10 - i, 7, 42, i),
  );
  const r = detectReadingHabit(readings);
  expect(r.hasHabit).toBe(false);
  expect(r.sampleSize).toBe(5);
});

it('detects a tight habit around 7:45', () => {
  const times: Array<[number, number]> = [
    [7, 42], [7, 48], [7, 35], [7, 50], [7, 40], [7, 42], [7, 45],
    [7, 50], [7, 42], [7, 38], [7, 45], [7, 40], [7, 48], [7, 42],
  ];
  const readings = times.map(([hh, mm], i) => makeReadingAtLocal(20 - i, hh, mm, i));
  const r = detectReadingHabit(readings);
  expect(r.hasHabit).toBe(true);
  expect(r.habitualTimeMin).toBe(7 * 60 + 45);
  expect(r.madMinutes).toBeLessThanOrEqual(HABIT_MAD_THRESHOLD_MIN);
});

it('returns hasHabit=false when MAD > 90 minutes (no consistent time)', () => {
  const times: Array<[number, number]> = [
    [6, 0], [7, 30], [12, 0], [18, 0], [7, 0], [15, 0], [8, 30],
    [14, 0], [19, 0], [6, 30], [11, 0], [17, 0], [20, 0], [9, 0],
  ];
  const readings = times.map(([hh, mm], i) => makeReadingAtLocal(20 - i, hh, mm, i));
  const r = detectReadingHabit(readings);
  expect(r.hasHabit).toBe(false);
  expect(r.madMinutes).toBeGreaterThan(HABIT_MAD_THRESHOLD_MIN);
});

it('caps the sample at 30 readings (only the most recent count)', () => {
  const readings = Array.from({ length: 50 }, (_, i) =>
    makeReadingAtLocal(((i % 25) + 1), 7, 42, i),
  );
  const r = detectReadingHabit(readings);
  expect(r.sampleSize).toBe(30);
});

// ── shouldFireReminder ────────────────────────────────────────────────

const HABIT_745: ReturnType<typeof detectReadingHabit> = {
  hasHabit: true,
  habitualTimeMin: 7 * 60 + 45,
  madMinutes: 8,
  sampleSize: 14,
};

it('does not fire when the user has no habit', () => {
  const r = shouldFireReminder({
    habit: { hasHabit: false, habitualTimeMin: null, madMinutes: 100, sampleSize: 14 },
    nowLocalMin: 10 * 60,
    nowSec: 0,
    lastReadingSec: null,
    remindersFiredToday: 0,
    remindMeLaterCountThisWeek: 0,
  });
  expect(r.shouldFire).toBe(false);
  expect(r.reason).toBe('no_habit');
});

it('does not fire before the habit time + 30min window', () => {
  // Habit 7:45; reminder at 8:15. At 8:00 we should not fire yet.
  const r = shouldFireReminder({
    habit: HABIT_745,
    nowLocalMin: 8 * 60,
    nowSec: 0,
    lastReadingSec: null,
    remindersFiredToday: 0,
    remindMeLaterCountThisWeek: 0,
  });
  expect(r.shouldFire).toBe(false);
  expect(r.reason).toBe('before_reminder_window');
});

it('does not fire during quiet hours (22:00–07:00)', () => {
  const r = shouldFireReminder({
    habit: { ...HABIT_745, habitualTimeMin: 23 * 60 },
    nowLocalMin: 23 * 60 + 30,
    nowSec: 0,
    lastReadingSec: null,
    remindersFiredToday: 0,
    remindMeLaterCountThisWeek: 0,
  });
  expect(r.shouldFire).toBe(false);
  expect(r.reason).toBe('quiet_hours');
});

it('does not fire when last reading is within 4h', () => {
  const r = shouldFireReminder({
    habit: HABIT_745,
    nowLocalMin: 10 * 60,
    nowSec: 1_000_000,
    lastReadingSec: 1_000_000 - 2 * 60 * 60, // 2h ago
    remindersFiredToday: 0,
    remindMeLaterCountThisWeek: 0,
  });
  expect(r.shouldFire).toBe(false);
  expect(r.reason).toBe('recent_reading_within_4h');
});

it('does not fire when daily cap of 2 has been reached', () => {
  const r = shouldFireReminder({
    habit: HABIT_745,
    nowLocalMin: 10 * 60,
    nowSec: 0,
    lastReadingSec: null,
    remindersFiredToday: 2,
    remindMeLaterCountThisWeek: 0,
  });
  expect(r.shouldFire).toBe(false);
  expect(r.reason).toBe('daily_cap_reached');
});

it('does not fire when "remind me later" tapped twice this week', () => {
  const r = shouldFireReminder({
    habit: HABIT_745,
    nowLocalMin: 10 * 60,
    nowSec: 0,
    lastReadingSec: null,
    remindersFiredToday: 0,
    remindMeLaterCountThisWeek: 2,
  });
  expect(r.shouldFire).toBe(false);
  expect(r.reason).toBe('decayed_remind_me_later');
});

it('fires when all conditions are met', () => {
  const r = shouldFireReminder({
    habit: HABIT_745,
    nowLocalMin: 8 * 60 + 30, // 8:30, past the 8:15 reminder window
    nowSec: 1_000_000,
    lastReadingSec: 1_000_000 - 12 * 60 * 60, // last reading 12h ago
    remindersFiredToday: 0,
    remindMeLaterCountThisWeek: 0,
  });
  expect(r.shouldFire).toBe(true);
  expect(r.reason).toBeNull();
});

// ── Reminder copy ─────────────────────────────────────────────────────

it('caregiver-mode copy uses the parent label and 12-hour time', () => {
  const c = buildLearnedTimeReminderCopy({
    parentLabel: 'Mum',
    habitualTimeMin: 7 * 60 + 45,
  });
  expect(c.title).toBe("Mum's reading hasn't come in yet.");
  expect(c.body).toContain('Mum usually takes a reading by 7:45');
  expect(c.body).toContain("hasn't synced today");
});

it('self-buyer copy is in the second person', () => {
  const c = buildLearnedTimeReminderCopy({
    parentLabel: 'You',
    habitualTimeMin: 7 * 60 + 45,
    isSelf: true,
  });
  expect(c.body).toContain('You usually take your reading by 7:45');
});

it('copy is voice-rule clean (D11 §3 / D14 §5.3)', () => {
  const c = buildLearnedTimeReminderCopy({
    parentLabel: 'Mum',
    habitualTimeMin: 7 * 60 + 45,
  });
  for (const text of [c.title, c.body]) {
    expect(text).not.toMatch(/\bpatient\b|\bdiagnos|critical level|silent killer|biohack|streak|wellness/i);
    expect(text).not.toContain('!');
  }
});
