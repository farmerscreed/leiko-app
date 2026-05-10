// Multi-vitals sync pipeline — Sprint 7.5 / D13 §3.3, multi-day
// backfill added in Sprint 9 / D13 §3.4.
//
// Runs AFTER syncBacklogToCompletion (BP path) on every successful
// reconnect. Implements steps 5–8 of the D13 §3.3 sequence:
//   1. setTime                          (handled by syncBacklog)
//   2. setUserParams (dirty)             (stub for Sprint 7.5 — Settings UI lands later)
//   3. setGoals (dirty)                  (stub for Sprint 7.5)
//   4. readBPHistory                     (handled by syncBacklog)
//   5. readHRHistory                     ← here, looped per missing day
//   6. readSpO2History                   ← here, looped per missing day
//   7-8. readDayInfo (sleep + activity)  ← here, ONE call per day routed to both slices
//
// Failures are isolated via Promise.allSettled across the three step
// branches (HR, SpO2, DayInfo); one branch's failure does not block
// the others. Within a branch, the per-day loop advances the cursor
// after each successful day so partial backfills resume on the next
// reconnect.
//
// After all reads settle, the pipeline batches the slices' pending
// arrays into a single MultiVitalsPayload and posts to /sync. On
// success, each slice's acceptSyncResult moves rows from pending →
// recent and clears the corresponding MMKV pending entries. On
// failure, samples stay in pending; the next reconnect retries the
// network leg (the per-vital cursor already advanced, so the watch
// won't be re-read).
//
// Backfill rules (per vital):
//   • HR: cursor.hr is a watch-firmware second; backfill list includes
//     cursor's own day so intra-day samples newer than cursor.hr can be
//     picked up. Per-sample dedup via cursor.hr threshold + the slice's
//     measuredAtSec dedup. Today is always re-read.
//   • SpO2: cursor.spo2 is YYYY-MM-DD of last fully-synced day; backfill
//     list is (cursor+1 .. yesterday) plus today (always re-read; same-
//     day samples accumulate as the day progresses).
//   • Sleep: cursor.sleep is YYYY-MM-DD; backfill list is (cursor+1 ..
//     today). Last-night totals don't change once captured, so when
//     cursor === today we skip — no always-include-today rule.
//   • Activity: cursor.activity is YYYY-MM-DD; backfill list is
//     (cursor+1 .. yesterday) plus today (today's step total grows
//     throughout the day).
// The three day-cursor vitals share a single readDayInfo per day
// (request returns both sleep + activity reply packets) — the union
// of sleep-days and activity-days drives the loop.
//
// Sprint 7.5 simplifications still in force (flagged for follow-up
// sprints):
//   • Sleep session boundaries are synthesized from totalMinutes (the
//     0x07 reply doesn't expose start/end). sessionEnd = day 08:00 UTC,
//     sessionStart = sessionEnd - totalMinutes. Score's efficiency
//     component is therefore 1.0 on real-watch data — flagged in D13
//     §15.4 Q-D13-3.
//   • Activity hourly[24] = zeros. Per-hour distribution requires a
//     different ingest path (raw step samples via 0x73 0x04 notify) —
//     to be wired by a later sprint.
//   • setUserParams + setGoals dirty-checks always return false for
//     now; the dirty-tracker hooks into Settings UI when it lands.
//
// Per CLAUDE.md data rule: counts only in analytics events.

import type { UrionDevice } from '../ble/UrionDevice';
import { readHRHistory } from '../ble/commands/readHRHistory';
import { readSpO2History } from '../ble/commands/readSpO2History';
import { readDayInfo } from '../ble/commands/readDayInfo';
import {
  getVitalCursor,
  setVitalCursor,
  watchTimestampToUtcSec,
} from './syncBacklog';
import { postMultiVitals, isPayloadEmpty } from './postMultiVitals';
import { applyDeviceConfig } from './applyDeviceConfig';
import { forwardMultiVitalsToPlatform } from '../health-platform/syncBridge';
import { useHR } from '../../state/hr';
import { useSpO2 } from '../../state/spo2';
import { useSleep } from '../../state/sleep';
import { useActivity } from '../../state/activity';
import { logger } from '../analytics/logger';
import type {
  HRSample,
  SpO2Sample,
  SleepSession,
  ActivityDay,
  CaloriesDay,
  DeviceMeta,
  MultiVitalsPayload,
  SleepStage,
} from '../../types/vitals';

const APP_VERSION = '0.0.1'; // bumped via package.json on release
const HR_DEFAULT_WINDOW_SEC = 30 * 60;
const SPO2_DEFAULT_WINDOW_SEC = 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

