import { computeDailyPulseCentral } from '../dailyPulseCentral';

const HOUR_MS = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('computeDailyPulseCentral — D13 §7.2 priority ladder', () => {
  describe('priority 1: fresh BP ≤ 8h old wins', () => {
    it('returns BP value formatted as systolic/diastolic', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 128, diastolic: 82, takenAtEpochMs: NOW - 2 * HOUR_MS },
        hr: { restingBpm: 62, sampledAtEpochMs: NOW - HOUR_MS },
        sleep: { totalMinutes: 444, sessionEndEpochMs: NOW - 6 * HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 8,
      });
      expect(out.value).toBe('128/82');
      expect(out.source).toBe('bp');
    });

    it('labels as "morning BP" before the morning cutoff', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 124, diastolic: 79, takenAtEpochMs: NOW - HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 7,
      });
      expect(out.label).toBe('morning BP');
    });

    it('labels as "latest BP" after the morning cutoff', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 124, diastolic: 79, takenAtEpochMs: NOW - HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 14,
      });
      expect(out.label).toBe('latest BP');
    });

    it('respects a custom morning cutoff hour', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 124, diastolic: 79, takenAtEpochMs: NOW - HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 10,
        morningCutoffHour: 9,
      });
      expect(out.label).toBe('latest BP');
    });

    it('rounds non-integer systolic/diastolic', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 127.6, diastolic: 81.4, takenAtEpochMs: NOW - HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 8,
      });
      expect(out.value).toBe('128/81');
    });
  });

  describe('priority 2: HR ≤ 12h old when BP is stale or missing', () => {
    it('falls through to HR when BP is older than 8h', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 124, diastolic: 79, takenAtEpochMs: NOW - 9 * HOUR_MS },
        hr: { restingBpm: 62, sampledAtEpochMs: NOW - HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.source).toBe('hr');
      expect(out.value).toBe('62');
      expect(out.label).toBe('resting HR');
    });

    it('falls through to HR when BP is missing entirely', () => {
      const out = computeDailyPulseCentral({
        hr: { restingBpm: 62, sampledAtEpochMs: NOW - HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.source).toBe('hr');
    });

    it('rounds non-integer bpm', () => {
      const out = computeDailyPulseCentral({
        hr: { restingBpm: 61.7, sampledAtEpochMs: NOW - HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.value).toBe('62');
    });
  });

  describe('priority 3: last night sleep when BP + HR are stale or missing', () => {
    it('falls through to sleep when BP + HR are stale', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 124, diastolic: 79, takenAtEpochMs: NOW - 9 * HOUR_MS },
        hr: { restingBpm: 62, sampledAtEpochMs: NOW - 13 * HOUR_MS },
        sleep: { totalMinutes: 444, sessionEndEpochMs: NOW - 4 * HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.source).toBe('sleep');
      expect(out.value).toBe('7h 24m');
      expect(out.label).toBe('last night');
    });

    it('formats short sleep with zero minutes correctly', () => {
      const out = computeDailyPulseCentral({
        sleep: { totalMinutes: 360, sessionEndEpochMs: NOW - 4 * HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.value).toBe('6h 0m');
    });

    it('skips sleep when totalMinutes is 0', () => {
      const out = computeDailyPulseCentral({
        sleep: { totalMinutes: 0, sessionEndEpochMs: NOW - 4 * HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.source).toBe('none');
    });
  });

  describe('priority 4: nothing at all', () => {
    it('returns the dash + "no readings yet today" when all are missing', () => {
      const out = computeDailyPulseCentral({
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.source).toBe('none');
      expect(out.value).toBe('—');
      expect(out.label).toBe('no readings yet today');
    });

    it('returns the dash when all sources are stale', () => {
      const out = computeDailyPulseCentral({
        bp: { systolic: 124, diastolic: 79, takenAtEpochMs: NOW - 24 * HOUR_MS },
        hr: { restingBpm: 62, sampledAtEpochMs: NOW - 24 * HOUR_MS },
        nowEpochMs: NOW,
        nowLocalHour: 9,
      });
      expect(out.source).toBe('none');
      expect(out.value).toBe('—');
    });
  });
});
