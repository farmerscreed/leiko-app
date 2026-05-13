// syncBacklog — Sprint 6 building block; cursor semantics rewired in Sprint 16.5a.
//
// On any successful BLE connect we run an incremental backlog pull:
// the watch buffers measurements while the app is closed (typical
// scenario: parent presses the BP button on the watch alone, no phone
// in the room), and we should surface every reading that's accumulated
// since the last successful sync.
//
// Sprint 6 ships the building block; Sprint 7's caregiver-home owns
// the orchestrator (cold start, foreground, BT_READY, etc.).
//
// QUERY MODEL — empirically verified 2026-05-12 (Sprint 16.5a Phase A):
//   The Sprint 6 cursor model used `readBPHistory(TS=lastSync, DIR=1)`
//   for incremental sync, assuming DIR=1 means "walk from latest
//   stopping at TS, returning newer-than-TS records." That's WRONG.
//   The empirical behaviour of DIR=1 is: return records strictly OLDER
//   than TS. Cursor-anchored queries therefore can NEVER return records
//   ≥ cursor — every BP cycle taken since the previous sync was
//   permanently invisible until a cursor reset.
//
//   Five captured traces 2026-05-12 (plans/captures/2026-05-12-capture-notes.md)
//   prove this end-to-end: with cursor=1778598235, the watch returned
//   first.ts=1778597282 (953s OLDER than cursor) even when fresh BP
//   cycles had landed in the watch's transferable register.
//
//   The fix: always query TS=0 (per protocol §4.5: "TS=0 returns
//   latest COUNT records, DIR ignored"). The in-memory `lastSync`
//   stays as a filter-only marker — it keeps the addPending writes
//   to records newer than the previous high-watermark. addPendingReading's
//   identity-dedupe (source, deviceBleId, measuredAtSec) handles the
//   already-ingested records that come back in every batch.
//
//   Cost: 50 × 16-byte packets per sync ≈ 800 bytes BLE traffic. The
//   filter saves the dedupe-overhead for the in-memory case.
//
// Single-batch syncBacklog stays the building block (used by the
// take-reading-sheet flow). Sprint 7 adds syncBacklogToCompletion
// below; with TS=0 the loop self-terminates after one iteration
// (no new records on the second pass; filter rejects everything;
// pulled=0; loop exits). Deep historical backfill (records older
// than the latest 50) is a separate concern handled in Phase 16.5c.

import { mmkv, STORAGE_KEYS } from '../storage';
import { readBPHistory } from '../ble/commands/readBPHistory';
import { setTime } from '../ble/commands/setTime';
import type { UrionDevice } from '../ble/UrionDevice';
import { useReadings } from '../../state/readings';
import { logger } from '../analytics/logger';
import type { VitalSyncCursor } from '../../types/vitals';

// BLE_TRACE — Sprint 16.5a Phase A forensic-capture instrumentation.
// See apps/mobile/src/services/ble/UrionDevice.ts for the convention.
const BLE_TRACE = typeof __DEV__ !== 'undefined' && __DEV__;

const BATCH_SIZE = 50;

// Cursor-staleness threshold for the Option C recovery branch. If the
// cursor is older than this AND the watch returns zero packets, we
// suspect the cursor was set in a long-ago session against state the
// watch no longer holds (clock change, ring-buffer eviction past the
// boundary, firmware reset). Reset to 0 and re-pull — at worst the
// next sync re-ingests one batch; at best we recover access to the
// watch's current storage. 180 days is comfortably wider than any
// realistic cuff cycle but tight enough that a normal user who synced
// last month doesn't trip the reset.
const CURSOR_STALENESS_THRESHOLD_SEC = 180 * 24 * 60 * 60;

// Watch firmware timezone quirk — per docs/_reference/U16PRO_protocol_en.pdf
// §4.5.5: the watch ALWAYS treats its wall clock as China-local
// (UTC+8) when serialising reading timestamps to Unix-seconds,
// regardless of what we pass to setTime(0x01). So a reading taken
// when the watch face shows 09:03 (which we set to phone-local
// time on connect) arrives as Unix-seconds for "09:03 China-local"
// = 01:03 UTC.
//
// To recover the true UTC second of capture: shift back by the
// China offset (subtract 8h to undo the firmware's interpretation),
// then add the user's local offset (re-interpret the wall clock as
// the user's actual timezone, not China). The net shift is
// `(China offset) − (user local offset)` seconds.
//
// Empirically verified 2026-05-07 in Lagos (UTC+1): raw watch
// timestamp was 7h behind real time, matching (8 − 1) = 7. Sprint 7
// will reconcile timezones server-side using the parent's stored
// IANA TZ; for Sprint 6 we resolve at the device.
const WATCH_FIRMWARE_OFFSET_SEC = 8 * 60 * 60;