/** First-connect look-back window. The watch's protocol §4.3 supports
 *  daysAgo up to 10; we default to 7 days so fresh users see a working
 *  Trends baseline immediately while staying inside the protocol cap. */
export const DEFAULT_FIRST_SYNC_DAYS = 7;

/** Hard cap on backfill window — matches U16PRO §4.3 daysAgo support. */
export const MAX_BACKFILL_DAYS = 10;

export interface SyncMultiVitalsOptions {
  /** Override the wall-clock used for "today" — test seam. */
  nowSec?: number;
  /** Days to look back when a vital's cursor is empty (first connect).
   *  Default DEFAULT_FIRST_SYNC_DAYS. Capped at maxBackfillDays. */
  firstSyncDays?: number;
  /** Hard ceiling on the look-back window. Default MAX_BACKFILL_DAYS. */
  maxBackfillDays?: number;
}

export interface SyncMultiVitalsResult {
  /** True when every step succeeded. False if ANY of steps 5–8 failed
   *  OR the /sync POST failed; per-step errors collected in `errors`. */
  ok: boolean;
  /** Per-step error messages, keyed by step name. Empty when ok=true. */
  errors: Record<string, string>;
  /** Counts pulled from the watch (BEFORE dedup against cursor). */
  pulled: { hr: number; spo2: number; sleep: number; activity: number };
  /** Counts inserted server-side (post /sync). null when /sync was
   *  not called (empty payload). */
  inserted: { bp: number; hr: number; spo2: number; sleep: number; steps: number; calories: number } | null;
}

// ────────────────────────────────────────────────────────────────────
// Date helpers — UTC-anchored to match the slice aggregators. The
// watch-firmware-shift moves per-sample timestamps to TRUE UTC at
// ingest, so per-day boundaries computed in UTC produce user-local
// answers when the user's TZ matches the phone's TZ at capture time.

function dayLocalFromNow(nowSec: number): string {
  return new Date(nowSec * 1000).toISOString().slice(0, 10);
}

function dayLocalFromBcd(yc: number, month: number, day: number): string {
  const yyyy = 2000 + yc;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function unixSecFromDayLocal(dayLocal: string): number {
  return Math.floor(new Date(`${dayLocal}T00:00:00Z`).getTime() / 1000);
}

/** Add (or subtract) whole days to a YYYY-MM-DD string. UTC math. */
function addDays(dayLocal: string, n: number): string {
  const ms = new Date(`${dayLocal}T00:00:00Z`).getTime() + n * SECONDS_PER_DAY * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD from start to end. Empty when start > end. */
function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** Whole-day distance from `earlier` to `later`. Used to derive the
 *  watch's `daysAgo` argument for any target day. */
function countDaysBetween(earlier: string, later: string): number {
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / (SECONDS_PER_DAY * 1000));
}

interface DayListOpts {
  firstSyncDays: number;
  maxBackfillDays: number;
  /** Include cursor's own day in the list. HR uses true (intra-day
   *  samples newer than cursor.hr can still arrive on cursor's day);
   *  day-cursor vitals use false (cursor's day is fully synced). */
  inclusiveCursorDay: boolean;
  /** Append today regardless of cursor. SpO2 / Activity / HR use true
   *  (same-day data grows). Sleep uses false (last-night totals don't
   *  change once captured). */
  alwaysIncludeToday: boolean;
}

/** Compute the inclusive list of YYYY-MM-DD days the orchestrator
 *  should pull for a given vital. Empty list = nothing to do. */
export function computeBackfillDayList(
  cursorDayLocal: string,
  todayLocal: string,
  opts: DayListOpts,
): string[] {
  const earliestAllowed = addDays(todayLocal, -(opts.maxBackfillDays - 1));
  let start: string;
  if (!cursorDayLocal) {
    start = addDays(todayLocal, -(opts.firstSyncDays - 1));
  } else {
    start = opts.inclusiveCursorDay
      ? cursorDayLocal
      : addDays(cursorDayLocal, 1);
  }
  if (start < earliestAllowed) start = earliestAllowed;

  let days: string[] = [];
  if (start <= todayLocal) {
    days = enumerateDays(start, todayLocal);
  }
  if (
    opts.alwaysIncludeToday &&
    (days.length === 0 || days[days.length - 1] !== todayLocal)
  ) {
    days.push(todayLocal);
  }
  return days;
}

function resolveBackfillOptions(
  options: SyncMultiVitalsOptions,
): { firstSyncDays: number; maxBackfillDays: number } {
  const maxBackfillDays = Math.max(
    1,
    Math.min(options.maxBackfillDays ?? MAX_BACKFILL_DAYS, MAX_BACKFILL_DAYS),
  );
  const firstSyncDays = Math.max(
    1,
    Math.min(options.firstSyncDays ?? DEFAULT_FIRST_SYNC_DAYS, maxBackfillDays),
  );
  return { firstSyncDays, maxBackfillDays };
}

// ────────────────────────────────────────────────────────────────────
// Per-vital read steps. Each pushes to the matching slice's pending
// buffer (synchronous MMKV write — offline-first durability) and
// advances the per-vital cursor on success. Returns the count of
// samples pulled.

async function syncHRStep(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
  options: SyncMultiVitalsOptions,
): Promise<number> {
  const { firstSyncDays, maxBackfillDays } = resolveBackfillOptions(options);
  const todayLocal = dayLocalFromNow(nowSec);
  const cursor = getVitalCursor(deviceBleId);

  const cursorDayLocal =
    cursor.hr > 0
      ? dayLocalFromNow(watchTimestampToUtcSec(cursor.hr))
      : '';

  const days = computeBackfillDayList(cursorDayLocal, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: true,
    alwaysIncludeToday: true,
  });

  const addPending = useHR.getState().addPending;
  let newestRaw = cursor.hr;
  let totalPulled = 0;

  for (const day of days) {
    const samples = await readHRHistory(device, {
      dayTimestampSec: unixSecFromDayLocal(day),
    });
    // Sample-level dedup: keep only samples newer than cursor.hr.
    const fresh =
      cursor.hr > 0
        ? samples.filter((s) => s.timestampSec > cursor.hr)
        : samples;
    for (const s of fresh) {
      const sample: HRSample = {
        measuredAtSec: watchTimestampToUtcSec(s.timestampSec),
        bpm: s.bpm,
        sampleWindowSec: HR_DEFAULT_WINDOW_SEC,
        // The 0x15 history packet does not expose motion-state per sample.
        // Classifier's sensor-error fallback ignores motion='unknown' for
        // baseline computation but still classifies extreme values.
        motionState: 'unknown',
        isSpotCheck: false,
      };
      addPending(sample);
      if (s.timestampSec > newestRaw) newestRaw = s.timestampSec;
    }
    totalPulled += fresh.length;
  }

  if (newestRaw > cursor.hr) {
    setVitalCursor(deviceBleId, 'hr', newestRaw);
  }
  return totalPulled;
}

