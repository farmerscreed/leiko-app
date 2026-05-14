// HR slice unit tests — Sprint 7.5.
//
// Bar:
//   - addPending writes to MMKV synchronously (offline-first)
//   - dedup on duplicate measuredAtSec replaces the row
//   - latest reads across pending + recent, ordered by measuredAtSec
//   - restingBpmToday computes the rolling-min average over the
//     22:00–06:00 UTC sleep window (interpreted as UTC for test
//     determinism; production uses TZ-aware nowSec)
//   - acceptSyncResult moves rows from pending to recent, drops dups,
//     respects RECENT_SAMPLES_CAP
//   - hydrate recovers pending from MMKV after a fresh store instance
//   - reset clears pending + recent + MMKV
//
// All values used in inputs are inline literals — analytics
// assertions only check vital_type, never bpm.

import { mmkv, STORAGE_KEYS } from '../../services/storage';
import { useHR } from '../hr';
import type { HRSample } from '../../types/vitals';

const SECONDS_PER_HOUR = 3600;

function makeSample(measuredAtSec: number, bpm: number, isSpotCheck = false): HRSample {
  return {
    measuredAtSec,
    bpm,
    sampleWindowSec: 30 * 60,
    motionState: 'rest',
    isSpotCheck,
  };
}

beforeEach(() => {
  mmkv.clearAll();
  useHR.getState().reset();
});

