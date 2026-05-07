// syncBacklog — Sprint 6 cursor-aware fetch.
//
// On any successful BLE connect we run an incremental backlog pull:
// the watch buffers measurements while the app is closed (typical
// scenario: parent presses the BP button on the watch alone, no phone
// in the room), and we should surface every reading that's accumulated
// since the last successful sync.
//
// Sprint 6 ships the building block; Sprint 7's caregiver-home will
// own the orchestrator (when to run this — cold start, foreground,
// BT_READY transition, etc.).
//
// Cursor model — per docs/_reference/U16PRO_protocol_en.pdf §4.5:
//   - lastSync = 0  → first sync; pull "latest 50" with TS=0, DIR=0/1
//   - lastSync > 0  → incremental; pull readings newer than lastSync
//                     with TS=lastSync, DIR=1 (backtrack from latest
//                     stopping at TS, return up to 50 newer ones)
//
// Single-batch syncBacklog stays the building block (used by the
// take-reading-sheet flow). Sprint 7 adds syncBacklogToCompletion
// below, which loops the cursor until the watch returns an empty
// page — needed when the watch has been buffering for >50 readings
// (parent's phone offline for a week scenario, intent memo §6.2).

import { mmkv, STORAGE_KEYS } from '../storage';
import { readBPHistory } from '../ble/commands/readBPHistory';
import { setTime } from '../ble/commands/setTime';
import type { UrionDevice } from '../ble/UrionDevice';
import { useReadings } from '../../state/readings';

const BATCH_SIZE = 50;

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

type CursorMap = Record<string, number>;

function readCursorMap(): CursorMap {
  const raw = mmkv.getString(STORAGE_KEYS.lastSyncByDevice);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as CursorMap) : {};
  } catch {
    return {};
  }
}

function writeCursorMap(map: CursorMap): void {
  mmkv.set(STORAGE_KEYS.lastSyncByDevice, JSON.stringify(map));
}

export function getLastSyncSec(deviceBleId: string): number {
  return readCursorMap()[deviceBleId] ?? 0;
}

export function setLastSyncSec(deviceBleId: string, timestampSec: number): void {
  const map = readCursorMap();
  map[deviceBleId] = timestampSec;
  writeCursorMap(map);
}

export interface BacklogResult {
  pulled: number;
  latestTimestampSec: number | null;
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
  const lastSync = getLastSyncSec(deviceBleId);
  const readings = await readBPHistory(device, {
    sinceTimestampSec: lastSync,
    direction: 'oldest_first',
    count: BATCH_SIZE,
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  if (readings.length === 0) {
    return { pulled: 0, latestTimestampSec: null };
  }
  // De-dupe: when lastSync > 0, the watch may include the cursor
  // record itself (boundary semantics vary by firmware). Filter out
  // anything ≤ cursor so we don't double-add a row that's already
  // in the readings store.
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
  // Per-row addPendingReading already emits reading_persisted with
  // the correct tier; no batch-summary event needed (the count is
  // derivable from the row events).
  return {
    pulled: fresh.length,
    latestTimestampSec: newest > 0 ? newest : null,
  };
}