async function syncSpO2Step(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
  options: SyncMultiVitalsOptions,
): Promise<number> {
  const { firstSyncDays, maxBackfillDays } = resolveBackfillOptions(options);
  const todayLocal = dayLocalFromNow(nowSec);
  const cursor = getVitalCursor(deviceBleId);

  const days = computeBackfillDayList(cursor.spo2, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: false,
    alwaysIncludeToday: true,
  });

  const addPending = useSpO2.getState().addPending;
  let totalPulled = 0;

  for (const day of days) {
    const samples = await readSpO2History(device, {
      dayTimestampSec: unixSecFromDayLocal(day),
    });
    for (const s of samples) {
      const sample: SpO2Sample = {
        measuredAtSec: watchTimestampToUtcSec(s.timestampSec),
        percent: s.percent,
        maxInWindow: s.maxInWindow,
        minInWindow: s.minInWindow,
        sampleWindowSec: SPO2_DEFAULT_WINDOW_SEC,
        isSpotCheck: false,
        // 0x2D doesn't expose perfusion index per sample.
        perfusionIndex: null,
      };
      addPending(sample);
    }
    totalPulled += samples.length;
    // Advance per-day so a mid-loop failure leaves a resumable cursor.
    setVitalCursor(deviceBleId, 'spo2', day);
  }
  return totalPulled;
}

/** Combined sleep + activity step. The 0x07 watch request returns both
 *  reply packets, so calling readDayInfo once per day services both
 *  vitals. Day list is the union of sleep-days and activity-days. */