describe('useHR slice', () => {
  test('addPending writes synchronously to MMKV (offline-first)', () => {
    const before = mmkv.getString(STORAGE_KEYS.pendingHR);
    expect(before).toBeUndefined();
    useHR.getState().addPending(makeSample(1_700_000_000, 70));
    const after = mmkv.getString(STORAGE_KEYS.pendingHR);
    expect(after).toBeDefined();
    const rows = JSON.parse(after!) as HRSample[];
    expect(rows).toHaveLength(1);
    expect(rows[0].measuredAtSec).toBe(1_700_000_000);
  });

  test('addPending dedups on duplicate measuredAtSec — replaces existing row', () => {
    useHR.getState().addPending(makeSample(1_700_000_000, 70));
    useHR.getState().addPending(makeSample(1_700_000_000, 75));
    const pending = useHR.getState().pending;
    expect(pending).toHaveLength(1);
    expect(pending[0].bpm).toBe(75);
  });

  test('latest reads across pending + recent, ordered by measuredAtSec', () => {
    // Manually set recent to simulate a previously-synced row.
    useHR.setState({
      recent: [makeSample(1_700_000_000, 65)],
    });
    useHR.getState().addPending(makeSample(1_700_001_000, 72));
    expect(useHR.getState().latest()?.measuredAtSec).toBe(1_700_001_000);
    expect(useHR.getState().latest()?.bpm).toBe(72);
  });

  test('restingBpmToday — rolling-min over 22:00–06:00 UTC window', () => {
    // Anchor "today" at 2026-05-07 12:00:00 UTC (1746619200).
    // Sleep window for that morning: 2026-05-06 22:00 UTC → 2026-05-07 06:00 UTC.
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    const nightStart = Date.UTC(2026, 4, 6, 22, 0, 0) / 1000;
    // Five samples spaced 5 minutes apart, all within the window. The
    // 10-min rolling avg includes every sample whose measuredAtSec
    // falls in [windowEnd - 600, windowEnd]. Walking i=0..4:
    //   i=0: 1 sample → skipped (need >=2)
    //   i=1: t=300, window [-300, 300] → (60+58)/2 = 59
    //   i=2: t=600, window [0, 600]    → (60+58+56)/3 = 58
    //   i=3: t=900, window [300, 900]  → (58+56+70)/3 ≈ 61.33
    //   i=4: t=1200, window [600,1200] → (56+70+80)/3 ≈ 68.67
    //   min = 58.
    const samples = [
      makeSample(nightStart + 0,   60),
      makeSample(nightStart + 300, 58),
      makeSample(nightStart + 600, 56),
      makeSample(nightStart + 900, 70),
      makeSample(nightStart + 1200, 80),
    ];
    for (const s of samples) useHR.getState().addPending(s);
    const resting = useHR.getState().restingBpmToday(nowSec);
    expect(resting).toBe(58);
  });

  test('restingBpmToday returns null with <2 samples in window', () => {
    const nowSec = Date.UTC(2026, 4, 7, 12, 0, 0) / 1000;
    // One sample at 23:00 UTC the night before.
    const nightStart = Date.UTC(2026, 4, 6, 23, 0, 0) / 1000;
    useHR.getState().addPending(makeSample(nightStart, 60));
    expect(useHR.getState().restingBpmToday(nowSec)).toBeNull();
  });

  test('acceptSyncResult moves rows from pending to recent and persists', () => {
    const s1 = makeSample(1_700_000_000, 70);
    const s2 = makeSample(1_700_001_000, 72);
    useHR.getState().addPending(s1);
    useHR.getState().addPending(s2);
    useHR.getState().acceptSyncResult([String(s1.measuredAtSec)]);
    const state = useHR.getState();
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].measuredAtSec).toBe(s2.measuredAtSec);
    expect(state.recent).toHaveLength(1);
    expect(state.recent[0].measuredAtSec).toBe(s1.measuredAtSec);
    // Persisted to MMKV.
    const recentRaw = mmkv.getString(STORAGE_KEYS.recentHR);
    expect(recentRaw).toBeDefined();
    expect(JSON.parse(recentRaw!)).toHaveLength(1);
    // Pending buffer no longer holds s1.
    const pendingRaw = mmkv.getString(STORAGE_KEYS.pendingHR);
    expect(JSON.parse(pendingRaw!)).toHaveLength(1);
  });

  test('acceptSyncResult dedups against existing recent + respects cap', () => {
    // Pre-seed recent above the cap (200).
    const recent: HRSample[] = [];
    for (let i = 0; i < 199; i++) {
      recent.push(makeSample(1_700_000_000 - i * 60, 70));
    }
    useHR.setState({ recent });
    // Add 5 pending rows; 1 collides with the freshest recent.
    const collideSec = recent[0].measuredAtSec;
    const pending = [
      makeSample(collideSec, 80),                  // dup of recent[0]
      makeSample(1_700_001_000, 71),
      makeSample(1_700_002_000, 72),
      makeSample(1_700_003_000, 73),
      makeSample(1_700_004_000, 74),
    ];
    for (const s of pending) useHR.getState().addPending(s);
    useHR.getState().acceptSyncResult(pending.map((p) => String(p.measuredAtSec)));
    const state = useHR.getState();
    // 199 + 4 net new (dup dropped) = 203 → capped at 200.
    expect(state.recent.length).toBeLessThanOrEqual(200);
    // Freshest first: 1_700_004_000 leads.
    expect(state.recent[0].measuredAtSec).toBe(1_700_004_000);
    // No duplicate measuredAtSec in recent.
    const seen = new Set<number>();
    for (const r of state.recent) {
      expect(seen.has(r.measuredAtSec)).toBe(false);
      seen.add(r.measuredAtSec);
    }
  });

  test('hydrate recovers pending from MMKV after a fresh store instance', () => {
    useHR.getState().addPending(makeSample(1_700_000_000, 70));
    // Simulate a fresh store: drop in-memory state, re-hydrate.
    useHR.setState({ pending: [], recent: [] });
    useHR.getState().hydrate();
    expect(useHR.getState().pending).toHaveLength(1);
    expect(useHR.getState().pending[0].measuredAtSec).toBe(1_700_000_000);
  });

  test('reset clears pending + recent + MMKV', () => {
    useHR.getState().addPending(makeSample(1_700_000_000, 70));
    useHR.setState({ recent: [makeSample(1_699_999_000, 65)] });
    expect(mmkv.contains(STORAGE_KEYS.pendingHR)).toBe(true);
    useHR.getState().reset();
    expect(useHR.getState().pending).toEqual([]);
    expect(useHR.getState().recent).toEqual([]);
    expect(mmkv.contains(STORAGE_KEYS.pendingHR)).toBe(false);
    expect(mmkv.contains(STORAGE_KEYS.recentHR)).toBe(false);
  });

  // ---- Sprint 16.5e — server hydration ---------------------------------

  test('seedFromServer adds new samples + dedups by measuredAtSec', () => {
    const existing = makeSample(1_700_000_000, 70);
    useHR.setState({ recent: [existing] });
    const serverRows = [
      makeSample(1_700_000_000, 9999), // duplicate — should NOT replace
      makeSample(1_699_900_000, 65),
      makeSample(1_699_800_000, 62),
    ];
    const added = useHR.getState().seedFromServer(serverRows);
    expect(added).toBe(2);
    const recent = useHR.getState().recent;
    expect(recent).toHaveLength(3);
    const dup = recent.find((s) => s.measuredAtSec === 1_700_000_000);
    expect(dup?.bpm).toBe(70); // existing preserved
  });

  test('seedFromServer ignores rows already in pending', () => {
    useHR.getState().addPending(makeSample(1_700_000_000, 70));
    const added = useHR
      .getState()
      .seedFromServer([makeSample(1_700_000_000, 9999)]);
    expect(added).toBe(0);
    expect(useHR.getState().recent).toEqual([]);
  });

  test('seedFromServer sorts merged result newest-first', () => {
    const rows = [
      makeSample(1_699_800_000, 60),
      makeSample(1_700_000_000, 80),
      makeSample(1_699_900_000, 70),
    ];
    useHR.getState().seedFromServer(rows);
    const recent = useHR.getState().recent;
    expect(recent.map((s) => s.measuredAtSec)).toEqual([
      1_700_000_000,
      1_699_900_000,
      1_699_800_000,
    ]);
  });

  test('seedFromServer persists to MMKV', () => {
    useHR.getState().seedFromServer([makeSample(1_700_000_000, 70)]);
    const raw = mmkv.getString(STORAGE_KEYS.recentHR);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toHaveLength(1);
  });

  test('seedFromServer returns 0 on empty input', () => {
    useHR.setState({ recent: [makeSample(1_700_000_000, 70)] });
    expect(useHR.getState().seedFromServer([])).toBe(0);
    expect(useHR.getState().recent).toHaveLength(1);
  });
});

// Sanity: the brief asks for an explicit timezone-handling note.
// restingBpmToday treats the sleep window 22:00–06:00 in UTC because
// production samples arrive in TRUE UTC (post watchTimestampToUtcSec)
// and the user's IANA TZ never enters the slice — the dailyPulse hook
// + UI layer convert for display. Tests above all use UTC-anchored
// timestamps; if the policy changes, those expectations change too.
void SECONDS_PER_HOUR;