export function watchTimestampToUtcSec(rawWatchSec: number): number {
  const phoneOffsetSec =
    -new Date(rawWatchSec * 1000).getTimezoneOffset() * 60;
  return rawWatchSec + WATCH_FIRMWARE_OFFSET_SEC - phoneOffsetSec;
}

// Per-device, per-vital sync cursor — Sprint 7.5 / D13 §3.4.
//
// Sprint 6 stored a single number per device (BP cursor) at
// STORAGE_KEYS.lastSyncByDevice. Sprint 7.5 widens this to a
// VitalSyncCursor object per device so HR / SpO2 / sleep / activity
// can advance independently.
//
// Migration is on-read: if a legacy entry is a bare number, it's
// treated as the bp cursor and the other vitals come up empty. The
// next write of any cursor flushes the migrated shape back. Empty
// strings ('' for the day cursors, 0 for hr) mean "no successful
// sync yet for this vital on this device" — the next sync pulls the
// widest available window per protocol defaults.
//
// Legacy getLastSyncSec / setLastSyncSec stay alive as thin BP-only
// wrappers so Sprint 6 callers (this file's syncBacklog, plus tests)
// don't need a same-PR rewire.

const EMPTY_CURSOR: VitalSyncCursor = Object.freeze({
  bp: 0,
  hr: 0,
  spo2: '',
  sleep: '',
  activity: '',
}) as VitalSyncCursor;

type CursorMap = Record<string, VitalSyncCursor>;

function normaliseCursorEntry(value: unknown): VitalSyncCursor {
  // Legacy: Sprint 6 stored a bare number per device.
  if (typeof value === 'number') {
    return { ...EMPTY_CURSOR, bp: value };
  }
  if (value && typeof value === 'object') {
    const obj = value as Partial<VitalSyncCursor>;
    return {
      bp: typeof obj.bp === 'number' ? obj.bp : 0,
      hr: typeof obj.hr === 'number' ? obj.hr : 0,
      spo2: typeof obj.spo2 === 'string' ? obj.spo2 : '',
      sleep: typeof obj.sleep === 'string' ? obj.sleep : '',
      activity: typeof obj.activity === 'string' ? obj.activity : '',
    };
  }
  return { ...EMPTY_CURSOR };
}

function readCursorMap(): CursorMap {
  const raw = mmkv.getString(STORAGE_KEYS.lastSyncByDevice);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: CursorMap = {};
    for (const [bleId, value] of Object.entries(parsed)) {
      out[bleId] = normaliseCursorEntry(value);
    }
    return out;
  } catch {
    return {};
  }
}

function writeCursorMap(map: CursorMap): void {
  mmkv.set(STORAGE_KEYS.lastSyncByDevice, JSON.stringify(map));
}

/** Get the full per-vital cursor for a device. Returns the empty
 * cursor (all zero/empty) when no sync has happened for this device. */
export function getVitalCursor(deviceBleId: string): VitalSyncCursor {
  return readCursorMap()[deviceBleId] ?? { ...EMPTY_CURSOR };
}

/** Update one vital's cursor for a device. The other vitals' cursors
 * are preserved. Per-sample vitals (bp, hr) take a unix-second number
 * in RAW watch-firmware format; per-day vitals (spo2, sleep, activity)
 * take a 'YYYY-MM-DD' string in user-local time. */
export function setVitalCursor(
  deviceBleId: string,
  vital: 'bp' | 'hr',
  timestampSec: number,
): void;
export function setVitalCursor(
  deviceBleId: string,
  vital: 'spo2' | 'sleep' | 'activity',
  dayLocal: string,
): void;
export function setVitalCursor(
  deviceBleId: string,
  vital: keyof VitalSyncCursor,
  value: number | string,
): void {
  const map = readCursorMap();
  const current = map[deviceBleId] ?? { ...EMPTY_CURSOR };
  // Type-safe at the call site via the overloads; the implementation
  // body merges through the discriminated union.
  (current as unknown as Record<string, number | string>)[vital] = value;
  map[deviceBleId] = current;
  writeCursorMap(map);
}