async function syncDayInfoStep(
  device: UrionDevice,
  deviceBleId: string,
  nowSec: number,
  options: SyncMultiVitalsOptions,
): Promise<{ sleep: number; activity: number }> {
  const { firstSyncDays, maxBackfillDays } = resolveBackfillOptions(options);
  const todayLocal = dayLocalFromNow(nowSec);
  const cursor = getVitalCursor(deviceBleId);

  const sleepDays = computeBackfillDayList(cursor.sleep, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: false,
    alwaysIncludeToday: false,
  });
  const activityDays = computeBackfillDayList(cursor.activity, todayLocal, {
    firstSyncDays,
    maxBackfillDays,
    inclusiveCursorDay: false,
    alwaysIncludeToday: true,
  });

  const sleepDaySet = new Set(sleepDays);
  const activityDaySet = new Set(activityDays);
  const allDays = Array.from(
    new Set<string>([...sleepDays, ...activityDays]),
  ).sort();

  let sleepCount = 0;
  let activityCount = 0;

  for (const day of allDays) {
    const daysAgo = countDaysBetween(day, todayLocal);
    const info = await readDayInfo(device, { daysAgo });

    if (sleepDaySet.has(day)) {
      if (info.sleep && info.sleep.totalMinutes > 0) {
        const dayLocal = dayLocalFromBcd(
          info.sleep.yearOfCentury,
          info.sleep.month,
          info.sleep.day,
        );
        const dayStart = unixSecFromDayLocal(dayLocal);
        // Synthesize session boundaries — the 0x07 reply doesn't expose
        // start/end. sessionEnd = day 08:00 UTC (proxy for "this morning's
        // wake"); sessionStart = sessionEnd - totalMinutes. Tracked in D13
        // §15.4 Q-D13-3.
        const sessionEndSec = dayStart + 8 * 3600;
        const sessionStartSec = sessionEndSec - info.sleep.totalMinutes * 60;
        const session: SleepSession = {
          sessionStartSec,
          sessionEndSec,
          sessionStartLocal: new Date(sessionStartSec * 1000).toISOString(),
          sessionEndLocal: new Date(sessionEndSec * 1000).toISOString(),
          totalMinutes: info.sleep.totalMinutes,
          deepMinutes: info.sleep.deepMinutes,
          remMinutes: 0, // 0x07 doesn't expose REM; classifier handles 0 gracefully
          lightMinutes: info.sleep.lightMinutes,
          awakeMinutes: 0,
          awakeCount: 0,
          transitions: [] as { atSec: number; stage: SleepStage }[],
          sleepScore: 0, // computed by classifier downstream
        };
        useSleep.getState().addPending(session);
        sleepCount += 1;
      }
      setVitalCursor(deviceBleId, 'sleep', day);
    }

    if (activityDaySet.has(day)) {
      if (info.activity) {
        const dayLocal = dayLocalFromBcd(
          info.activity.yearOfCentury,
          info.activity.month,
          info.activity.day,
        );
        const dayStart = unixSecFromDayLocal(dayLocal);
        const activityDay: ActivityDay = {
          dayLocal,
          measuredAtSec: dayStart,
          totalSteps: info.activity.totalSteps,
          targetSteps: 6000, // D13 §15.4 Q-D13-1 default; orchestrator overrides when Settings UI ships
          lastSampleAtSec: dayStart + 23 * 3600 + 59 * 60,
          // Per-hour distribution comes from the 0x73 0x04 step-event notify
          // path, not 0x07. Filled with zeros until that path is wired.
          hourly: new Array<number>(24).fill(0),
        };
        const caloriesDay: CaloriesDay = {
          dayLocal,
          measuredAtSec: dayStart,
          totalKcal: info.activity.totalKcal,
          // 0x07 doesn't split active vs basal; until setUserParams gives us
          // BMR-input data we attribute the total to activity.
          activityKcal: info.activity.totalKcal,
          bmrKcal: 0,
          targetKcal: null,
        };
        useActivity.getState().addPendingSteps(activityDay);
        useActivity.getState().addPendingCalories(caloriesDay);
        activityCount += 1;
      }
      setVitalCursor(deviceBleId, 'activity', day);
    }
  }

  return { sleep: sleepCount, activity: activityCount };
}

// ────────────────────────────────────────────────────────────────────
// Pipeline entry point.

