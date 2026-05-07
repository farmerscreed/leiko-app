// pendingVitalBuffer — Sprint 7.5.
//
// Verifies the offline-first guarantee per CLAUDE.md data rule + D13
// §5.1: a sample passed to `append()` MUST land in MMKV synchronously
// before any subsequent statement runs. The other tests cover the
// dedup + corrupt-JSON recovery paths.

import { mmkv } from '../storage';
import { createPendingVitalBuffer } from '../pendingVitalBuffer';

interface TestSample {
  id: string;
  measuredAtSec: number;
  bpm: number;
}

const STORAGE_KEY = 'leiko.test.pending.hr';

const make = () =>
  createPendingVitalBuffer<TestSample>({
    storageKey: STORAGE_KEY,
    getKey: (s) => `${s.id}:${s.measuredAtSec}`,
  });

beforeEach(() => {
  mmkv.remove(STORAGE_KEY);
});

describe('pendingVitalBuffer', () => {
  test('append writes to MMKV synchronously (offline-first guarantee)', () => {
    const buffer = make();
    expect(mmkv.getString(STORAGE_KEY)).toBeUndefined();
    buffer.append({ id: 'a', measuredAtSec: 100, bpm: 70 });
    // The next statement reads MMKV directly. If append() were async or
    // deferred, this would be empty — the offline-first rule forbids
    // exactly that scenario.
    const raw = mmkv.getString(STORAGE_KEY);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toEqual([{ id: 'a', measuredAtSec: 100, bpm: 70 }]);
  });

  test('append dedups by getKey — same key replaces existing row', () => {
    const buffer = make();
    buffer.append({ id: 'a', measuredAtSec: 100, bpm: 70 });
    buffer.append({ id: 'a', measuredAtSec: 100, bpm: 72 }); // same key, fresher value
    const all = buffer.readAll();
    expect(all).toHaveLength(1);
    expect(all[0].bpm).toBe(72);
  });

  test('append preserves ordering for distinct keys', () => {
    const buffer = make();
    buffer.append({ id: 'a', measuredAtSec: 100, bpm: 70 });
    buffer.append({ id: 'b', measuredAtSec: 200, bpm: 75 });
    buffer.append({ id: 'c', measuredAtSec: 300, bpm: 68 });
    expect(buffer.readAll().map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  test('replace overwrites the entire pending list', () => {
    const buffer = make();
    buffer.append({ id: 'a', measuredAtSec: 100, bpm: 70 });
    buffer.append({ id: 'b', measuredAtSec: 200, bpm: 75 });
    buffer.replace([{ id: 'c', measuredAtSec: 300, bpm: 68 }]);
    expect(buffer.readAll()).toEqual([{ id: 'c', measuredAtSec: 300, bpm: 68 }]);
  });

  test('removeByKey drops one entry; non-matching key is no-op', () => {
    const buffer = make();
    buffer.append({ id: 'a', measuredAtSec: 100, bpm: 70 });
    buffer.append({ id: 'b', measuredAtSec: 200, bpm: 75 });
    buffer.removeByKey('a:100');
    expect(buffer.readAll().map((s) => s.id)).toEqual(['b']);
    buffer.removeByKey('does-not-exist');
    expect(buffer.readAll().map((s) => s.id)).toEqual(['b']);
  });

  test('readAll returns [] when key missing', () => {
    expect(make().readAll()).toEqual([]);
  });

  test('readAll recovers from corrupt JSON without throwing', () => {
    mmkv.set(STORAGE_KEY, 'not-json{[');
    expect(make().readAll()).toEqual([]);
  });

  test('readAll returns [] when the stored blob is not an array', () => {
    mmkv.set(STORAGE_KEY, JSON.stringify({ id: 'a', bpm: 70 }));
    expect(make().readAll()).toEqual([]);
  });

  test('clear removes the MMKV key', () => {
    const buffer = make();
    buffer.append({ id: 'a', measuredAtSec: 100, bpm: 70 });
    expect(mmkv.contains(STORAGE_KEY)).toBe(true);
    buffer.clear();
    expect(mmkv.contains(STORAGE_KEY)).toBe(false);
  });
});