/** BP cursor, legacy shape. Thin wrapper over getVitalCursor.bp. */
export function getLastSyncSec(deviceBleId: string): number {
  return getVitalCursor(deviceBleId).bp;
}

/** BP cursor, legacy shape. Thin wrapper over setVitalCursor('bp'). */
export function setLastSyncSec(deviceBleId: string, timestampSec: number): void {
  setVitalCursor(deviceBleId, 'bp', timestampSec);
}

/** Reset every per-vital cursor for a device back to the empty default
 * (BP/HR → 0, day-cursors → ''). On the next sync the orchestrator
 * will re-pull every vital's full available history. Dev-only utility
 * for recovering when local MMKV got out of step with the watch's
 * storage (e.g. after an uninstall/reinstall that wiped readings but
 * the watch still holds the history). */
export function resetVitalCursors(deviceBleId: string): void {
  const map = readCursorMap();
  map[deviceBleId] = { ...EMPTY_CURSOR };
  writeCursorMap(map);
}

export interface BacklogResult {
  pulled: number;
  latestTimestampSec: number | null;
  /** Sprint 16.5b — oldest raw timestamp seen in THIS batch's
   *  readBPHistory response (regardless of whether it passed the cursor
   *  filter). Used by `syncBacklogToCompletion` to anchor the next
   *  backfill iteration walking backward via DIR=1. Null when the
   *  watch returned no records. */
  oldestTimestampSecInBatch: number | null;
}

/** Sprint 16.5b — pull a batch of BP records STRICTLY OLDER than
 *  `anchorTs` (the documented use for DIR=1). Used by
 *  `syncBacklogToCompletion` to walk backward through the watch's
 *  stored history beyond the latest 50 that the forward `syncBacklog`
 *  captures via TS=0. Does NOT touch the in-memory lastSync cursor —
 *  cursor is a forward-watermark only. Records are deduped at ingest
 *  by addPendingReading's `(source, deviceBleId, measuredAtSec)` key,
 *  so re-fetched records are safe. */
export interface BacklogBackwardResult {
  /** Raw count of records returned by readBPHistory (pre-dedupe). */
  pulled: number;
  /** Oldest raw timestamp in this batch. Caller anchors the next
   *  iteration at this value. Null when the watch returned nothing. */
  oldestTimestampSec: number | null;
}