export async function syncMultiVitals(
  device: UrionDevice,
  deviceBleId: string,
  deviceMeta: DeviceMeta,
  options: SyncMultiVitalsOptions = {},
): Promise<SyncMultiVitalsResult> {
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const errors: Record<string, string> = {};
  const pulled = { hr: 0, spo2: 0, sleep: 0, activity: 0 };

  // Steps 2-3 — dirty-tracked writers (D13 §3.3). Closes the Sprint
  // 7.5 stub: applyDeviceConfig flushes vitalSetup + profile state to
  // the watch (auto-HR / auto-SpO2 / user params / goals). It's a
  // best-effort step — failures don't abort the data pull. The
  // dirty-flag stays true on partial failure so the next sync retries.
  try {
    const cfg = await applyDeviceConfig(device);
    if (cfg.error) {
      // Already logged inside applyDeviceConfig; surface as a step
      // error in the result so the caller sees it without it
      // poisoning the per-vital error map.
      errors.deviceConfig = cfg.error;
    }
  } catch (e) {
    // Defensive: applyDeviceConfig is supposed to never throw, but if
    // an unexpected error escapes (e.g. profile snapshot crash), log
    // and continue.
    errors.deviceConfig = e instanceof Error ? e.message : String(e);
  }

  // Steps 5-8 — three branches in parallel. Per-vital error isolation
  // via Promise.allSettled. Sleep + activity share readDayInfo, so
  // they're merged into one branch (1 BLE round-trip per day instead
  // of 2 across multi-day backfill).
  const [hrR, spo2R, dayInfoR] = await Promise.allSettled([
    syncHRStep(device, deviceBleId, nowSec, options),
    syncSpO2Step(device, deviceBleId, nowSec, options),
    syncDayInfoStep(device, deviceBleId, nowSec, options),
  ]);
  if (hrR.status === 'fulfilled') {
    pulled.hr = hrR.value;
  } else {
    errors.hr = hrR.reason instanceof Error ? hrR.reason.message : String(hrR.reason);
  }
  if (spo2R.status === 'fulfilled') {
    pulled.spo2 = spo2R.value;
  } else {
    errors.spo2 =
      spo2R.reason instanceof Error ? spo2R.reason.message : String(spo2R.reason);
  }
  if (dayInfoR.status === 'fulfilled') {
    pulled.sleep = dayInfoR.value.sleep;
    pulled.activity = dayInfoR.value.activity;
  } else {
    const msg =
      dayInfoR.reason instanceof Error
        ? dayInfoR.reason.message
        : String(dayInfoR.reason);
    // The merged step covers both vitals; surface the failure under both.
    errors.sleep = msg;
    errors.activity = msg;
  }

  // Build the batched payload from the slices' pending arrays.
  const hrPending = useHR.getState().pending;
  const spo2Pending = useSpO2.getState().pending;
  const sleepPending = useSleep.getState().pending;
  const stepsPending = useActivity.getState().pendingSteps;
  const caloriesPending = useActivity.getState().pendingCalories;

  const payload: MultiVitalsPayload = {
    device: deviceMeta,
    hrSamples: hrPending.length ? hrPending : undefined,
    spo2Samples: spo2Pending.length ? spo2Pending : undefined,
    sleepSessions: sleepPending.length ? sleepPending : undefined,
    activityDays: stepsPending.length ? stepsPending : undefined,
    caloriesDays: caloriesPending.length ? caloriesPending : undefined,
    clientSyncedAtSec: nowSec,
    clientAppVersion: APP_VERSION,
  };

  if (isPayloadEmpty(payload)) {
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      pulled,
      inserted: null,
    };
  }

  try {
    const response = await postMultiVitals(payload);
    // Move pending → recent on each slice using the keys we pushed.
    // The /sync response gives us insert/duplicate counts; treat any
    // sample we sent as accepted (the server has it; cursor already
    // advanced; whether THIS request inserted vs found-as-duplicate
    // is irrelevant for client-side state).
    if (hrPending.length) {
      useHR.getState().acceptSyncResult(
        hrPending.map((s) => String(s.measuredAtSec)),
      );
    }
    if (spo2Pending.length) {
      useSpO2.getState().acceptSyncResult(
        spo2Pending.map((s) => String(s.measuredAtSec)),
      );
    }
    if (sleepPending.length) {
      useSleep.getState().acceptSyncResult(
        sleepPending.map((s) => String(s.sessionStartSec)),
      );
    }
    if (stepsPending.length) {
      useActivity.getState().acceptStepsSyncResult(
        stepsPending.map((d) => d.dayLocal),
      );
    }
    if (caloriesPending.length) {
      useActivity.getState().acceptCaloriesSyncResult(
        caloriesPending.map((d) => d.dayLocal),
      );
    }
    logger.track('vital_sync_accepted', {
      vital_type: 'hr',
      count: response.inserted.hr,
    });
    // Forward to Apple Health / Health Connect — Sprint 9.5. Fire-and-
    // forget; the bridge gates on account_type + master/per-vital
    // toggles, swallows all errors. Uses the same payload we just sent
    // upstream — HK/HC dedup absorbs any sample we resend on retry.
    void forwardMultiVitalsToPlatform(payload);
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      pulled,
      inserted: response.inserted,
    };
  } catch (e) {
    errors.sync = e instanceof Error ? e.message : 'sync failed';
    return { ok: false, errors, pulled, inserted: null };
  }
}
