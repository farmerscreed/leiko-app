// Step timeline — steps per hour, built from the watch's running total.
//
// Why this file exists: the watch only reports a running step total for
// the day (0x07, docs/_reference/U16PRO_protocol_en.pdf §4.3). There is
// no per-hour or per-minute step command — Urion's own app has none
// either (docs/06-ble-protocol.md §3.2). But we read that total on every
// sync, so the difference between two reads is "steps taken between
// those two moments". Bucketing those differences into the hours they
// span gives a real, if coarse, movement timeline: the more often the
// phone syncs, the sharper it gets.
//
// Rules:
//   • The first read of a day has nothing to compare against, so the
//     steps before it stay unattributed (hourly sums to less than the
//     total). We never invent when they happened.
//   • A difference spanning several hours is spread across them in
//     proportion to time — honest about not knowing more. `spreadSec`
//     records how much of the day was filled that way.
//   • A total that goes DOWN (watch reset, purge) re-baselines without
//     touching the hours already filled.
//
// Pure functions + one MMKV-backed store keyed by watch. Tests live in
// __tests__/stepTimeline.test.ts.

import { mmkv } from '../storage';
import { epochSecForLocalHour } from '../../utils/userTz';

export interface StepTimeline {
  /** 'YYYY-MM-DD' in the user's timezone. */
  dayLocal: string;
  /** Running total at the last read. */
  lastTotal: number;
  /** When that read happened (unix sec UTC). */
  lastAtSec: number;
  /** Steps per local hour 00–23 that we could place in time. */
  hourly: number[];
  /** Seconds of the day whose steps were spread across a multi-hour gap
   *  between reads (0 = every step sits in the hour it was read in). */
  spreadSec: number;
}

const ONE_HOUR = 3600;

/** Start of each local hour 0..24 for the day, in unix sec UTC.
 *  Index 24 is the next midnight. Handles DST days (23/25 h). */
function hourEdges(dayLocal: string, tz: string): number[] {
  const edges: number[] = [];
  for (let h = 0; h < 24; h++) edges.push(epochSecForLocalHour(dayLocal, h, tz));
  const [y, m, d] = dayLocal.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  edges.push(epochSecForLocalHour(nextDay, 0, tz));
  return edges;
}

/**
 * Fold one new read of the day's running total into the timeline.
 * Returns a new object; `prev` is not mutated.
 */
export function advanceTimeline(
  prev: StepTimeline | null,
  dayLocal: string,
  total: number,
  atSec: number,
  tz: string,
): StepTimeline {
  if (!prev || prev.dayLocal !== dayLocal) {
    return { dayLocal, lastTotal: total, lastAtSec: atSec, hourly: new Array(24).fill(0), spreadSec: 0 };
  }
  const delta = total - prev.lastTotal;
  if (delta <= 0 || atSec <= prev.lastAtSec) {
    // Nothing new, or the watch's count went down (reset/purge):
    // re-baseline on the new total, keep the hours we already placed.
    return { ...prev, hourly: [...prev.hourly], lastTotal: total, lastAtSec: Math.max(atSec, prev.lastAtSec) };
  }

  const edges = hourEdges(dayLocal, tz);
  const dayStart = edges[0];
  const dayEnd = edges[24];
  // Only the part of the gap that falls inside this day counts.
  const from = Math.max(prev.lastAtSec, dayStart);
  const to = Math.min(atSec, dayEnd);
  const hourly = [...prev.hourly];
  let spreadSec = prev.spreadSec;

  if (to <= from) {
    // Whole gap outside the day (e.g. a read stamped after midnight for
    // yesterday's final total): put it in the last hour it could be in.
    const h = atSec >= dayEnd ? 23 : 0;
    hourly[h] += delta;
  } else {
    const span = to - from;
    // Distribute proportionally to overlap, using integer steps with the
    // remainder going to the latest hour so the sum is exact.
    let placed = 0;
    let lastHour = 0;
    for (let h = 0; h < 24; h++) {
      const overlap = Math.min(to, edges[h + 1]) - Math.max(from, edges[h]);
      if (overlap <= 0) continue;
      const share = Math.floor((delta * overlap) / span);
      hourly[h] += share;
      placed += share;
      lastHour = h;
    }
    hourly[lastHour] += delta - placed;
    if (span > ONE_HOUR) spreadSec += span;
  }
  return { dayLocal, lastTotal: total, lastAtSec: atSec, hourly, spreadSec };
}

/** Steps in the day's total that we could not place in an hour. */
export function unplacedSteps(t: StepTimeline, total: number): number {
  const placed = t.hourly.reduce((a, b) => a + b, 0);
  return Math.max(0, total - placed);
}

// ── Store ─────────────────────────────────────────────────────────────
// { [deviceBleId]: { [dayLocal]: StepTimeline } }, last 3 days per watch.

const KEY = 'leiko.activity.stepTimeline';
const KEEP_DAYS = 3;

type Store = Record<string, Record<string, StepTimeline>>;

function readStore(): Store {
  const raw = mmkv.getString(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

export function getTimeline(deviceBleId: string, dayLocal: string): StepTimeline | null {
  return readStore()[deviceBleId]?.[dayLocal] ?? null;
}

/** Record a read of `dayLocal`'s running total and return the updated
 *  timeline. */
export function recordStepTotal(
  deviceBleId: string,
  dayLocal: string,
  total: number,
  atSec: number,
  tz: string,
): StepTimeline {
  const store = readStore();
  const days = store[deviceBleId] ?? {};
  const next = advanceTimeline(days[dayLocal] ?? null, dayLocal, total, atSec, tz);
  days[dayLocal] = next;
  const keep = Object.keys(days).sort().slice(-KEEP_DAYS);
  store[deviceBleId] = Object.fromEntries(keep.map((d) => [d, days[d]]));
  mmkv.set(KEY, JSON.stringify(store));
  return next;
}