export async function backfillBPHistoryOlderThan(
  device: UrionDevice,
  deviceBleId: string,
  anchorTs: number,
  options: { timeoutMs?: number } = {},
): Promise<BacklogBackwardResult> {
  if (anchorTs <= 0) {
    return { pulled: 0, oldestTimestampSec: null };
  }
  if (BLE_TRACE) {
    console.log(
      `[ble-trace] backfillBPHistoryOlderThan enter anchorTs=${anchorTs} (DIR=1 walk-backward)`,
    );
  }
  const readings = await readBPHistory(device, {
    sinceTimestampSec: anchorTs,
    direction: 'oldest_first', // DIR=1 — records strictly < anchorTs
    count: BATCH_SIZE,
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  if (BLE_TRACE) {
    console.log(
      `[ble-trace] backfillBPHistoryOlderThan returned ${readings.length} packet(s); ` +
        `first.ts=${readings[0]?.timestampSec ?? 'n/a'} ` +
        `last.ts=${readings[readings.length - 1]?.timestampSec ?? 'n/a'}`,
    );
  }
  if (readings.length === 0) {
    return { pulled: 0, oldestTimestampSec: null };
  }
  const addPending = useReadings.getState().addPendingReading;
  let oldest = readings[0].timestampSec;
  for (const r of readings) {
    addPending({
      measuredAtSec: watchTimestampToUtcSec(r.timestampSec),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      source: 'watch',
      deviceBleId,
    });
    if (r.timestampSec < oldest) oldest = r.timestampSec;
  }
  return { pulled: readings.length, oldestTimestampSec: oldest };
}

export async function syncBacklog(
  device: UrionDevice,
  deviceBleId: string,
  options: { timeoutMs?: number; skipSetTime?: boolean } = {},
): Promise<BacklogResult> {
  // Per docs/06-ble-protocol.md §4: write 0x01 (set time / language)
  // on EVERY successful reconnect before issuing any read. The watch
  // clock drifts; without this, future readings get stored with the
  // drifted timestamp which then breaks latest() ordering. Failure
  // here is non-fatal — the read still works, the timestamps may
  // just be off.
  if (!options.skipSetTime) {
    try {
      await setTime(device, { language: 'en' });
    } catch {
      // best-effort; clock will be wrong but reads still work
    }
  }
  let lastSync = getLastSyncSec(deviceBleId);
  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncBacklog enter deviceBleId=${deviceBleId} lastSync=${lastSync} (filter-only; query is TS=0)`,
    );
  }
  // Always query TS=0 — see file header for the rationale. The watch
  // returns its latest COUNT records (DIR is ignored when TS=0); the
  // in-memory `lastSync` filter below keeps just the ones we haven't
  // seen yet.
  let readings = await readBPHistory(device, {
    sinceTimestampSec: 0,
    direction: 'oldest_first',
    count: BATCH_SIZE,
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncBacklog readBPHistory returned ${readings.length} packet(s); ` +
        `first.ts=${readings[0]?.timestampSec ?? 'n/a'} ` +
        `last.ts=${readings[readings.length - 1]?.timestampSec ?? 'n/a'}`,
    );
  }
  // Sprint 12.5.1 Option C — auto-recover from a long-stale cursor
  // when the watch also returns nothing. Per U16PRO §4.5, the watch
  // returns the 0xFFFFFFFF terminator when DIR=1's TS anchor cannot
  // be found in storage (e.g. cursor older than the oldest record
  // still on the watch, OR cursor never matched any real record).
  // Reset to 0 — the documented "no anchor, return latest CC" path —
  // and re-pull in this same call. One-shot: if the retry also
  // returns zero, the watch is genuinely empty and we exit.
  if (readings.length === 0 && lastSync > 0) {
    const nowUnixSec = Math.floor(Date.now() / 1000);
    const cursorAgeSec = nowUnixSec - lastSync;
    if (cursorAgeSec > CURSOR_STALENESS_THRESHOLD_SEC) {
      console.log(
        `[sync-backlog] cursor ${lastSync} is ${Math.round(cursorAgeSec / 86400)}d old ` +
          `+ watch returned 0 packets; resetting cursor → 0 and retrying`,
      );
      logger.track('ble_cursor_reset', {
        deviceBleId,
        previousCursor: lastSync,
        newCursor: 0,
        gapSeconds: cursorAgeSec,
      });
      setLastSyncSec(deviceBleId, 0);
      lastSync = 0;
      readings = await readBPHistory(device, {
        sinceTimestampSec: 0,
        direction: 'oldest_first',
        count: BATCH_SIZE,
        timeoutMs: options.timeoutMs ?? 10_000,
      });
    }
  }
  if (readings.length === 0) {
    return { pulled: 0, latestTimestampSec: null, oldestTimestampSecInBatch: null };
  }
  // Track oldest in this batch (pre-cursor-filter) so the loop in
  // syncBacklogToCompletion can anchor backward-walk iterations.
  let oldestInBatch = readings[0].timestampSec;
  for (const r of readings) {
    if (r.timestampSec < oldestInBatch) oldestInBatch = r.timestampSec;
  }
  // De-dupe by cursor: when lastSync > 0, DIR=1 returns records OLDER
  // than the cursor (verified empirically + per U16PRO §4.5). We only
  // want records strictly newer than lastSync; anything ≤ cursor was
  // already ingested in a prior sync and addPendingReading would
  // dedupe it anyway, but filtering here avoids the redundant work.
  const fresh = lastSync > 0
    ? readings.filter((r) => r.timestampSec > lastSync)
    : readings;
  let newest = lastSync;
  const addPending = useReadings.getState().addPendingReading;
  for (const r of fresh) {
    addPending({
      measuredAtSec: watchTimestampToUtcSec(r.timestampSec),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      source: 'watch',
      deviceBleId,
    });
    // Cursor tracks the RAW watch timestamp so the next
    // sinceTimestampSec request matches the watch's storage format.
    if (r.timestampSec > newest) newest = r.timestampSec;
  }
  if (newest > lastSync) setLastSyncSec(deviceBleId, newest);
  if (BLE_TRACE) {
    console.log(
      `[ble-trace] syncBacklog exit pulled=${fresh.length} ` +
        `(filtered from ${readings.length}); cursor ${lastSync} → ${newest}`,
    );
  }
  // Per-row addPendingReading already emits reading_persisted with
  // the correct tier; no batch-summary event needed (the count is
  // derivable from the row events).
  return {
    pulled: fresh.length,
    latestTimestampSec: newest > 0 ? newest : null,
    oldestTimestampSecInBatch: oldestInBatch,
  };
}

