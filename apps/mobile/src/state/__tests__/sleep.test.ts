// Sleep slice unit tests — Sprint 7.5.
//
// Bar mirrors hr.test.ts. Aggregators under test: lastNightSession,
// recentSessions. Uses the sleepInPatternSession + sleepShortSession
// fixtures where they fit; inline construction otherwise.

import { mmkv, STORAGE_KEYS } from '../../services/storage';
import { useSleep } from '../sleep';
import type { SleepSession } from '../../types/vitals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fixtures = require('../../../../../tools/ble-mock/fixtures');

const SECONDS_PER_HOUR = 3600;

function makeSession(startSec: number, endSec: number, overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    sessionStartSec: startSec,
    sessionEndSec: endSec,
    sessionStartLocal: new Date(startSec * 1000).toISOString(),
    sessionEndLocal: new Date(endSec * 1000).toISOString(),
    totalMinutes: Math.round((endSec - startSec) / 60),
    deepMinutes: 90,
    remMinutes: 60,
    lightMinutes: 200,
    awakeMinutes: 5,
    awakeCount: 1,
    transitions: [],
    sleepScore: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mmkv.clearAll();
  useSleep.getState().reset();
});

describe('useSleep slice', () => {
  test('addPending writes synchronously to MMKV (offline-first)', () => {
    expect(mmkv.getString(STORAGE_KEYS.pendingSleep)).toBeUndefined();
    const session = makeSession(1_700_000_000, 1_700_000_000 + 7 * SECONDS_PER_HOUR);
    useSleep.getState().addPending(session);
    const raw = mmkv.getString(STORAGE_KEYS.pendingSleep);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  test('addPending dedups on duplicate sessionStartSec — replaces row', () => {
    const a = makeSession(1_700_000_000, 1_700_000_000 + 7 * SECONDS_PER_HOUR);
    const b = makeSession(1_700_000_000, 1_700_000_000 + 6 * SECONDS_PER_HOUR, {
      totalMinutes: 360,
    });
    useSleep.getState().addPending(a);
    useSleep.getState().addPending(b);
    const pending = useSleep.getState().pending;
    expect(pending).toHaveLength(1);
    expect(pending[0].totalMinutes).toBe(360);
  });

  test('lastNightSession returns the most recent session within 36h', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    // Session ending 8h ago (within window).
    const recentEnd = nowSec - 8 * SECONDS_PER_HOUR;
    const recent = makeSession(recentEnd - 7 * SECONDS_PER_HOUR, recentEnd);
    // Session ending 50h ago (outside window).
    const oldEnd = nowSec - 50 * SECONDS_PER_HOUR;
    const old = makeSession(oldEnd - 7 * SECONDS_PER_HOUR, oldEnd);
    useSleep.setState({ recent: [recent, old] });
    const last = useSleep.getState().lastNightSession(nowSec);
    expect(last?.sessionEndSec).toBe(recentEnd);
  });

  test('lastNightSession returns null when nothing is within 36h', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const oldEnd = nowSec - 50 * SECONDS_PER_HOUR;
    useSleep.setState({
      recent: [makeSession(oldEnd - 7 * SECONDS_PER_HOUR, oldEnd)],
    });
    expect(useSleep.getState().lastNightSession(nowSec)).toBeNull();
  });

  test('lastNightSession consolidates a fragmented night to the fullest session', () => {
    // Prod shape: the watch re-reported one night as overlapping fragments,
    // all ending at the same wake with drifting (later) starts and shrinking
    // totals. Must return the fullest (84 min), not the shortest (46).
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const wake = nowSec - 6 * SECONDS_PER_HOUR;
    const frags = [84, 72, 68, 50, 46].map((mins) =>
      makeSession(wake - mins * 60, wake, { totalMinutes: mins }),
    );
    useSleep.setState({ recent: frags });
    expect(useSleep.getState().lastNightSession(nowSec)?.totalMinutes).toBe(84);
  });

  test('recentSessions returns last N nights, oldest first', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const nights = [1, 3, 5, 30, 60].map((daysAgo) => {
      const end = nowSec - daysAgo * 24 * SECONDS_PER_HOUR;
      return makeSession(end - 7 * SECONDS_PER_HOUR, end);
    });
    useSleep.setState({ recent: nights });
    const last14 = useSleep.getState().recentSessions(nowSec, 14);
    // Only 1, 3, 5 days ago survive — oldest first means 5 → 3 → 1.
    expect(last14).toHaveLength(3);
    expect(last14[0].sessionEndSec).toBeLessThan(last14[1].sessionEndSec);
    expect(last14[2].sessionEndSec).toBe(nowSec - 24 * SECONDS_PER_HOUR);
  });

  test('acceptSyncResult moves rows pending → recent (dedup key = sessionStartSec)', () => {
    const a = makeSession(1_700_000_000, 1_700_000_000 + 7 * SECONDS_PER_HOUR);
    const b = makeSession(1_700_100_000, 1_700_100_000 + 7 * SECONDS_PER_HOUR);
    useSleep.getState().addPending(a);
    useSleep.getState().addPending(b);
    useSleep.getState().acceptSyncResult([String(a.sessionStartSec)]);
    expect(useSleep.getState().pending).toHaveLength(1);
    expect(useSleep.getState().recent).toHaveLength(1);
    expect(useSleep.getState().recent[0].sessionStartSec).toBe(a.sessionStartSec);
  });

  test('hydrate recovers pending from MMKV after a fresh store instance', () => {
    const session = makeSession(1_700_000_000, 1_700_000_000 + 7 * SECONDS_PER_HOUR);
    useSleep.getState().addPending(session);
    useSleep.setState({ pending: [], recent: [] });
    useSleep.getState().hydrate();
    expect(useSleep.getState().pending).toHaveLength(1);
  });

  test('reset clears pending + recent + MMKV', () => {
    useSleep.getState().addPending(
      makeSession(1_700_000_000, 1_700_000_000 + 7 * SECONDS_PER_HOUR),
    );
    useSleep.getState().reset();
    expect(useSleep.getState().pending).toEqual([]);
    expect(useSleep.getState().recent).toEqual([]);
    expect(mmkv.contains(STORAGE_KEYS.pendingSleep)).toBe(false);
    expect(mmkv.contains(STORAGE_KEYS.recentSleep)).toBe(false);
  });

  test('fixture sleepInPatternSession round-trips through addPending', () => {
    const session = fixtures.sleepInPatternSession({
      seed: 42,
      sessionEndSec: 1_700_007_200,
    });
    useSleep.getState().addPending(session);
    expect(useSleep.getState().pending).toHaveLength(1);
    expect(useSleep.getState().pending[0].totalMinutes).toBe(444);
  });
});
